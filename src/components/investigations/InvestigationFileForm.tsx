import { useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Field,
  GuardianFields,
  emptyGuardian,
  type GuardianFormData,
} from "@/components/members/MemberFields";
import {
  DocumentUploadFields,
  emptyDocPaths,
  type DocPathsState,
  type DocPreviewState,
} from "@/components/investigations/DocumentUploadFields";
import {
  digitsOnly,
  maskCpfInput,
  maskPhoneInput,
} from "@/lib/format";
import { lookupCep, maskCepInput, createCepLookupSeq } from "@/lib/cep";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";
import { Loader2 } from "lucide-react";
import type { IdDocKind } from "@/lib/member-documents";

export type InvestigationAddress = {
  zip: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
};

export type InvestigationFileFormValue = {
  candidate_name: string;
  candidate_birth_date: string;
  cpf: string;
  rg: string;
  candidate_email: string;
  candidate_phone: string;
  celular: string;
  address: InvestigationAddress;
  guardians: GuardianFormData[];
  sponsor_member_id: string | null;
  sponsor_text: string;
  sponsor_phone: string;
  has_demolay_relative: boolean;
  demolay_relative_name: string;
  demolay_relative_chapter: string;
  has_mason_relative: boolean;
  mason_relative_name: string;
  mason_relative_lodge: string;
  notes: string;
  docs: DocPathsState;
};

export const emptyInvestigationFile = (): InvestigationFileFormValue => ({
  candidate_name: "",
  candidate_birth_date: "",
  cpf: "",
  rg: "",
  candidate_email: "",
  candidate_phone: "",
  celular: "",
  address: {
    zip: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
  },
  guardians: [{ ...emptyGuardian }, { ...emptyGuardian }],
  sponsor_member_id: null,
  sponsor_text: "",
  sponsor_phone: "",
  has_demolay_relative: false,
  demolay_relative_name: "",
  demolay_relative_chapter: "",
  has_mason_relative: false,
  mason_relative_name: "",
  mason_relative_lodge: "",
  notes: "",
  docs: emptyDocPaths(),
});

type MemberOption = { id: string; full_name: string };

export function validateInvestigationForm(
  value: InvestigationFileFormValue,
  opts?: { keepCpf?: boolean; keepRg?: boolean },
): string | null {
  if (!value.candidate_name.trim()) return "Informe o nome do candidato";
  if (!value.candidate_birth_date) return "Informe a data de nascimento";
  if (!opts?.keepCpf && digitsOnly(value.cpf).length < 11) return "Informe o CPF";
  if (!opts?.keepRg && !value.rg.trim()) return "Informe o RG";
  if (!value.candidate_email.trim()) return "Informe o e-mail";
  if (!value.candidate_phone.trim()) return "Informe o telefone";
  if (!value.celular.trim()) return "Informe o celular";
  const a = value.address;
  if (
    !a.zip.trim() ||
    !a.street.trim() ||
    !a.number.trim() ||
    !a.neighborhood.trim() ||
    !a.city.trim() ||
    !a.state.trim()
  ) {
    return "Preencha o endereço completo";
  }
  const g0 = value.guardians[0];
  if (!g0?.full_name?.trim()) return "Informe o responsável";
  if (!g0?.relationship?.trim()) return "Informe o parentesco do responsável";
  if (!value.sponsor_member_id && !value.sponsor_text.trim()) {
    return "Informe o padrinho / indicado por";
  }
  if (value.has_demolay_relative) {
    if (!value.demolay_relative_name.trim() || !value.demolay_relative_chapter.trim()) {
      return "Preencha o parentesco DeMolay";
    }
  }
  if (value.has_mason_relative) {
    if (!value.mason_relative_name.trim() || !value.mason_relative_lodge.trim()) {
      return "Preencha o parentesco maçônico";
    }
  }
  for (const kind of Object.keys(value.docs) as IdDocKind[]) {
    if (!value.docs[kind]) return "Envie as imagens de Identidade (frente e verso)";
  }
  return null;
}

export function InvestigationFileForm({
  value,
  onChange,
  members = [],
  showSponsorSearch = true,
  publicLayout = false,
  docPreviews,
  uploadingDoc = null,
  onDocPick,
  onDocClear,
}: {
  value: InvestigationFileFormValue;
  onChange: (patch: Partial<InvestigationFileFormValue>) => void;
  members?: MemberOption[];
  showSponsorSearch?: boolean;
  publicLayout?: boolean;
  docPreviews?: DocPreviewState;
  uploadingDoc?: IdDocKind | null;
  onDocPick?: (kind: IdDocKind, file: File) => void | Promise<void>;
  onDocClear?: (kind: IdDocKind) => void;
}) {
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "error" | "ok">(
    "idle",
  );
  const [cepError, setCepError] = useState("");
  const lastLookedUp = useRef("");
  const cepSeq = useRef(createCepLookupSeq()).current;
  const valueRef = useRef(value);
  useIsomorphicLayoutEffect(() => {
    valueRef.current = value;
  });

  async function doLookupCep(raw: string) {
    const cep = digitsOnly(raw);
    if (cep.length !== 8 || cep === lastLookedUp.current) return;
    lastLookedUp.current = cep;
    const reqId = cepSeq.begin();
    setCepStatus("loading");
    setCepError("");
    try {
      const data = await lookupCep(raw);
      if (!cepSeq.isCurrent(reqId)) return;
      const current = valueRef.current;
      onChange({
        address: {
          ...current.address,
          zip: data.zip,
          street: data.street,
          neighborhood: data.neighborhood,
          city: data.city,
          state: data.state,
          country: data.country,
        },
      });
      setCepStatus("ok");
    } catch (e) {
      if (!cepSeq.isCurrent(reqId)) return;
      setCepStatus("error");
      setCepError(
        e instanceof Error ? e.message : "Não foi possível buscar o CEP",
      );
    }
  }

  function setGuardian(index: number, patch: Partial<GuardianFormData>) {
    const next = value.guardians.map((g, i) =>
      i === index ? { ...g, ...patch } : g,
    );
    while (next.length < 2) next.push({ ...emptyGuardian });
    onChange({ guardians: next.slice(0, 2) });
  }

  const sponsorText = value.sponsor_text || "";
  const filteredMembers =
    showSponsorSearch && sponsorText.trim().length >= 2
      ? members.filter((m) =>
          m.full_name.toLowerCase().includes(sponsorText.toLowerCase()),
        )
      : [];

  const inputClass = publicLayout ? "h-11" : undefined;
  const gap = publicLayout ? "gap-4" : "gap-3";
  const sectionSpace = publicLayout ? "space-y-4" : "space-y-3";
  const rootSpace = publicLayout ? "space-y-8" : "space-y-5";
  const guardianClass = publicLayout
    ? "space-y-4 rounded-[12px] border border-border/70 bg-muted/20 p-4 sm:p-5"
    : undefined;
  const guardianOptionalClass = publicLayout
    ? "space-y-4 rounded-[12px] border border-dashed border-border/70 bg-transparent p-4 sm:p-5"
    : undefined;

  return (
    <div className={rootSpace}>
      <section className={sectionSpace}>
        <SectionHeading publicLayout={publicLayout}>Candidato</SectionHeading>
        <Field label="Nome completo *">
          <Input
            value={value.candidate_name}
            onChange={(e) => onChange({ candidate_name: e.target.value })}
            maxLength={120}
            className={inputClass}
            required
          />
        </Field>
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${gap}`}>
          <Field label="Data de nascimento *">
            <Input
              type="date"
              value={value.candidate_birth_date}
              onChange={(e) =>
                onChange({ candidate_birth_date: e.target.value })
              }
              className={inputClass}
              required
            />
          </Field>
          <Field label="E-mail *">
            <Input
              type="email"
              value={value.candidate_email}
              onChange={(e) => onChange({ candidate_email: e.target.value })}
              className={inputClass}
              required
            />
          </Field>
          <Field label="CPF *">
            <Input
              value={value.cpf}
              onChange={(e) => onChange({ cpf: maskCpfInput(e.target.value) })}
              inputMode="numeric"
              className={inputClass}
              required
            />
          </Field>
          <Field label="RG *">
            <Input
              value={value.rg}
              onChange={(e) => onChange({ rg: e.target.value.slice(0, 20) })}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Telefone *">
            <Input
              value={value.candidate_phone}
              onChange={(e) =>
                onChange({ candidate_phone: maskPhoneInput(e.target.value) })
              }
              className={inputClass}
              required
            />
          </Field>
          <Field label="Celular *">
            <Input
              value={value.celular}
              onChange={(e) =>
                onChange({ celular: maskPhoneInput(e.target.value) })
              }
              className={inputClass}
              required
            />
          </Field>
        </div>
      </section>

      <section className={sectionSpace}>
        <SectionHeading publicLayout={publicLayout}>
          Documentos de identidade
        </SectionHeading>
        <p className="text-xs text-muted-foreground">
          Envie foto nítida da frente e do verso de cada documento.
        </p>
        <DocumentUploadFields
          paths={value.docs}
          previews={docPreviews ?? emptyDocPaths()}
          uploading={uploadingDoc}
          onPick={onDocPick ?? (async () => undefined)}
          onClear={onDocClear}
        />
      </section>

      <section className={sectionSpace}>
        <SectionHeading publicLayout={publicLayout}>Endereço</SectionHeading>
        <div
          className={`grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1.4fr)] ${gap}`}
        >
          <Field label="CEP *">
            <div className="relative">
              <Input
                value={value.address.zip}
                onChange={(e) => {
                  const masked = maskCepInput(e.target.value);
                  onChange({
                    address: { ...value.address, zip: masked },
                  });
                  const digits = digitsOnly(masked);
                  if (digits.length < 8) {
                    cepSeq.invalidate();
                    lastLookedUp.current = "";
                    setCepStatus("idle");
                    setCepError("");
                    return;
                  }
                  void doLookupCep(masked);
                }}
                className={inputClass}
                required
              />
              {cepStatus === "loading" && (
                <Loader2 className="absolute right-2 top-3 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {cepError && (
              <p className="mt-1 text-xs text-destructive">{cepError}</p>
            )}
          </Field>
          <Field label="UF *">
            <Input
              value={value.address.state}
              onChange={(e) =>
                onChange({
                  address: {
                    ...value.address,
                    state: e.target.value.toUpperCase().slice(0, 2),
                  },
                })
              }
              maxLength={2}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Cidade *">
            <Input
              value={value.address.city}
              onChange={(e) =>
                onChange({
                  address: { ...value.address, city: e.target.value },
                })
              }
              className={inputClass}
              required
            />
          </Field>
        </div>
        <Field label="Rua *">
          <Input
            value={value.address.street}
            onChange={(e) =>
              onChange({
                address: { ...value.address, street: e.target.value },
              })
            }
            className={inputClass}
            required
          />
        </Field>
        <div
          className={`grid grid-cols-1 sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] ${gap}`}
        >
          <Field label="Número *">
            <Input
              value={value.address.number}
              onChange={(e) =>
                onChange({
                  address: { ...value.address, number: e.target.value },
                })
              }
              className={inputClass}
              required
            />
          </Field>
          <Field label="Complemento">
            <Input
              value={value.address.complement}
              onChange={(e) =>
                onChange({
                  address: { ...value.address, complement: e.target.value },
                })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Bairro *">
            <Input
              value={value.address.neighborhood}
              onChange={(e) =>
                onChange({
                  address: { ...value.address, neighborhood: e.target.value },
                })
              }
              className={inputClass}
              required
            />
          </Field>
        </div>
      </section>

      <section className={sectionSpace}>
        <GuardianFields
          title="Responsável *"
          value={value.guardians[0] ?? emptyGuardian}
          onChange={(p) => setGuardian(0, p)}
          required
          className={guardianClass}
        />
      </section>

      <section className={sectionSpace}>
        <GuardianFields
          title="Responsável 2 (opcional)"
          value={value.guardians[1] ?? emptyGuardian}
          onChange={(p) => setGuardian(1, p)}
          className={guardianOptionalClass}
        />
      </section>

      <section className={sectionSpace}>
        <SectionHeading publicLayout={publicLayout}>
          Padrinho / Indicado por
        </SectionHeading>
        <p className="text-xs text-muted-foreground">
          Busque um membro cadastrado. Se não houver match, salve o nome nesta
          ficha.
        </p>
        <Field label="Nome *">
          <Input
            value={
              value.sponsor_member_id
                ? (members.find((m) => m.id === value.sponsor_member_id)
                    ?.full_name ?? sponsorText)
                : sponsorText
            }
            onChange={(e) => {
              onChange({
                sponsor_member_id: null,
                sponsor_text: e.target.value,
              });
            }}
            placeholder="Nome do padrinho"
            className={inputClass}
            required
          />
          {filteredMembers.length > 0 && !value.sponsor_member_id && (
            <ul className="mt-1 max-h-40 overflow-auto rounded-md border border-border bg-popover text-sm shadow-sm">
              {filteredMembers.slice(0, 8).map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left hover:bg-muted"
                    onClick={() => {
                      onChange({
                        sponsor_member_id: m.id,
                        sponsor_text: m.full_name,
                      });
                    }}
                  >
                    {m.full_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>
        {!value.sponsor_member_id && value.sponsor_text.trim() && (
          <Field label="Telefone do padrinho (opcional)">
            <Input
              value={value.sponsor_phone}
              onChange={(e) =>
                onChange({ sponsor_phone: maskPhoneInput(e.target.value) })
              }
              className={inputClass}
            />
          </Field>
        )}
      </section>

      <section className={sectionSpace}>
        <SectionHeading publicLayout={publicLayout}>Parentescos</SectionHeading>
        <div
          className={
            publicLayout
              ? "space-y-4 rounded-[12px] border border-border/70 bg-muted/20 p-4 sm:p-5"
              : "space-y-3"
          }
        >
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm font-medium">Parentesco com DeMolay</Label>
            <Switch
              checked={value.has_demolay_relative}
              onCheckedChange={(v) => onChange({ has_demolay_relative: v })}
            />
          </div>
          {value.has_demolay_relative && (
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${gap}`}>
              <Field label="Nome do parente *">
                <Input
                  value={value.demolay_relative_name}
                  onChange={(e) =>
                    onChange({ demolay_relative_name: e.target.value })
                  }
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Capítulo *">
                <Input
                  value={value.demolay_relative_chapter}
                  onChange={(e) =>
                    onChange({ demolay_relative_chapter: e.target.value })
                  }
                  className={inputClass}
                  required
                />
              </Field>
            </div>
          )}

          <div
            className={`flex items-center justify-between gap-3 ${publicLayout ? "border-t border-border/60 pt-4" : ""}`}
          >
            <Label className="text-sm font-medium">Parentesco com Maçom</Label>
            <Switch
              checked={value.has_mason_relative}
              onCheckedChange={(v) => onChange({ has_mason_relative: v })}
            />
          </div>
          {value.has_mason_relative && (
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${gap}`}>
              <Field label="Nome do parente *">
                <Input
                  value={value.mason_relative_name}
                  onChange={(e) =>
                    onChange({ mason_relative_name: e.target.value })
                  }
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Loja *">
                <Input
                  value={value.mason_relative_lodge}
                  onChange={(e) =>
                    onChange({ mason_relative_lodge: e.target.value })
                  }
                  className={inputClass}
                  required
                />
              </Field>
            </div>
          )}
        </div>
      </section>

      <section className={sectionSpace}>
        <SectionHeading publicLayout={publicLayout}>Observações</SectionHeading>
        <Field label="Observações">
          <Textarea
            value={value.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={3}
          />
        </Field>
      </section>
    </div>
  );
}

function SectionHeading({
  children,
  publicLayout,
}: {
  children: ReactNode;
  publicLayout?: boolean;
}) {
  if (!publicLayout) {
    return <h3 className="text-sm font-semibold">{children}</h3>;
  }
  return (
    <h3 className="border-b border-border/70 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </h3>
  );
}

export type { GuardianFormData };
