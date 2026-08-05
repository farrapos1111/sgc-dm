import { useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { digitsOnly, is21OrOlder, isUnder21, maskCpfInput, maskPhoneInput } from "@/lib/format";
import { lookupCep, maskCepInput } from "@/lib/cep";
import { todayYmd } from "@/lib/timezone";
import { Loader2 } from "lucide-react";

export type MemberStatus = "regular" | "irregular";
export type MemberKind = "demolay_ativo" | "senior" | "macom";

export type MemberFormData = {
  full_name: string;
  birth_date: string;
  iniciacao_ordem: string;
  exam_grau_iniciatico: string;
  iniciacao_grau_demolay: string;
  exam_grau_demolay: string;
  demolay_id: string;
  masonic_id: string;
  /** Capítulo de iniciação (UUID). */
  initiation_chapter_id: string;
  status: MemberStatus;
  kind: MemberKind;
  /** Data efetiva: irregular desde / retorno à regularidade. */
  status_effective_on: string;
  cpf: string;
  rg: string;
  phone: string;
  email: string;
  address_zip: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_country: string;
};

export type GuardianFormData = {
  full_name: string;
  relationship: string;
  cpf: string;
  phone: string;
  email: string;
};

export const emptyMember: MemberFormData = {
  full_name: "",
  birth_date: "",
  iniciacao_ordem: "",
  exam_grau_iniciatico: "",
  iniciacao_grau_demolay: "",
  exam_grau_demolay: "",
  demolay_id: "",
  masonic_id: "",
  initiation_chapter_id: "",
  status: "regular",
  kind: "demolay_ativo",
  status_effective_on: "",
  cpf: "",
  rg: "",
  phone: "",
  email: "",
  address_zip: "",
  address_street: "",
  address_number: "",
  address_complement: "",
  address_neighborhood: "",
  address_city: "",
  address_state: "",
  address_country: "Brasil",
};

export type ChapterOption = {
  id: string;
  name: string;
  number: string;
  city?: string | null;
};

export const emptyGuardian: GuardianFormData = {
  full_name: "",
  relationship: "",
  cpf: "",
  phone: "",
  email: "",
};

export const GUARDIAN_RELATIONSHIPS = [
  "Mãe",
  "Pai",
  "Tutor",
  "Tutora",
  "Avô",
  "Avó",
  "Tio",
  "Tia",
  "Irmão",
  "Irmã",
  "Responsável legal",
  "Outro",
] as const;

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      {children}
    </div>
  );
}

export function MemberDataFields({
  value,
  onChange,
  showPiiHint,
  initialStatus,
  chapters = [],
  readOnlyMaster = false,
  demolayLookupStatus = "idle",
}: {
  value: MemberFormData;
  onChange: (patch: Partial<MemberFormData>) => void;
  showPiiHint?: boolean;
  /** Status ao abrir o formulário (para rótulo de retorno). */
  initialStatus?: MemberStatus;
  /** Capítulos para o select de iniciação. */
  chapters?: ChapterOption[];
  /** Bloqueia edição de dados mestres (membro de outro capítulo originário). */
  readOnlyMaster?: boolean;
  /** Feedback da busca automática por ID DeMolay. */
  demolayLookupStatus?: "idle" | "loading" | "found" | "not_found" | "already_affiliated";
}) {
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [cepError, setCepError] = useState("");
  const lastLookedUp = useRef("");

  async function doLookupCep(raw: string) {
    const cep = digitsOnly(raw);
    if (cep.length !== 8 || cep === lastLookedUp.current) return;
    lastLookedUp.current = cep;
    setCepStatus("loading");
    setCepError("");
    try {
      const data = await lookupCep(raw);
      onChange({
        address_zip: data.zip,
        address_street: data.street,
        address_neighborhood: data.neighborhood,
        address_city: data.city,
        address_state: data.state,
        address_country: data.country,
      });
      setCepStatus("ok");
    } catch (e) {
      setCepStatus("error");
      setCepError(e instanceof Error ? e.message : "Não foi possível buscar o CEP");
    }
  }

  function handleCepChange(raw: string) {
    const masked = maskCepInput(raw);
    onChange({ address_zip: masked });
    const digits = digitsOnly(masked);
    if (digits.length < 8) {
      lastLookedUp.current = "";
      setCepStatus("idle");
      setCepError("");
      return;
    }
    void doLookupCep(masked);
  }

  return (
    <div className="space-y-4">
      <Field label="Nome completo *">
        <Input
          value={value.full_name}
          onChange={(e) => onChange({ full_name: e.target.value })}
          maxLength={120}
          disabled={readOnlyMaster}
        />
      </Field>

      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
          value.kind === "macom" ? "lg:grid-cols-5" : "lg:grid-cols-4"
        }`}
      >
        <Field label="Nascimento">
          <Input
            type="date"
            value={value.birth_date}
            disabled={readOnlyMaster}
            onChange={(e) => {
              const birth_date = e.target.value;
              const patch: Partial<MemberFormData> = { birth_date };
              if (is21OrOlder(birth_date) && value.kind !== "macom") {
                patch.kind = "senior";
              } else if (isUnder21(birth_date) && value.kind === "senior") {
                patch.kind = "demolay_ativo";
              }
              onChange(patch);
            }}
          />
        </Field>
        <Field label="ID DeMolay">
          <Input
            value={value.demolay_id}
            placeholder="Número de identificação"
            onChange={(e) => onChange({ demolay_id: e.target.value.slice(0, 40) })}
          />
          {demolayLookupStatus === "loading" && (
            <p className="mt-1 text-xs text-muted-foreground">Buscando cadastro existente…</p>
          )}
          {demolayLookupStatus === "found" && (
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
              Membro encontrado — dados preenchidos automaticamente (somente leitura).
            </p>
          )}
          {demolayLookupStatus === "already_affiliated" && (
            <p className="mt-1 text-xs text-destructive">
              Este ID DeMolay já está vinculado a este capítulo.
            </p>
          )}
        </Field>
        {value.kind === "macom" && (
          <Field label="ID maçônica">
            <Input
              value={value.masonic_id}
              placeholder="Número de identificação"
              disabled={readOnlyMaster}
              onChange={(e) => onChange({ masonic_id: e.target.value.slice(0, 40) })}
            />
          </Field>
        )}
        <Field label="Status">
          <Select
            value={value.status}
            disabled={readOnlyMaster}
            onValueChange={(v) => {
              const status = v as MemberStatus;
              const patch: Partial<MemberFormData> = { status };
              if (!value.status_effective_on) {
                patch.status_effective_on = todayYmd();
              }
              onChange(patch);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="irregular">Irregular</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Tipo">
          <Select
            value={value.kind}
            disabled={readOnlyMaster}
            onValueChange={(v) => {
              let kind = v as MemberKind;
              if (kind === "demolay_ativo" && is21OrOlder(value.birth_date)) kind = "senior";
              onChange({ kind });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="demolay_ativo" disabled={is21OrOlder(value.birth_date)}>
                Demolay Ativo
              </SelectItem>
              <SelectItem value="senior">Senior Demolay</SelectItem>
              <SelectItem value="macom">Maçom</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Capítulo de Iniciação">
        <Select
          value={value.initiation_chapter_id || undefined}
          disabled={readOnlyMaster || chapters.length === 0}
          onValueChange={(v) => onChange({ initiation_chapter_id: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o capítulo" />
          </SelectTrigger>
          <SelectContent>
            {chapters.map((ch) => (
              <SelectItem key={ch.id} value={ch.id}>
                {ch.name}
                {ch.number ? ` Nº ${ch.number}` : ""}
                {ch.city ? ` — ${ch.city}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {(value.status === "irregular" ||
        (initialStatus === "irregular" && value.status === "regular")) && (
        <Field
          label={
            value.status === "irregular"
              ? "Irregular desde *"
              : "Retorno à regularidade *"
          }
        >
          <Input
            type="date"
            value={value.status_effective_on}
            onChange={(e) => onChange({ status_effective_on: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {value.status === "irregular"
              ? "Mensalidades em aberto a partir deste mês passam a Desligado."
              : "A partir deste mês as mensalidades voltam a ser cobradas; o período afastado permanece Desligado."}
          </p>
        </Field>
      )}
      {is21OrOlder(value.birth_date) && value.kind === "senior" && (
        <p className="text-xs text-muted-foreground">
          Com 21 anos ou mais, o tipo Demolay Ativo passa automaticamente a Senior Demolay.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Iniciação Ordem DeMolay">
          <Input
            type="date"
            value={value.iniciacao_ordem}
            onChange={(e) => onChange({ iniciacao_ordem: e.target.value })}
          />
        </Field>
        <Field label="Exame Grau Iniciático">
          <Input
            type="date"
            value={value.exam_grau_iniciatico}
            onChange={(e) => onChange({ exam_grau_iniciatico: e.target.value })}
          />
        </Field>
      </div>
      {!value.iniciacao_ordem && (
        <p className="text-xs text-muted-foreground">
          Sem data de iniciação à Ordem, o membro é considerado não DeMolay.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Iniciação Grau DeMolay">
          <Input
            type="date"
            value={value.iniciacao_grau_demolay}
            onChange={(e) => onChange({ iniciacao_grau_demolay: e.target.value })}
          />
        </Field>
        <Field label="Exame Grau DeMolay">
          <Input
            type="date"
            value={value.exam_grau_demolay}
            onChange={(e) => onChange({ exam_grau_demolay: e.target.value })}
          />
        </Field>
      </div>
      {value.iniciacao_ordem && value.exam_grau_iniciatico && !value.iniciacao_grau_demolay && (
        <p className="text-xs font-medium text-primary">
          Apto a G∴D∴ — exame de Grau Iniciático concluído, aguardando iniciação no Grau DeMolay.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="CPF">
          <Input
            value={value.cpf}
            placeholder="000.000.000-00"
            onChange={(e) => onChange({ cpf: maskCpfInput(e.target.value) })}
          />
        </Field>
        <Field label="RG">
          <Input value={value.rg} onChange={(e) => onChange({ rg: e.target.value.slice(0, 20) })} />
        </Field>
      </div>
      {showPiiHint && (
        <p className="text-xs text-muted-foreground">
          Deixe CPF e RG em branco para manter os valores já criptografados.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Telefone">
          <Input
            value={value.phone}
            placeholder="(00) 00000-0000"
            onChange={(e) => onChange({ phone: maskPhoneInput(e.target.value) })}
          />
        </Field>
        <Field label="Email">
          <Input type="email" value={value.email} onChange={(e) => onChange({ email: e.target.value })} />
        </Field>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="CEP">
            <div className="relative">
              <Input
                value={value.address_zip}
                placeholder="00000-000"
                inputMode="numeric"
                onChange={(e) => handleCepChange(e.target.value)}
                onBlur={() => void doLookupCep(value.address_zip)}
              />
              {cepStatus === "loading" && (
                <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          </Field>
          <Field label="Endereço">
            <Input
              value={value.address_street}
              placeholder="Rua, avenida…"
              onChange={(e) => onChange({ address_street: e.target.value })}
            />
          </Field>
          <Field label="Número">
            <Input
              value={value.address_number}
              placeholder="Nº"
              onChange={(e) => onChange({ address_number: e.target.value })}
            />
          </Field>
          <Field label="Complemento">
            <Input
              value={value.address_complement}
              placeholder="Apto, bloco…"
              onChange={(e) => onChange({ address_complement: e.target.value })}
            />
          </Field>
        </div>
        {cepError && <p className="text-xs text-destructive">{cepError}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="Bairro">
            <Input
              value={value.address_neighborhood}
              onChange={(e) => onChange({ address_neighborhood: e.target.value })}
            />
          </Field>
          <Field label="Cidade">
            <Input value={value.address_city} onChange={(e) => onChange({ address_city: e.target.value })} />
          </Field>
          <Field label="UF">
            <Input
              maxLength={2}
              value={value.address_state}
              onChange={(e) => onChange({ address_state: e.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="País">
            <Input
              value={value.address_country}
              onChange={(e) => onChange({ address_country: e.target.value })}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

export function GuardianFields({
  title,
  value,
  onChange,
  required,
  className,
}: {
  title: string;
  value: GuardianFormData;
  onChange: (patch: Partial<GuardianFormData>) => void;
  required?: boolean;
  className?: string;
}) {
  const known = (GUARDIAN_RELATIONSHIPS as readonly string[]).includes(value.relationship);
  const relationshipOptions =
    value.relationship && !known
      ? [value.relationship, ...GUARDIAN_RELATIONSHIPS]
      : [...GUARDIAN_RELATIONSHIPS];

  return (
    <div
      className={
        className ??
        "space-y-4 rounded-[12px] border border-border p-4"
      }
    >
      <h4 className="text-sm font-semibold">{title}</h4>
      <Field label={`Nome do responsável${required ? " *" : ""}`}>
        <Input value={value.full_name} onChange={(e) => onChange({ full_name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Parentesco">
          <Select
            value={value.relationship || undefined}
            onValueChange={(v) => onChange({ relationship: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {relationshipOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="CPF">
          <Input
            placeholder="000.000.000-00"
            value={value.cpf}
            onChange={(e) => onChange({ cpf: maskCpfInput(e.target.value) })}
          />
        </Field>
        <Field label="Telefone">
          <Input
            placeholder="(00) 00000-0000"
            value={value.phone}
            onChange={(e) => onChange({ phone: maskPhoneInput(e.target.value) })}
          />
        </Field>
        <Field label="Email">
          <Input type="email" value={value.email} onChange={(e) => onChange({ email: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}
