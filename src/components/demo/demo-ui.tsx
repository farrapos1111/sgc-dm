import type { ReactNode } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "./demo-data";

export function ScreenHeader({
  eyebrow,
  back,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  back?: { label: string; onClick: () => void };
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back ? (
          <button
            type="button"
            onClick={back.onClick}
            className="-ml-1 inline-flex min-h-8 items-center gap-1 text-sm text-tv-text-2 hover:text-tv-text"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {back.label}
          </button>
        ) : eyebrow ? (
          <p className="text-sm text-tv-text-2">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em] md:text-[32px]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-[15px] text-tv-text-2">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-[20px] bg-tv-surface p-5", className)}>{children}</div>;
}

export function SearchBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-[46px] flex-1 basis-[240px] items-center gap-2.5 rounded-[12px] border border-tv-border bg-tv-surface px-3.5">
      <Search className="h-[18px] w-[18px] text-tv-text-2" aria-hidden />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className="min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-[#6B6E75]"
      />
    </label>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <>
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o)}
            className={cn(
              "min-h-[46px] rounded-[12px] border px-3.5 text-sm font-semibold",
              on
                ? "border-tv-text bg-tv-text text-tv-surface"
                : "border-[#DCDCD8] bg-tv-surface text-[#2A2C31] dark:border-tv-border dark:text-tv-text",
            )}
          >
            {o}
          </button>
        );
      })}
    </>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-[14px] bg-[#E9E9E5] p-1 dark:bg-tv-line"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === value}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-10 shrink-0 rounded-[10px] px-4 text-sm font-semibold",
            o.id === value
              ? "bg-tv-surface text-tv-text shadow-[0_1px_3px_rgba(20,20,20,0.12)]"
              : "text-[#4A4D54] dark:text-tv-text-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-[46px] items-center justify-center gap-2 rounded-[12px] bg-tv-primary px-4 text-[15px] font-semibold text-white disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SoftButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[46px] items-center justify-center gap-2 rounded-[12px] border border-tv-border bg-tv-surface px-3.5 text-sm font-semibold text-[#2A2C31] dark:text-tv-text",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "in" | "out" | "warn" | "brand";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "neutral" && "bg-tv-line text-[#3F4249] dark:text-tv-text",
        tone === "in" && "bg-tv-in-bg text-tv-in",
        tone === "out" && "bg-tv-out-bg text-tv-out",
        tone === "warn" && "bg-tv-warn-bg text-tv-warn",
        tone === "brand" && "bg-tv-soft text-tv-ink",
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-tv-soft font-bold text-tv-ink"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
