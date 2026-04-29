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

    await page.getByRole("button", { name: "週間" }).click();
    await expect(page.getByRole("heading", { name: "週間ビュー" })).toBeVisible();
    await expect(page.getByText("週間達成率")).toBeVisible();

    await page.getByRole("button", { name: "月間" }).click();
    await expect(page.getByRole("heading", { name: "月間ビュー" })).toBeVisible();
    await expect(page.getByText("月間達成率")).toBeVisible();
  } finally {
    await resetE2eUser(page, testId);
  }
});

test("authenticated user can reorder habits from the today screen", async ({ page }, testInfo) => {
  const testId = makeTestId(testInfo);
  const firstHabitName = `E2E 並び替え 1 ${Date.now()}`;
  const secondHabitName = `E2E 並び替え 2 ${Date.now()}`;

  await loginAsE2eUser(page, testId, { onboardingCompleted: true });
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "今日の記録" })).toBeVisible();

    await page.getByLabel("名前").fill(firstHabitName);
    await page.getByRole("button", { name: "作成" }).click();
    await expect(page.getByText(firstHabitName).first()).toBeVisible();

    await page.getByLabel("名前").fill(secondHabitName);
    await page.getByRole("button", { name: "作成" }).click();
    await expect(page.getByText(secondHabitName).first()).toBeVisible();

    await page.getByRole("button", { name: "並び替え" }).click();
    await expect(page.getByText("今日の記録の順番を調整しています。保存すると他の一覧にも反映されます。")).toBeVisible();

    const reorderResponse = page.waitForResponse((response) => {
      return response.request().method() === "POST" && response.url().includes("/habits/reorder");
    });
    await page.getByLabel(`${secondHabitName} を上へ移動`).click();
    await page.getByRole("button", { name: "順番を保存" }).click();
    expect((await reorderResponse).ok()).toBe(true);

    await expect(page.getByText("今日の記録の並び順を更新しました。")).toBeVisible();
    const habitTitles = page.locator(".today-card strong");
    await expect(habitTitles.nth(0)).toContainText(secondHabitName);
    await expect(habitTitles.nth(1)).toContainText(firstHabitName);

    await page.reload();
    await expect(page.getByRole("heading", { name: "今日の記録" })).toBeVisible();
    await expect(habitTitles.nth(0)).toContainText(secondHabitName);
    await expect(habitTitles.nth(1)).toContainText(firstHabitName);
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

test("authenticated user can persist weekly as the default view", async ({ page }, testInfo) => {
  const testId = makeTestId(testInfo);
  const timezone = "UTC";

  await loginAsE2eUser(page, testId, { onboardingCompleted: true });
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "今日の記録" })).toBeVisible();
    await expect(page.getByRole("button", { name: "設定を保存" })).toBeDisabled();

    await page.getByLabel("タイムゾーン").selectOption(timezone);
    await expect(page.getByRole("button", { name: "元に戻す" })).toBeVisible();
    await expect(page.getByRole("button", { name: "設定を保存" })).toBeEnabled();
    await page.getByRole("button", { name: "元に戻す" }).click();
    await expect(page.getByRole("button", { name: "設定を保存" })).toBeDisabled();
    await expect(page.getByLabel("タイムゾーン")).not.toHaveValue(timezone);

    await page.getByLabel("タイムゾーン").selectOption(timezone);
    await page.getByLabel("初期表示").selectOption("week");
    const settingsResponse = page.waitForResponse((response) => {
      return response.request().method() === "PATCH" && response.url().includes("/settings");
    });
    await page.getByRole("button", { name: "設定を保存" }).click();
    expect((await settingsResponse).ok()).toBe(true);
    await expect(page.getByText("設定を保存しました。")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("タイムゾーン")).toHaveValue(timezone);
    await expect(page.getByRole("heading", { name: "週間ビュー" })).toBeVisible();
    await expect(page.getByText("週間達成率")).toBeVisible();
  } finally {
    await resetE2eUser(page, testId);
  }
});

test("authenticated user can edit and delete a habit from the habit list", async ({ page }, testInfo) => {
  const testId = makeTestId(testInfo);
  const originalHabitName = `E2E 編集前 ${Date.now()}`;
  const updatedHabitName = `E2E 編集後 ${Date.now()}`;

  await loginAsE2eUser(page, testId, { onboardingCompleted: true });
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "今日の記録" })).toBeVisible();

    await page.getByLabel("名前").fill(originalHabitName);
    await page.getByRole("button", { name: "作成" }).click();
    await expect(page.getByText(originalHabitName).first()).toBeVisible();

    const originalRow = page.locator(".habit-admin-row").filter({
      has: page.getByText(originalHabitName, { exact: true }),
    });
    await expect(originalRow).toBeVisible();
    await originalRow.getByRole("button", { name: "編集" }).click();

    const editRow = page.locator(".habit-admin-row--editing");
    await expect(editRow).toBeVisible();
    await editRow.getByLabel("習慣名").fill(updatedHabitName);
    await editRow.getByLabel("繰り返し方").selectOption("weekly_days");
    await editRow.getByRole("button", { name: "火曜日" }).click();
    await editRow.getByRole("button", { name: "木曜日" }).click();
    await expect(editRow.getByRole("button", { name: "更新" })).toBeEnabled();

    const updateResponse = page.waitForResponse((response) => {
      return response.request().method() === "PATCH" && response.url().includes("/habits/");
    });
    await editRow.getByRole("button", { name: "更新" }).click();
    expect((await updateResponse).ok()).toBe(true);

    await expect(page.getByText("習慣を更新しました。")).toBeVisible();
    await expect(page.getByText(updatedHabitName).first()).toBeVisible();
    await expect(page.getByText("有効 ・ 毎週 火・木")).toBeVisible();

    const updatedRow = page.locator(".habit-admin-row").filter({
      has: page.getByText(updatedHabitName, { exact: true }),
    });
    await expect(updatedRow.getByRole("button", { name: "削除" })).toHaveCount(0);
    await updatedRow.getByRole("button", { name: "編集" }).click();

    const deleteEditRow = page.locator(".habit-admin-row--editing");
    await expect(deleteEditRow).toBeVisible();
    const deleteResponse = page.waitForResponse((response) => {
      return response.request().method() === "PATCH" && response.url().includes("/habits/");
    });
    await deleteEditRow.getByRole("button", { name: "削除" }).click();
    expect((await deleteResponse).ok()).toBe(true);

    await expect(page.getByText("習慣を削除しました。累計XPは維持されます。")).toBeVisible();
    await expect(page.getByText(updatedHabitName, { exact: true })).toHaveCount(0);
  } finally {
    await resetE2eUser(page, testId);
  }
});
