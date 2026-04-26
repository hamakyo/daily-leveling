import { expect, test } from "@playwright/test";
import { loginAsE2eUser, makeTestId, resetE2eUser } from "./helpers";

test("authenticated user can create and complete a habit", async ({ page }, testInfo) => {
  const testId = makeTestId(testInfo);
  const habitName = `E2E 読書 ${Date.now()}`;

  await loginAsE2eUser(page, testId, { onboardingCompleted: true });
  try {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "今日の記録" })).toBeVisible();

    await page.getByLabel("名前").fill(habitName);
    await page.getByRole("button", { name: "作成" }).click();

    await expect(page.getByText("習慣を作成しました。")).toBeVisible();
    await expect(page.getByText(habitName).first()).toBeVisible();

    const logResponse = page.waitForResponse((response) => {
      return response.request().method() === "PUT" && response.url().includes("/logs/");
    });
    await page.getByRole("button", { name: "記録する" }).first().click();
    expect((await logResponse).ok()).toBe(true);
    await expect(page.getByRole("button", { name: "達成" }).first()).toBeVisible();

    await page.getByRole("button", { name: "月間" }).click();
    await expect(page.getByRole("heading", { name: "月間ビュー" })).toBeVisible();
    await expect(page.getByText("月間達成率")).toBeVisible();
  } finally {
    await resetE2eUser(page, testId);
  }
});
