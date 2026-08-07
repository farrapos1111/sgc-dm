import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type Term } from "@/lib/terms";

const SEMESTER_LABELS: Record<1 | 2, string> = {
  1: "1º semestre",
  2: "2º semestre",
};

export function TermSelect({
  value,
  terms,
  onChange,
  className,
  yearClassName,
  semesterClassName,
  disabled,
}: {
  value: Term;
  terms: Term[];
  onChange: (term: Term) => void;
  className?: string;
  yearClassName?: string;
  semesterClassName?: string;
  disabled?: boolean;
}) {
  const years = useMemo(() => {
    const set = new Set(terms.map((t) => t.year));
    if (!set.has(value.year)) set.add(value.year);
    return [...set].sort((a, b) => b - a);
  }, [terms, value.year]);

  const semesters = useMemo(() => {
    const set = new Set(
      terms.filter((t) => t.year === value.year).map((t) => t.semester),
    );
    if (set.size === 0) {
      set.add(1);
      set.add(2);
    } else if (!set.has(value.semester)) {
      set.add(value.semester);
    }
    return ([...set] as (1 | 2)[]).sort((a, b) => a - b);
  }, [terms, value.year, value.semester]);

  function setYear(year: number) {
    const available = terms.filter((t) => t.year === year);
    const keep = available.find((t) => t.semester === value.semester);
    onChange(keep ?? available[0] ?? { year, semester: value.semester });
  }

  function setSemester(semester: 1 | 2) {
    const match = terms.find(
      (t) => t.year === value.year && t.semester === semester,
    );
    onChange(match ?? { year: value.year, semester });
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Select
        value={String(value.year)}
        onValueChange={(v) => setYear(Number(v))}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn("h-9 w-[5.5rem] shrink-0", yearClassName)}
          aria-label="Ano"
        >
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(value.semester)}
        onValueChange={(v) => setSemester(Number(v) as 1 | 2)}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn("h-9 min-w-[8.5rem] flex-1", semesterClassName)}
          aria-label="Semestre"
        >
          <SelectValue placeholder="Semestre" />
        </SelectTrigger>
        <SelectContent>
          {semesters.map((s) => (
            <SelectItem key={s} value={String(s)}>
              {SEMESTER_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
