"use client";

import {cn} from "@/lib/cn";
import {useTheme, type ThemePreference} from "./theme-provider";

const OPTIONS: Array<{value: ThemePreference; label: string; icon: React.ReactNode}> = [
  {value: "system", label: "System", icon: <PhoneIcon />},
  {value: "light", label: "Light", icon: <SunIcon />},
  {value: "dark", label: "Dark", icon: <MoonIcon />},
];

/**
 * Three states rather than two, so "follow my phone" stays reachable. A plain
 * on/off toggle silently strands people on whichever theme they tapped last.
 */
export function ThemeToggle({className}: {className?: string}) {
  const {preference, setPreference} = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-pill border border-border bg-surface-sunken p-0.5",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            onClick={() => setPreference(option.value)}
            className={cn(
              "flex size-8 items-center justify-center rounded-pill",
              "transition-colors duration-200",
              active
                ? "bg-surface text-content shadow-card"
                : "text-content-subtle hover:text-content-muted",
            )}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2.75v2M12 19.25v2M2.75 12h2M19.25 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
      <path
        d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
      <rect
        x="6.75"
        y="2.75"
        width="10.5"
        height="18.5"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M10.5 18.25h3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
