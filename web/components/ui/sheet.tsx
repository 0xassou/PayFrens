"use client";

import {useEffect} from "react";
import {cn} from "@/lib/cn";

/**
 * Bottom sheet — the confirmation surface for anything that costs money. Slides
 * up from the thumb rather than appearing centred, because on a phone the
 * bottom of the screen is where decisions get made.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  // A sheet over a scrolling list that keeps scrolling underneath feels broken.
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-overlay backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative w-full max-w-md",
          "rounded-t-sheet border-t border-border bg-surface-raised",
          "px-5 pt-3 pb-safe shadow-raised",
          "animate-[slideUp_260ms_cubic-bezier(0.22,1,0.36,1)]",
          className,
        )}
      >
        {/* Grab handle — signals "this is draggable/dismissable" even though the
            tap target is the backdrop. */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-pill bg-border-strong" />

        {title && <h2 className="mb-4 text-lg font-semibold text-content">{title}</h2>}

        {children}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
