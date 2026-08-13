import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  auditSeverityLabel,
  type AuditSeverity,
} from "@/lib/audit-log";

export type AuditLogFilterState = {
  from: string;
  until: string;
  userId: string;
  severity: "" | AuditSeverity;
};

export const EMPTY_AUDIT_FILTERS: AuditLogFilterState = {
  from: "",
  until: "",
  userId: "",
  severity: "",
};

export function AuditLogFilterBar({
  value,
  onChange,
  users,
}: {
  value: AuditLogFilterState;
  onChange: (next: AuditLogFilterState) => void;
  users: Array<{ id: string; name: string }>;
}) {
  const hasFilters =
    !!value.from || !!value.until || !!value.userId || !!value.severity;

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2">
      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">De</Label>
        <Input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="w-[140px]"
        />
      </div>
      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">Até</Label>
        <Input
          type="date"
          value={value.until}
          onChange={(e) => onChange({ ...value, until: e.target.value })}
          className="w-[140px]"
        />
      </div>
      <div className="min-w-[160px]">
        <Label className="mb-1 block text-xs text-muted-foreground">
          Usuário
        </Label>
        <Select
          value={value.userId || "all"}
          onValueChange={(v) =>
            onChange({ ...value, userId: v === "all" ? "" : v })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-[150px]">
        <Label className="mb-1 block text-xs text-muted-foreground">
          Categoria
        </Label>
        <Select
          value={value.severity || "all"}
          onValueChange={(v) =>
            onChange({
              ...value,
              severity: v === "all" ? "" : (v as AuditSeverity),
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="leve">{auditSeverityLabel("leve")}</SelectItem>
            <SelectItem value="moderada">
              {auditSeverityLabel("moderada")}
            </SelectItem>
            <SelectItem value="grave">{auditSeverityLabel("grave")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(EMPTY_AUDIT_FILTERS)}
        >
          Limpar
        </Button>
      ) : null}
    </div>
  );
}

export function auditSeverityBadgeClass(severity: AuditSeverity): string {
  if (severity === "grave") {
    return "border-red-200 text-red-700 dark:border-red-800 dark:text-red-300";
  }
  if (severity === "moderada") {
    return "border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-300";
  }
  return "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300";
}
