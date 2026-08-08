import { cn } from "@/lib/cn";

export function Md3Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container-high)]",
        className,
      )}
      aria-hidden
    />
  );
}

export function Md3PipelineBoardSkeleton() {
  return (
    <div className="md3-pipeline-board">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="md3-pipeline-column flex flex-col gap-3">
          <div className="md3-pipeline-column-header">
            <Md3Skeleton className="h-3 w-20" />
            <Md3Skeleton className="h-5 w-6" />
          </div>
          <Md3Skeleton className="h-[88px] w-full rounded-[var(--md-sys-shape-corner-large-increased)]" />
          <Md3Skeleton className="h-[88px] w-full rounded-[var(--md-sys-shape-corner-large-increased)]" />
        </div>
      ))}
    </div>
  );
}

export function Md3InboxRowSkeleton() {
  return (
    <div className="md3-pipeline-list-row">
      <Md3Skeleton className="size-[22px] rounded-[var(--md-sys-shape-corner-extra-small)]" />
      <Md3Skeleton className="size-10 rounded-[var(--md-sys-shape-corner-full)]" />
      <div className="min-w-0 flex-1 space-y-2">
        <Md3Skeleton className="h-4 w-40" />
        <Md3Skeleton className="h-3 w-56" />
      </div>
      <Md3Skeleton className="hidden h-4 w-24 sm:block" />
      <Md3Skeleton className="h-7 w-16" />
      <Md3Skeleton className="h-4 w-12" />
      <Md3Skeleton className="h-8 w-16 rounded-[var(--md-sys-shape-corner-full)]" />
    </div>
  );
}
