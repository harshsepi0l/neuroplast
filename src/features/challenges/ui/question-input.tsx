"use client";

import type { PublicQuestion } from "../core/linear-equations";

export function QuestionPrompt({ text }: { text: string }) {
  return <h2 className="challenge-question">{text.split("**").map((part, index) => index % 2 ? <strong key={index}>{part}</strong> : part)}</h2>;
}

export function QuestionInput({ question, value, onChange, disabled = false }: {
  question: PublicQuestion;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  if (question.responseKind === "choice") return <div className="challenge-options" role="group" aria-label="Answer choices">
    {question.options?.map(option => <button key={option.value} type="button" className={`challenge-option ${value === option.value ? "selected" : ""}`} aria-pressed={value === option.value} disabled={disabled} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
  return <div className={`challenge-number-field${question.responseKind === "text" ? " challenge-text-field" : ""}`}><label htmlFor="challenge-answer">{question.responseKind === "integer" && question.mode === "application" ? "Your answer for x" : "Your answer"}</label>
    <input id="challenge-answer" type="text" inputMode={question.responseKind === "integer" ? "numeric" : "text"} autoComplete="off" maxLength={80} placeholder={question.responseKind === "integer" ? "Enter an integer" : "Type a short answer"} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}/>
  </div>;
}
