import { expect, type Page, type TestInfo } from "@playwright/test";

export function makeTestId(testInfo: TestInfo): string {
  return `${testInfo.project.name}-${testInfo.titlePath.join("-")}-${Date.now()}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72);
}

export async function loginAsE2eUser(
  page: Page,
  testId: string,
  options: { onboardingCompleted?: boolean } = {},
): Promise<void> {
  const response = await page.context().request.post("/__e2e/login", {
    data: {
      onboardingCompleted: options.onboardingCompleted ?? false,
      testId,
    },
  });

  if (!response.ok()) {
    expect(response.ok(), await response.text()).toBe(true);
  }

  const payload = (await response.json()) as {
    session: {
      cookieName: string;
      expiresAt: string;
      token: string;
    };
  };

  await page.context().addCookies([
    {
      expires: Math.floor(new Date(payload.session.expiresAt).getTime() / 1000),
      httpOnly: true,
      name: payload.session.cookieName,
      sameSite: "Lax",
      url: "http://127.0.0.1:8788",
      value: payload.session.token,
    },
  ]);
}

export async function resetE2eUser(page: Page, testId: string): Promise<void> {
  const response = await page.context().request.post("/__e2e/reset", {
    data: { testId },
  });

  if (!response.ok()) {
    expect(response.ok(), await response.text()).toBe(true);
  }
}
