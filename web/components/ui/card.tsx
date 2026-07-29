import {cn} from "@/lib/cn";

export function Card({
  raised = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {raised?: boolean}) {
  return (
    <div
      className={cn(
        "rounded-card border border-border p-4",
        raised ? "bg-surface-raised shadow-raised" : "bg-surface shadow-card",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({className, children}: {className?: string; children: React.ReactNode}) {
  return <div className={cn("mb-3 flex items-start justify-between gap-3", className)}>{children}</div>;
}

export function CardTitle({className, children}: {className?: string; children: React.ReactNode}) {
  return <h2 className={cn("text-base font-semibold text-content", className)}>{children}</h2>;
}

export function CardDescription({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <p className={cn("text-sm text-content-muted", className)}>{children}</p>;
}
