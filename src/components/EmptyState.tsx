import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[20px] bg-tv-surface px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[16px] bg-tv-soft text-tv-primary">
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <h3 className="text-[17px] font-bold text-tv-text">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-[15px] text-tv-text-2">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
