"use client";

import {cn} from "@/lib/cn";
import {Spinner} from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "success" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-content shadow-accent hover:bg-accent-hover active:bg-accent-pressed",
  secondary:
    "bg-surface-sunken text-content border border-border hover:bg-surface-hover active:bg-surface-hover",
  ghost: "bg-transparent text-content-muted hover:bg-surface-hover hover:text-content",
  success: "bg-success text-success-content hover:opacity-90 active:opacity-80",
  danger: "bg-danger text-danger-content hover:opacity-90 active:opacity-80",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-[0.9375rem] gap-2",
  // 3.5rem clears the 44pt minimum comfortably — this is the "Pay my share"
  // button, and it is the whole point of the app.
  lg: "h-14 px-5 text-base gap-2",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      // A button mid-transaction must not be tappable twice.
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-pill font-semibold",
        "transition-all duration-200 ease-out-quint",
        "disabled:pointer-events-none disabled:opacity-45",
        // Slight squash on press: the only affordance a webview gives back.
        "active:scale-[0.98]",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className="size-4" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
