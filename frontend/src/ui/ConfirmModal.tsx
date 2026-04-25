import { useCallback, useEffect, useRef, useState } from "react";
import "./ConfirmModal.css";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PendingState extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

let showImpl: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  if (!showImpl) {
    return Promise.resolve(window.confirm(`${opts.title}\n\n${opts.message}`));
  }
  return showImpl(opts);
}

export function ConfirmHost() {
  const [pending, setPending] = useState<PendingState | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    showImpl = (opts) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...opts, resolve });
      });
    return () => {
      showImpl = null;
    };
  }, []);

  const answer = useCallback(
    (result: boolean) => {
      if (!pending) return;
      pending.resolve(result);
      setPending(null);
    },
    [pending],
  );

  useEffect(() => {
    if (!pending) return;
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        answer(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        answer(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, answer]);

  if (!pending) return null;

  return (
    <div className="confirm-overlay" onClick={() => answer(false)}>
      <div
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <h2 id="confirm-title" className="confirm-title">
          {pending.title}
        </h2>
        <p id="confirm-message" className="confirm-message">
          {pending.message}
        </p>
        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-btn confirm-btn-cancel"
            onClick={() => answer(false)}
          >
            {pending.cancelLabel ?? "Cancel"}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className="confirm-btn confirm-btn-ok"
            onClick={() => answer(true)}
          >
            {pending.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
