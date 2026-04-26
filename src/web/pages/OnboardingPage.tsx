import { type FormEvent, useState } from "react";
import { templateLabels, templates } from "../../domain/templates";
import {
  applyOnboardingTemplate,
  completeOnboarding,
  createHabit,
} from "../api";
import { HabitForm } from "../components/HabitForm";
import type { CreateHabitInput } from "../types";
import { createEmptyHabitForm, toHabitPayload } from "../utils/habitForm";

export function OnboardingPage({
  onComplete,
}: {
  onComplete: () => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<CreateHabitInput>(createEmptyHabitForm);

  async function handleTemplateApply(templateId: string) {
    setIsSubmitting(true);
    setMessage(null);
    try {
      await applyOnboardingTemplate(templateId);
      setMessage(`テンプレート「${templateLabels[templateId as keyof typeof templateLabels] ?? templateId}」を適用しました。`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      await createHabit(toHabitPayload(form));
      setForm(createEmptyHabitForm());
      setMessage("習慣を追加しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function finishOnboarding() {
    setIsSubmitting(true);
    try {
      await completeOnboarding();
      await onComplete();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">初回ログイン</p>
        <h1>まずは小さく始めましょう。</h1>
        <p className="lede">
          テンプレートを適用するか、自分の習慣を追加してダッシュボードに進みます。
        </p>
        {message ? <p className="status-text">{message}</p> : null}
      </section>
      <section className="panel-grid">
        <div className="panel">
          <h2>テンプレート</h2>
          <div className="template-stack">
            {Object.entries(templates).map(([templateId, habits]) => (
              <button
                key={templateId}
                className="template-card"
                disabled={isSubmitting}
                onClick={() => {
                  void handleTemplateApply(templateId);
                }}
                type="button"
              >
                <strong>{templateLabels[templateId as keyof typeof templateLabels] ?? templateId}</strong>
                <span>{habits.map((habit) => habit.name).join(" / ")}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>手動で追加</h2>
          <HabitForm
            buttonLabel="習慣を追加"
            disabled={isSubmitting}
            form={form}
            onChange={setForm}
            onSubmit={addHabit}
          />
        </div>
      </section>
      <div className="action-row">
        <button className="primary-button" disabled={isSubmitting} onClick={() => void finishOnboarding()} type="button">
          ダッシュボードを始める
        </button>
      </div>
    </div>
  );
}
