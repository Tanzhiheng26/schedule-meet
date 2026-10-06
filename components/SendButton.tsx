"use client";

import { useActionState } from "react";
import type { SendState } from "@/app/actions";

/** Sends emails straight from the app and shows how it went. */
export function SendButton({ label, action }: { label: string; action: () => Promise<SendState> }) {
  const [state, run, pending] = useActionState<SendState>(action, {});
  return (
    <form action={run} className="row gap wrap">
      <button type="submit" className="primary" disabled={pending}>
        {pending ? "Sending…" : label}
      </button>
      {state.message && <span className="success">{state.message}</span>}
      {state.error && <span className="error">{state.error}</span>}
    </form>
  );
}
