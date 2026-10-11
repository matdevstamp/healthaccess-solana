import { expect, test } from "@playwright/test";

import { apiGet } from "../helpers/api.helper";
import type { PatientSearchResponse } from "@/lib/types/api";

test.describe("patient search", () => {
  test("finds a patient by name through the API", async ({ request }) => {
    const login = await request.post("/api/auth/login", {
      data: { username: "dr_test", password: "test123" },
    });
    expect(login.status()).toBe(200);
    const data = await apiGet<PatientSearchResponse>(request, "/api/patients?q=Anna&filter=name");

    expect(data.total).toBe(1);
    expect(data.patients[0]?.name).toBe("Anna Kowalska");
    expect(data.patients[0]?.dateOfBirth).toBe("1990-01-01");
  });

  test("rejects forged mock headers without a session", async ({ request }) => {
    const response = await request.get("/api/patients?q=Anna", {
      headers: { "x-mock-role": "doctor", "x-mock-user-id": "1" },
    });
    expect(response.status()).toBe(401);
    expect((await response.json()).ok).toBe(false);
  });

  for (const username of ["patient_test", "unauth_test"]) {
    test(`refuses search for ${username}`, async ({ request }) => {
      const login = await request.post("/api/auth/login", {
        data: { username, password: "test123" },
      });
      expect(login.status()).toBe(200);
      expect((await request.get("/api/patients?q=Anna")).status()).toBe(403);
    });
  }

  test("supports SQL filters and rejects invalid search parameters", async ({ request }) => {
    const login = await request.post("/api/auth/login", {
      data: { username: "nurse_test", password: "test123" },
    });
    expect(login.status()).toBe(200);
    for (const path of [
      "/api/patients?q=ANNA%20ANDERSSON&filter=name",
      "/api/patients?q=1990-01&filter=dob",
      "/api/patients?q=19900101-1234&filter=personalNumber",
    ]) {
      const data = await apiGet<PatientSearchResponse>(request, path);
      expect(data.patients[0]?.name).toBe("Anna Kowalska");
    }
    for (const params of ["page=0", "page=1.5", "page=oops", "filter=unknown"]) {
      expect((await request.get(`/api/patients?${params}`)).status()).toBe(400);
    }
  });

  test("shows an empty visible state for no frontend results", async ({ page }) => {
    const loginResponse = await page.request.post("/api/auth/login", {
      data: {
        username: "dr_test",
        password: "test123",
      },
    });

    expect(loginResponse.status()).toBe(200);

    await page.goto("/");

    await page.evaluate(() => {
      window.localStorage.setItem(
        "awesome-journal.mock-user",
        JSON.stringify({
          id: 1,
          username: "doctor",
          role: "doctor",
          organizationId: 1,
        }),
      );
    });

    await page.goto("/patients");

    await page.getByPlaceholder("Search patients...").fill("ZZZZZ");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page.getByText("No patients found")).toBeVisible();
  });

  test("refuses a patient opening another patient's identifier", async ({ request }) => {
    const login = await request.post("/api/auth/login", {
      data: { username: "patient_test", password: "test123" },
    });
    expect(login.status()).toBe(200);
    const response = await request.get("/api/patients/2");

    const body = await response.json();

    expect(response.status()).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("requires a JWT even when mock role headers are supplied", async ({ request }) => {
    const response = await request.get("/api/patients/1", {
      headers: { "x-mock-role": "doctor", "x-mock-user-id": "1" },
    });
    expect(response.status()).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  test("loads SQL journal data for staff", async ({ request }) => {
    const login = await request.post("/api/auth/login", {
      data: { username: "dr_test", password: "test123" },
    });
    expect(login.status()).toBe(200);
    const response = await request.get("/api/patients/1");
    expect(response.status()).toBe(200);
    const { data } = await response.json();
    expect(data.patient).toMatchObject({
      id: 1,
      name: "Anna Kowalska",
      dateOfBirth: "1990-01-01",
    });
    expect(data.records).toContainEqual(
      expect.objectContaining({ id: 1, title: "diagnosis", practitioner: "dr_test" }),
    );
    expect(data.notes).toContainEqual(
      expect.objectContaining({ id: 1, visibility: "healthcare", author: "nurse_test" }),
    );
    expect(data.isOwnJournal).toBe(false);
  });

  test("patient sees only their own public notes", async ({ request }) => {
    const login = await request.post("/api/auth/login", {
      data: { username: "patient_test", password: "test123" },
    });
    expect(login.status()).toBe(200);
    const response = await request.get("/api/patients/1");
    expect(response.status()).toBe(200);
    const { data } = await response.json();
    expect(data.isOwnJournal).toBe(true);
    expect(data.notes.every((note: { visibility: string }) => note.visibility === "all")).toBe(
      true,
    );
    expect(data.notes).not.toContainEqual(expect.objectContaining({ id: 1 }));
    expect(data.hiddenNotesCount).toBeGreaterThanOrEqual(1);
  });

  test("rejects invalid IDs and handles missing patients", async ({ request }) => {
    const login = await request.post("/api/auth/login", {
      data: { username: "dr_test", password: "test123" },
    });
    expect(login.status()).toBe(200);
    expect((await request.get("/api/patients/abc")).status()).toBe(400);
    expect((await request.get("/api/patients/999")).status()).toBe(404);
  });

  test("lets primary-care staff search and open a journal", async ({ request }) => {
    // The primary care role carries the same clinical permissions as hospital
    // staff, so the whole staff flow has to work for it end to end.
    const login = await request.post("/api/auth/login", {
      data: { username: "vc_test", password: "test123" },
    });
    expect(login.status()).toBe(200);

    const search = await apiGet<PatientSearchResponse>(request, "/api/patients?q=Anna&filter=name");
    expect(search.total).toBe(1);

    const journal = await request.get("/api/patients/1");
    expect(journal.status()).toBe(200);
    expect((await journal.json()).data.viewerRole).toBe("primary_care");
  });

  test("signs primary-care staff in through the login form to the staff dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("combobox", { name: "Demo user" }).click();
    await page
      .getByRole("option", { name: "Ekfors Primary Care Centre (nurse) - Primary care" })
      .click();
    await page.getByLabel("Password").fill("test123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    // isStaffRole drives this heading; a role missing from it would land the
    // clinic user on the patient-facing copy instead.
    await expect(page.getByRole("heading", { name: "Care staff dashboard" })).toBeVisible();
  });
});
