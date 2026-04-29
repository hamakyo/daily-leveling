import type { Theme } from "../../lib/types";

export const THEME_LABELS: Record<Theme, string> = {
  light: "ライト",
  dark: "ダーク",
  system: "システム設定",
};

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") {
    return theme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = resolveTheme(theme);
  document.documentElement.dataset.themePreference = theme;
}

export function watchThemePreference(theme: Theme): () => void {
  applyTheme(theme);

  if (theme !== "system") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => applyTheme("system");

  mediaQuery.addEventListener("change", handleChange);
  return () => mediaQuery.removeEventListener("change", handleChange);
}
