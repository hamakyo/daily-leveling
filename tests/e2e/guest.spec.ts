import { expect, test } from "@playwright/test";

test("guest can see the login screen", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Daily Leveling" })).toBeVisible();
  await expect(page.getByText("今日やることを軽く記録して")).toBeVisible();
  await expect(page.getByLabel("Daily Leveling の利用イメージ")).toBeVisible();
  await expect(page.getByRole("button", { name: "Google でログイン" })).toBeVisible();
});

test("google auth start emits the expected OAuth redirect", async ({ baseURL, request }) => {
  const response = await request.get("/auth/google/start", {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(302);

  const location = response.headers().location;
  expect(location).toBeTruthy();

  const authorizationUrl = new URL(location as string);
  expect(authorizationUrl.origin).toBe("https://accounts.google.com");
  expect(authorizationUrl.searchParams.get("scope")).toBe("openid email profile");
  expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(
    `${baseURL}/auth/google/callback`,
  );
  expect(authorizationUrl.searchParams.has("access_type")).toBe(false);
});
