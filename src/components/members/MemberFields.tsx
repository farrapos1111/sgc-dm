import { useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { digitsOnly, maskCepInput, maskCpfInput, maskPhoneInput } from "@/lib/format";
import { Loader2 } from "lucide-react";

export type MemberStatus = "ativo" | "inativo" | "senior" | "macom";

export type MemberFormData = {
  full_name: string;
  birth_date: string;
  iniciacao_ordem: string;
  exam_grau_iniciatico: string;
  iniciacao_grau_demolay: string;
  exam_grau_demolay: string;
  status: MemberStatus;
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
  status: "ativo",
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

type BrasilApiCep = {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
};

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
}: {
  value: MemberFormData;
  onChange: (patch: Partial<MemberFormData>) => void;
  showPiiHint?: boolean;
}) {
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [cepError, setCepError] = useState("");
  const lastLookedUp = useRef("");

  async function lookupCep(raw: string) {
    const cep = digitsOnly(raw);
    if (cep.length !== 8 || cep === lastLookedUp.current) return;
    lastLookedUp.current = cep;
    setCepStatus("loading");
    setCepError("");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
      if (!res.ok) {
        setCepStatus("error");
        setCepError(res.status === 404 ? "CEP não encontrado" : "Não foi possível buscar o CEP");
        return;
      }
      const data = (await res.json()) as BrasilApiCep;
      onChange({
        address_zip: maskCepInput(data.cep || cep),
        address_street: data.street ?? "",
        address_neighborhood: data.neighborhood ?? "",
        address_city: data.city ?? "",
        address_state: (data.state ?? "").toUpperCase(),
        address_country: "Brasil",
      });
      setCepStatus("ok");
    } catch {
      setCepStatus("error");
      setCepError("Não foi possível buscar o CEP");
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
    void lookupCep(masked);
  }

  return (
    <div className="space-y-4">
      <Field label="Nome completo *">
        <Input value={value.full_name} onChange={(e) => onChange({ full_name: e.target.value })} maxLength={120} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Data de nascimento">
          <Input type="date" value={value.birth_date} onChange={(e) => onChange({ birth_date: e.target.value })} />
        </Field>
        <Field label="Status">
          <Select value={value.status} onValueChange={(v) => onChange({ status: v as MemberStatus })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
              <SelectItem value="senior">Senior DeMolay</SelectItem>
              <SelectItem value="macom">Maçom</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Iniciação à Ordem DeMolay">
          <Input
            type="date"
            value={value.iniciacao_ordem}
            onChange={(e) => onChange({ iniciacao_ordem: e.target.value })}
          />
        </Field>
        <Field label="Exame de Grau Iniciático">
          <Input
            type="date"
            value={value.exam_grau_iniciatico}
            onChange={(e) => onChange({ exam_grau_iniciatico: e.target.value })}
          />
        </Field>
        <Field label="Iniciação ao Grau DeMolay">
          <Input
            type="date"
            value={value.iniciacao_grau_demolay}
            onChange={(e) => onChange({ iniciacao_grau_demolay: e.target.value })}
          />
        </Field>
        <Field label="Exame de Grau DeMolay">
          <Input
            type="date"
            value={value.exam_grau_demolay}
            onChange={(e) => onChange({ exam_grau_demolay: e.target.value })}
          />
        </Field>
      </div>
      {value.exam_grau_iniciatico && !value.iniciacao_grau_demolay && (
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
                onBlur={() => void lookupCep(value.address_zip)}
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
}: {
  title: string;
  value: GuardianFormData;
  onChange: (patch: Partial<GuardianFormData>) => void;
  required?: boolean;
}) {
  const known = (GUARDIAN_RELATIONSHIPS as readonly string[]).includes(value.relationship);
  const relationshipOptions =
    value.relationship && !known
      ? [value.relationship, ...GUARDIAN_RELATIONSHIPS]
      : [...GUARDIAN_RELATIONSHIPS];

  return (
    <div className="space-y-4 rounded-[12px] border border-border p-4">
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
