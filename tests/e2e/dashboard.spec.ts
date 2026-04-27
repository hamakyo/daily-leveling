import { expect, test } from "@playwright/test";
import { loginAsE2eUser, makeTestId, resetE2eUser } from "./helpers";

test("authenticated user can create and complete a habit", async ({ page }, testInfo) => {
  const testId = makeTestId(testInfo);
  const habitName = `E2E 読書 ${Date.now()}`;

  await loginAsE2eUser(page, testId, { onboardingCompleted: true });
  try {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "今日の記録" })).toBeVisible();
    const levelPanel = page.locator(".level-panel");

    await page.getByLabel("名前").fill(habitName);
    await page.getByRole("button", { name: "作成" }).click();

    await expect(page.getByText("習慣を作成しました。")).toBeVisible();
    await expect(page.getByText(habitName).first()).toBeVisible();
    await expect(levelPanel.getByText(/レベル \d+/).first()).toBeVisible();
    await expect(levelPanel.locator(".level-meter__fill")).toHaveAttribute("style", /width: 0%/);

    const logResponse = page.waitForResponse((response) => {
      return response.request().method() === "PUT" && response.url().includes("/logs/");
    });
    await page.locator(".checkbox-toggle").first().click();
    expect((await logResponse).ok()).toBe(true);
    await expect(page.getByText("+10 XP")).toBeVisible();
    await expect(page.getByText("連続達成 1 日")).toBeVisible();
    await expect(page.getByText("今日の習慣をすべて達成しました")).toBeVisible();
    await expect(levelPanel.getByText("10 XP", { exact: true })).toBeVisible();
    await expect(levelPanel.locator(".level-meter__fill")).toHaveAttribute("style", /width: 10%/);

    await page.getByRole("button", { name: "月間" }).click();
    await expect(page.getByRole("heading", { name: "月間ビュー" })).toBeVisible();
    await expect(page.getByText("月間達成率")).toBeVisible();
  } finally {
    await resetE2eUser(page, testId);
  }
});

test("authenticated user sees a level-up effect after enough completions", async ({ page }, testInfo) => {
  const testId = makeTestId(testInfo);
  const habitNames = Array.from({ length: 10 }, (_, index) => `E2E レベル ${index + 1} ${Date.now()}`);

  await loginAsE2eUser(page, testId, { onboardingCompleted: true });
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "今日の記録" })).toBeVisible();
    const levelPanel = page.locator(".level-panel");

    for (const habitName of habitNames) {
      await page.getByLabel("名前").fill(habitName);
      await page.getByRole("button", { name: "作成" }).click();
      await expect(page.getByText(habitName).first()).toBeVisible();
    }

    for (let index = 0; index < habitNames.length; index += 1) {
      const logResponse = page.waitForResponse((response) => {
        return response.request().method() === "PUT" && response.url().includes("/logs/");
      });
      await page.locator(".checkbox-toggle").nth(index).click();
      expect((await logResponse).ok()).toBe(true);
    }

    await expect(page.getByText("LEVEL UP! Lv 2")).toBeVisible();
    await expect(levelPanel.getByText("レベル 2", { exact: true })).toBeVisible();
    await expect(levelPanel.getByText("次まで 100 XP")).toBeVisible();
  } finally {
    await resetE2eUser(page, testId);
  }
});

test("authenticated user can create an every_n_days habit", async ({ page }, testInfo) => {
  const testId = makeTestId(testInfo);
  const habitName = `E2E 洗濯 ${Date.now()}`;

  await loginAsE2eUser(page, testId, { onboardingCompleted: true });
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "今日の記録" })).toBeVisible();

    await page.getByLabel("名前").fill(habitName);
    await page.getByLabel("繰り返し方").selectOption("every_n_days");
    await page.getByLabel("何日間隔ですか").fill("3");
    await expect(page.getByText("作成すると、今日を起点に 3 日間隔で対象日になります。")).toBeVisible();
    await page.getByRole("button", { name: "作成" }).click();

    await expect(page.getByText("習慣を作成しました。")).toBeVisible();
    await expect(page.getByText(habitName).first()).toBeVisible();
    await expect(page.getByText("有効 ・ 3日間隔")).toBeVisible();
  } finally {
    await resetE2eUser(page, testId);
  }
});
