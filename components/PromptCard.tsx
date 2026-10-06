import type { ReactNode } from "react";
import { CopyButton } from "./CopyButton";

/** A ready-to-paste ChatGPT prompt. The host copies it into ChatGPT Enterprise, which acts via its Outlook apps. */
export function PromptCard({
  title,
  children,
  prompt,
  tone,
}: {
  title: string;
  children?: ReactNode;
  prompt: string;
  tone?: "attention";
}) {
  return (
    <section className="card prompt-card" data-tone={tone}>
      <h3>{title}</h3>
      {children}
      <textarea className="prompt" readOnly value={prompt} rows={Math.min(14, prompt.split("\n").length)} />
      <div className="row gap wrap">
        <CopyButton text={prompt} label="Copy prompt" className="primary" />
        <a className="button" href="https://chatgpt.com/" target="_blank" rel="noreferrer">
          Open ChatGPT ↗
        </a>
      </div>
    </section>
  );
}
