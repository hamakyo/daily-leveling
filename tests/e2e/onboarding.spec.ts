import { expect, test } from "@playwright/test";
import { loginAsE2eUser, makeTestId, resetE2eUser } from "./helpers";

test("new user can apply a starter template and enter the dashboard", async ({ page }, testInfo) => {
  const testId = makeTestId(testInfo);

  await loginAsE2eUser(page, testId);
  try {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "まずは小さく始めましょう。" })).toBeVisible();

    await page.getByRole("button", { name: /健康の基本/ }).click();
    await expect(page.getByText("テンプレート「健康の基本」を適用しました。")).toBeVisible();

    await page.getByRole("button", { name: "ダッシュボードを始める" }).click();

    await expect(page.getByRole("heading", { name: "Daily Leveling" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "今日の記録" })).toBeVisible();
    await expect(page.getByText("水を飲む").first()).toBeVisible();
  } finally {
    await resetE2eUser(page, testId);
  }
});
