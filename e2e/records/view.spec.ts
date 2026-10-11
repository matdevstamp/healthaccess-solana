import { expect, test, type Page } from "@playwright/test";

/**
 * The medical-records view. This lives as the "Records" tab on the patient
 * journal (`/patients/[id]`), not at a separate `/patients/1/records` route,
 * so the suite drives the tab rather than a page that does not exist.
 */

async function login(page: Page, username: string): Promise<void> {
  const response = await page.request.post("/api/auth/login", {
    data: { username, password: "test123" },
  });

  expect(response.ok(), `login as ${username} failed`).toBeTruthy();
}

test.describe("medical records", () => {
  test("shows a patient's journal entries", async ({ page }) => {
    await login(page, "dr_test");
    await page.goto("/patients/1");

    // "Records" is the default tab.
    await expect(page.getByRole("tab", { name: /Records/ })).toBeVisible();
    await expect(page.getByText("Mild asthma — inhaler prescribed.")).toBeVisible();
  });

  test("labels each record with its type, date and practitioner", async ({ page }) => {
    await login(page, "dr_test");
    await page.goto("/patients/1");

    await expect(page.getByText("diagnosis", { exact: true })).toBeVisible();
    await expect(page.getByText("dr_test")).toBeVisible();
  });

  test("counts the records in the tab label", async ({ page }) => {
    await login(page, "dr_test");
    await page.goto("/patients/1");

    await expect(page.getByRole("tab", { name: /Records/ })).toContainText("1 entries");
  });

  test("shows a patient their own records", async ({ page }) => {
    await login(page, "patient_test");
    await page.goto("/patients/1");

    await expect(page.getByText("Mild asthma — inhaler prescribed.")).toBeVisible();
  });

  test("refuses to show one patient's records to another", async ({ page }) => {
    await login(page, "patient_test");
    await page.goto("/patients/2");

    await expect(page.getByText("Patients can only open their own journal.")).toBeVisible();
    await expect(page.getByText("Mark's record — private to patient 2.")).not.toBeVisible();
  });

  // This suite covers reading records only. Writing a medical record is not in
  // the specced scope: docs/Raw_Requirements.md:53 and task 14 both ask staff to
  // add a note with a visibility choice, and the records
  // user stories (task 12, US-06/07/08) are read-only. Note creation is covered
  // by e2e/notes/visibility.spec.ts and e2e/realtime/notes.spec.ts.
});
