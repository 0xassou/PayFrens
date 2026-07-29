import {cn} from "@/lib/cn";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-content">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-content-subtle">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputStyles = cn(
  "w-full rounded-card border border-border bg-surface-sunken",
  "px-3.5 py-3 text-content placeholder:text-content-subtle",
  "transition-colors duration-150",
  "focus:border-accent focus:bg-surface focus:outline-none",
  // 16px minimum, or iOS Safari zooms the whole webview on focus.
  "text-base",
);

export function Input({className, ...props}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputStyles, className)} {...props} />;
}
