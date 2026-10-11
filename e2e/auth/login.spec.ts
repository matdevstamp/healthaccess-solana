import { expect, test } from "@playwright/test";

test.describe("auth", () => {
  test("logs a doctor in and lands on the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("combobox", { name: "Demo user" }).click();
    await page.getByRole("option", { name: "Dr. Sofia Berg - Doctor" }).click();
    await page.getByLabel("Password").fill("test123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Care staff dashboard" })).toBeVisible();
  });

  test("sends a patient directly to their own journal", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("combobox", { name: "Demo user" }).click();
    await page.getByRole("option", { name: "Anna Kowalska - Patient" }).click();
    await page.getByLabel("Password").fill("test123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/patients\/1$/);
    await expect(page.getByRole("heading", { name: "My health record" })).toBeVisible();
  });

  test("shows an error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid username or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
