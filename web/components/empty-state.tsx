export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-pill bg-accent-subtle text-accent">
        <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden="true">
          <path
            d="M4 8.5h16M4 8.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5M4 8.5 6.2 4.8A1.5 1.5 0 0 1 7.5 4h9a1.5 1.5 0 0 1 1.3.8L20 8.5M12 12v4M10 14h4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-content">{title}</h2>
      <p className="max-w-[26ch] text-sm text-content-muted">{description}</p>
      {action}
    </div>
  );
}
