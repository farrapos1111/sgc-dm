import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { maskCpfInput, maskPhoneInput } from "@/lib/format";

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
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
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
  address_street: "",
  address_city: "",
  address_state: "",
  address_zip: "",
};

export const emptyGuardian: GuardianFormData = {
  full_name: "",
  relationship: "",
  cpf: "",
  phone: "",
  email: "",
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
      <p className="text-xs text-muted-foreground">Somente membros com grau DM podem assumir cargos do capítulo.</p>

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
      <Field label="Endereço">
        <Textarea
          value={value.address_street}
          placeholder="Rua, número, bairro…"
          onChange={(e) => onChange({ address_street: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-3 gap-4">
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
        <Field label="CEP">
          <Input value={value.address_zip} onChange={(e) => onChange({ address_zip: e.target.value })} />
        </Field>
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
  return (
    <div className="space-y-4 rounded-[12px] border border-border p-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      <Field label={`Nome do responsável${required ? " *" : ""}`}>
        <Input value={value.full_name} onChange={(e) => onChange({ full_name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Parentesco">
          <Input
            placeholder="Ex: mãe, pai, tutor"
            value={value.relationship}
            onChange={(e) => onChange({ relationship: e.target.value })}
          />
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
