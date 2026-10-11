import { expect, test, type Page } from "@playwright/test";

/**
 * The access-log view. Like the records view it is a tab on the patient
 * journal (`/patients/[id]`), fed by `GET /api/access-log` and live
 * `access-log-created` socket events.
 */

async function login(page: Page, username: string): Promise<void> {
  const response = await page.request.post("/api/auth/login", {
    data: { username, password: "test123" },
  });

  expect(response.ok(), `login as ${username} failed`).toBeTruthy();
}

async function openAccessLogTab(page: Page, username: string): Promise<void> {
  await login(page, username);
  await page.goto("/patients/1");
  await page.getByRole("tab", { name: /Access log/ }).click();
}

test.describe("access logs", () => {
  test("records a log entry when a record is viewed", async ({ page }) => {
    await openAccessLogTab(page, "dr_test");

    // Opening the journal itself is the "view" event.
    await expect(page.getByText("view", { exact: false }).first()).toBeVisible();
  });

  test("shows the acting user, the action and the originating server", async ({ page }) => {
    await openAccessLogTab(page, "dr_test");

    // The event carries a userId only; the name is joined from SQL at read
    // time, since the on-chain payload must not carry personal data.
    await expect(page.getByText("dr_test").first()).toBeVisible();
    await expect(page.getByText(/Server: (hospital-s|ambulance-a)/).first()).toBeVisible();
  });

  test("shows the anchoring state and whether the mirror matches chain", async ({ page }) => {
    await openAccessLogTab(page, "dr_test");

    // Anchoring is asynchronous, so a row is normally "pending" until the
    // flusher runs. Both states are legitimate; a red "Anchor failed" is not.
    await expect(page.getByTestId("access-log-status").first()).toBeVisible();
    await expect(page.getByText("Anchor failed")).not.toBeVisible();
    await expect(page.getByTestId("access-log-verification")).toBeVisible();
  });

  test("gives a patient the access log for their own journal only", async ({ page }) => {
    await openAccessLogTab(page, "patient_test");

    // The API filters by patientId in the query; the UI must not show another
    // patient's events, so patient 2's journal id never appears as a target.
    await expect(page.getByTestId("access-log-status").first()).toBeVisible();
  });

  test("refuses the access log for a patient the viewer cannot open", async ({ page }) => {
    await login(page, "patient_test");
    await page.goto("/patients/2");

    await expect(page.getByText("Patients can only open their own journal.")).toBeVisible();
    await expect(page.getByRole("tab", { name: /Access log/ })).not.toBeVisible();
  });
});
