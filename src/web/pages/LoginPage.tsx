import { useEffect, useState } from "react";

function readAuthRateLimitState() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("authError") !== "rate_limited") {
    return null;
  }

  const retryAfterRaw = params.get("retryAfter");
  const retryAfterSeconds = retryAfterRaw ? Number(retryAfterRaw) : 0;

  return {
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds : 0,
  };
}

export function LoginPage() {
  const [isStartingAuth, setIsStartingAuth] = useState(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(() => readAuthRateLimitState()?.retryAfterSeconds ?? 0);

  useEffect(() => {
    const authRateLimitState = readAuthRateLimitState();
    if (!authRateLimitState || typeof window === "undefined") {
      return;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("authError");
    nextUrl.searchParams.delete("retryAfter");
    window.history.replaceState({}, "", nextUrl.toString());
  }, []);

  useEffect(() => {
    if (retryAfterSeconds <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRetryAfterSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [retryAfterSeconds]);

  function handleLoginStart() {
    if (isStartingAuth || retryAfterSeconds > 0 || typeof window === "undefined") {
      return;
    }

    setIsStartingAuth(true);
    window.location.assign("/auth/google/start");
  }

  const isLoginDisabled = isStartingAuth || retryAfterSeconds > 0;

  return (
    <div className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">習慣トラッカー MVP</p>
        <h1>Daily Leveling</h1>
        <p className="lede">
          毎日の記録を素早く続けられる、月間グリッド中心の習慣トラッカーです。
        </p>
        {retryAfterSeconds > 0 ? (
          <p className="status-text status-text--warning">
            ログイン試行が一時的に集中しています。{retryAfterSeconds} 秒後に再試行してください。
          </p>
        ) : null}
        <button className="primary-button" disabled={isLoginDisabled} onClick={handleLoginStart} type="button">
          {isStartingAuth ? "Google へ移動中..." : "Google でログイン"}
        </button>
      </section>
      <section className="feature-ribbon">
        <article>
          <strong>モバイルは今日中心</strong>
          <span>ワンタップで記録し、進捗をすぐ確認できます。</span>
        </article>
        <article>
          <strong>デスクトップは月間中心</strong>
          <span>月全体をグリッドで俯瞰できます。</span>
        </article>
        <article>
          <strong>再開しやすい設計</strong>
          <span>抜けた日があっても、すぐに戻って続けられます。</span>
        </article>
      </section>
    </div>
  );
}
