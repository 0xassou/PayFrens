"use client";

import {useEffect, useId, useRef, useSyncExternalStore} from "react";
import {createPortal} from "react-dom";
import {cn} from "@/lib/cn";

/** Never changes, so the store never notifies — this only reports where we are. */
const NEVER = () => () => {};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A dialog that is a bottom sheet on a phone and a centred card from `sm` up.
 *
 * `Sheet` is bottom-anchored at every width on purpose: it confirms payments,
 * which only ever happen inside Base App's phone-shaped webview. This one has
 * to survive a desktop browser too — it is where someone picks a wallet, and
 * that is the one screen a laptop reaches before Base App does.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Portals need a DOM to aim at, so the server render and the hydration pass
  // have to produce nothing. `open` only ever becomes true after a click, so
  // there is no markup being withheld here.
  const onClient = useSyncExternalStore(
    NEVER,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;

    // Whatever opened the dialog gets focus back when it closes, so a keyboard
    // user is not dumped at the top of the document.
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      // Keep Tab inside the dialog. Without this, tabbing walks out into the
      // page behind the overlay, which is still there and still clickable.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !onClient) return null;

  /*
   * Rendered into <body> rather than in place. `position: fixed` escapes normal
   * flow but `z-index` does not escape a stacking context, and this dialog is
   * opened from inside one (the landing hero isolates itself so its blurred
   * brand wash cannot bleed). Left where it sits, `z-50` is scoped to that
   * section and every section after it paints straight over the overlay.
   */
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 animate-[modalFade_180ms_ease-out] bg-overlay backdrop-blur-[2px]"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative w-full max-w-md outline-none sm:max-w-[22.5rem]",
          "border-t border-border bg-surface-raised shadow-raised sm:border",
          "rounded-t-sheet sm:rounded-sheet",
          "px-5 pt-3 pb-safe",
          "animate-[modalRise_260ms_cubic-bezier(0.22,1,0.36,1)]",
          "sm:animate-[modalPop_200ms_cubic-bezier(0.22,1,0.36,1)]",
          className,
        )}
      >
        {/* Grab handle: the phone-shaped affordance. A centred card does not
            read as draggable, so it goes away at the same breakpoint. */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-pill bg-border-strong sm:hidden" />

        <div className="mb-4 flex items-center justify-between gap-3 sm:mt-2">
          <h2 id={titleId} className="text-lg font-semibold text-content">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-pill text-content-subtle transition-colors hover:bg-surface-hover hover:text-content"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {children}
      </div>

      <style>{`
        @keyframes modalFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalRise {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
