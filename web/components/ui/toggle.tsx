"use client";

import {useId} from "react";
import {cn} from "@/lib/cn";

/**
 * A switch, not a checkbox. A checkbox reads as "tick this to agree"; a switch
 * reads as "this setting is on or off", which is what a per-split contract flag
 * actually is — and the thumb sliding is legible at a glance on a phone in a
 * way a 16px tick is not.
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  /** Shown only while `checked`, for consequences that apply once switched on. */
  activeDescription,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  activeDescription?: string;
  className?: string;
}) {
  const descriptionId = useId();

  return (
    <div
      className={cn(
        "rounded-card border bg-surface p-3.5 transition-colors duration-200",
        checked ? "border-accent/40" : "border-border",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-sm font-medium text-content">{label}</span>
          {/* Only while off — leaving a "off by default" line under a switch
              that is visibly on reads as a contradiction. */}
          {description && !checked && (
            <span className="mt-0.5 block text-xs text-content-muted">{description}</span>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          aria-describedby={activeDescription && checked ? descriptionId : undefined}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative mt-0.5 h-7 w-12 shrink-0 rounded-pill",
            "transition-colors duration-200 ease-out-quint",
            checked ? "bg-accent" : "bg-border-strong",
          )}
        >
          <span
            className={cn(
              "absolute top-1 left-1 size-5 rounded-pill bg-white shadow-card",
              "transition-transform duration-200 ease-out-quint",
              checked ? "translate-x-5" : "translate-x-0",
            )}
          />
        </button>
      </div>

      {activeDescription && checked && (
        <p
          id={descriptionId}
          className="mt-2.5 rounded-[0.625rem] bg-accent-subtle px-3 py-2.5 text-xs leading-relaxed text-accent"
        >
          {activeDescription}
        </p>
      )}
    </div>
  );
}
