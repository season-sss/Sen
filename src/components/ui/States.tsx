import type { ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';

export function EmptyState({ icon, title, message, action, className }: { icon?: ReactNode; title: string; message?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-10 text-center', className)}>
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-lavender-soft text-lavender">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <h3 className="font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'เกิดข้อผิดพลาด', message, action }: { title?: string; message?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-danger/30 bg-danger/5 px-6 py-8 text-center" role="alert">
      <AlertTriangle className="mb-2 h-8 w-8 text-danger" />
      <h1 className="text-lg font-semibold">{title}</h1>
      {message && <p className="mt-1 max-w-md text-sm text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลด">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warning' | 'success' | 'danger'; children: ReactNode; className?: string }) {
  const tones = {
    info: 'border-sky/30 bg-sky-soft text-ink',
    warning: 'border-warning/30 bg-warning/10 text-ink',
    success: 'border-success/30 bg-success/10 text-ink',
    danger: 'border-danger/30 bg-danger/10 text-ink',
  };
  return <div className={cn('rounded-xl border px-4 py-3 text-sm', tones[tone], className)}>{children}</div>;
}
