import { useEffect, useState } from "react";

const completedPreviewDays = new Set([0, 1, 3, 4, 7, 8, 9, 11, 14, 16, 17, 21, 23, 24, 25]);
const targetPreviewDays = new Set([2, 5, 10, 12, 15, 18, 22, 26]);

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
    <div className="page-shell page-shell--login">
      <section className="login-hero">
        <div className="login-hero__copy">
          <p className="eyebrow">習慣トラッカーアプリ</p>
          <h1>Daily Leveling</h1>
          <p className="lede">
            今日やることを軽く記録して、月全体の積み上がりを見返せる習慣トラッカーです。
          </p>
          <div className="login-hero__actions">
            {retryAfterSeconds > 0 ? (
              <p className="status-text status-text--warning">
                ログイン試行が一時的に集中しています。{retryAfterSeconds} 秒後に再試行してください。
              </p>
            ) : null}
            <button className="primary-button" disabled={isLoginDisabled} onClick={handleLoginStart} type="button">
              {isStartingAuth ? "Google へ移動中..." : "Google でログイン"}
            </button>
          </div>
        </div>
        <div className="login-preview" aria-label="Daily Leveling の利用イメージ">
          <div className="login-preview__header">
            <div>
              <span className="login-preview__label">今日の記録</span>
              <strong>2/3 達成</strong>
            </div>
            <span className="login-preview__date">2026-04-30</span>
          </div>
          <div className="login-preview__summary">
            <strong>66.7%</strong>
            <span>水を飲む、読書を達成</span>
          </div>
          <div className="login-preview__habits">
            <div className="login-preview__habit login-preview__habit--done">
              <span>水を飲む</span>
              <strong>完了</strong>
            </div>
            <div className="login-preview__habit login-preview__habit--done">
              <span>読書</span>
              <strong>完了</strong>
            </div>
            <div className="login-preview__habit">
              <span>ストレッチ</span>
              <strong>対象日</strong>
            </div>
          </div>
          <div className="login-preview__month" aria-label="月間進捗の例">
            {Array.from({ length: 28 }, (_, index) => {
              const className = completedPreviewDays.has(index)
                ? "login-preview__day login-preview__day--done"
                : targetPreviewDays.has(index)
                  ? "login-preview__day login-preview__day--target"
                  : "login-preview__day";

              return <span aria-hidden="true" className={className} key={index} />;
            })}
          </div>
        </div>
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
