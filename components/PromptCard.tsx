import type { ReactNode } from "react";
import type { SendState } from "@/app/actions";
import { CopyButton } from "./CopyButton";
import { SendButton } from "./SendButton";

/**
 * A ready-to-paste ChatGPT prompt. The host copies it into ChatGPT Enterprise, which sends
 * it via its Outlook apps, then clicks the done button so the app can track progress.
 * With `send`, the app can send the emails itself, and the prompt becomes the fallback.
 */
export function PromptCard({
  title,
  children,
  prompt,
  done,
  send,
  tone,
}: {
  title: string;
  children?: ReactNode;
  prompt: string;
  done?: { label: string; action: () => Promise<void> };
  send?: { label: string; action: () => Promise<SendState> };
  tone?: "attention";
}) {
  return (
    <section className="card prompt-card" data-tone={tone}>
      <h3>{title}</h3>
      {children}
      {send && (
        <>
          <SendButton {...send} />
          <p className="muted">Or send them from your own Outlook with this ChatGPT prompt:</p>
        </>
      )}
      <textarea className="prompt" readOnly value={prompt} rows={Math.min(14, prompt.split("\n").length)} />
      <div className="row gap wrap">
        <CopyButton text={prompt} label="Copy prompt" className={send ? undefined : "primary"} />
        <a className="button" href="https://chatgpt.com/" target="_blank" rel="noreferrer">
          Open ChatGPT ↗
        </a>
        {done && (
          <form action={done.action}>
            <button type="submit">{done.label}</button>
          </form>
        )}
      </div>
    </section>
  );
}
