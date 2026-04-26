export function LoginPage() {
  return (
    <div className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">習慣トラッカー MVP</p>
        <h1>Daily Leveling</h1>
        <p className="lede">
          毎日の記録を素早く続けられる、月間グリッド中心の習慣トラッカーです。
        </p>
        <a className="primary-button" href="/auth/google/start">
          Google でログイン
        </a>
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
