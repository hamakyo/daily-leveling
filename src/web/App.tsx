import { useEffect, useState } from "react";
import { loadCurrentUser } from "./api";
import { LoadingShell } from "./components/LoadingShell";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import type { ScreenState } from "./types";
import { watchThemePreference } from "./utils/theme";

export function App() {
  const [screen, setScreen] = useState<ScreenState>({ kind: "loading" });
  const [fatalError, setFatalError] = useState<string | null>(null);

  async function refreshUser() {
    try {
      const user = await loadCurrentUser();
      if (!user) {
        setScreen({ kind: "guest" });
        return;
      }

      setScreen({ kind: "ready", user });
      setFatalError(null);
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "ユーザー情報の読み込みに失敗しました。");
    }
  }

  useEffect(() => {
    void refreshUser();
  }, []);

  useEffect(() => {
    return watchThemePreference(screen.kind === "ready" ? screen.user.theme : "light");
  }, [screen]);

  if (fatalError) {
    return (
      <div className="page-shell">
        <section className="hero-card">
          <p className="eyebrow">エラー</p>
          <h1>アプリを読み込めませんでした。</h1>
          <p className="lede">{fatalError}</p>
          <button className="primary-button" onClick={() => void refreshUser()} type="button">
            再試行
          </button>
        </section>
      </div>
    );
  }

  if (screen.kind === "loading") {
    return <LoadingShell />;
  }

  if (screen.kind === "guest") {
    return <LoginPage />;
  }

  if (!screen.user.onboardingCompleted) {
    return <OnboardingPage onComplete={refreshUser} />;
  }

  return (
    <DashboardPage
      onLogout={refreshUser}
      onUserReload={refreshUser}
      user={screen.user}
    />
  );
}
