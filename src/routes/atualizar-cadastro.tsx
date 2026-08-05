import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Check } from "lucide-react";
import {
  lookupMemberCadastro,
  submitMemberCadastro,
  type CadastroLookupGuardian,
  type CadastroLookupMember,
} from "@/lib/cadastro.functions";
import {
  Field,
  GUARDIAN_RELATIONSHIPS,
} from "@/components/members/MemberFields";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  digitsOnly,
  formatCpfMask,
  formatDateBR,
  formatRgMask,
  isUnder21,
  kindLabel,
  maskCpfInput,
  maskPhoneInput,
  statusLabel,
} from "@/lib/format";
import { lookupCep, maskCepInput, createCepLookupSeq } from "@/lib/cep";

export const Route = createFileRoute("/atualizar-cadastro")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Atualização cadastral — SG-CDM" },
      {
        name: "description",
        content: "Atualize telefone, e-mail, endereço e dados dos responsáveis com seu ID DeMolay.",
      },
    ],
  }),
  component: AtualizarCadastroPage,
});

type EditableGuardian = {
  id: string;
  full_name: string;
  relationship: string;
  cpf: string;
  phone: string;
  email: string;
  cpf_last2: string | null;
};

function AtualizarCadastroPage() {
  const [demolayId, setDemolayId] = useState("");
  const [member, setMember] = useState<CadastroLookupMember | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [address, setAddress] = useState({
    zip: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
  });
  const [guardians, setGuardians] = useState<EditableGuardian[]>([]);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [cepError, setCepError] = useState("");
  const lastLookedUp = useRef("");
  const cepSeq = useRef(createCepLookupSeq()).current;
  const [done, setDone] = useState(false);

  const lookup = useMutation({
    mutationFn: () => lookupMemberCadastro({ data: { demolayId: demolayId.trim() } }),
    onSuccess: (data) => {
      setDone(false);
      setMember(data.member);
      setPhone(data.member.phone ?? "");
      setEmail(data.member.email ?? "");
      setCpf("");
      setRg("");
      const addr = (data.member.address ?? {}) as Record<string, string>;
      setAddress({
        zip: maskCepInput(addr.zip ?? ""),
        street: addr.street ?? "",
        number: addr.number ?? "",
        complement: addr.complement ?? "",
        neighborhood: addr.neighborhood ?? "",
        city: addr.city ?? "",
        state: addr.state ?? "",
        country: addr.country ?? "Brasil",
      });
      setGuardians(
        isUnder21(data.member.birth_date)
          ? (data.guardians ?? []).slice(0, 2).map((g: CadastroLookupGuardian) => ({
              id: g.id,
              full_name: g.full_name,
              relationship: g.relationship ?? "",
              cpf: "",
              phone: g.phone ?? "",
              email: g.email ?? "",
              cpf_last2: g.cpf_last2,
            }))
          : [],
      );
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível localizar o membro"),
  });

  const save = useMutation({
    mutationFn: () => {
      if (!member) throw new Error("Busque o membro primeiro");
      return submitMemberCadastro({
        data: {
          demolayId: member.demolay_id || demolayId.trim(),
          phone,
          email,
          address,
          cpf,
          rg,
          guardians: isUnder21(member.birth_date)
            ? guardians.map((g) => ({
                id: g.id,
                relationship: g.relationship,
                cpf: g.cpf,
                phone: g.phone,
                email: g.email,
              }))
            : [],
        },
      });
    },
    onSuccess: (res) => {
      setDone(true);
      if (res.changed) {
        toast.success("Cadastro atualizado. A secretaria receberá o registro da alteração.");
      } else {
        toast.message("Nenhuma alteração detectada.");
      }
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar"),
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
      setAddress((a) => ({
        ...a,
        zip: data.zip,
        street: data.street,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        country: data.country,
      }));
      setCepStatus("ok");
    } catch (e) {
      if (!cepSeq.isCurrent(reqId)) return;
      setCepStatus("error");
      setCepError(
        e instanceof Error ? e.message : "Não foi possível buscar o CEP",
      );
    }
  }

  function handleCepChange(raw: string) {
    const masked = maskCepInput(raw);
    setAddress((a) => ({ ...a, zip: masked }));
    const digits = digitsOnly(masked);
    if (digits.length < 8) {
      cepSeq.invalidate();
      lastLookedUp.current = "";
      setCepStatus("idle");
      setCepError("");
      return;
    }
    void doLookupCep(masked);
  }

  function patchGuardian(id: string, patch: Partial<EditableGuardian>) {
    setGuardians((list) => list.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  return (
    <div
      className="min-h-screen bg-[#E9E8E3] px-4 py-8 dark:bg-background"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl"
            style={{ backgroundColor: "#9E1B32" }}
          >
            <span className="text-xl font-bold tracking-wider text-white">SG</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Atualização cadastral</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Informe seu ID DeMolay para revisar seus dados e atualizar contato, endereço e
            responsáveis.
          </p>
        </div>

        <Card className="space-y-4 rounded-[12px] p-5">
          <div>
            <Label className="mb-1.5 block text-sm">ID DeMolay</Label>
            <div className="flex gap-2">
              <Input
                value={demolayId}
                placeholder="Ex.: 123456"
                onChange={(e) => setDemolayId(e.target.value.slice(0, 40))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    lookup.mutate();
                  }
                }}
              />
              <Button
                type="button"
                onClick={() => lookup.mutate()}
                disabled={lookup.isPending || demolayId.trim().length < 3}
                style={{ backgroundColor: "#9E1B32" }}
              >
                {lookup.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" /> Buscar
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {member && (
          <>
            <Card className="space-y-3 rounded-[12px] p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{member.full_name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {member.chapter_name ?? "Capítulo"} · ID {member.demolay_id}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{kindLabel(member.kind)}</Badge>
                  <Badge variant="secondary">{statusLabel(member.status)}</Badge>
                </div>
              </div>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <ReadonlyRow label="Nascimento" value={formatDateBR(member.birth_date)} />
                <ReadonlyRow label="ID maçônica" value={member.masonic_id || "—"} />
                <ReadonlyRow
                  label="Iniciação OD"
                  value={formatDateBR(member.iniciacao_ordem)}
                />
                <ReadonlyRow
                  label="Exame GI"
                  value={formatDateBR(member.exam_grau_iniciatico)}
                />
                <ReadonlyRow
                  label="Iniciação GD"
                  value={formatDateBR(member.iniciacao_grau_demolay)}
                />
                <ReadonlyRow
                  label="Exame GD"
                  value={formatDateBR(member.exam_grau_demolay)}
                />
              </dl>
            </Card>

            <Card className="space-y-4 rounded-[12px] p-5">
              <h3 className="text-sm font-semibold text-muted-foreground">Dados editáveis</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Telefone">
                  <Input
                    value={phone}
                    placeholder="(00) 00000-0000"
                    onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field label="CPF">
                  <Input
                    value={cpf}
                    placeholder={formatCpfMask(member.cpf_last2)}
                    onChange={(e) => setCpf(maskCpfInput(e.target.value))}
                  />
                </Field>
                <Field label="RG">
                  <Input
                    value={rg}
                    placeholder={formatRgMask(member.rg_last2)}
                    onChange={(e) => setRg(e.target.value.slice(0, 20))}
                  />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe CPF e RG em branco para manter os valores já cadastrados.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <Field label="CEP">
                    <div className="relative">
                      <Input
                        value={address.zip}
                        placeholder="00000-000"
                        inputMode="numeric"
                        onChange={(e) => handleCepChange(e.target.value)}
                        onBlur={() => void doLookupCep(address.zip)}
                      />
                      {cepStatus === "loading" && (
                        <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </Field>
                  <Field label="Endereço">
                    <Input
                      value={address.street}
                      onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))}
                    />
                  </Field>
                  <Field label="Número">
                    <Input
                      value={address.number}
                      onChange={(e) => setAddress((a) => ({ ...a, number: e.target.value }))}
                    />
                  </Field>
                  <Field label="Complemento">
                    <Input
                      value={address.complement}
                      onChange={(e) =>
                        setAddress((a) => ({ ...a, complement: e.target.value }))
                      }
                    />
                  </Field>
                </div>
                {cepError && <p className="text-xs text-destructive">{cepError}</p>}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <Field label="Bairro">
                    <Input
                      value={address.neighborhood}
                      onChange={(e) =>
                        setAddress((a) => ({ ...a, neighborhood: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Cidade">
                    <Input
                      value={address.city}
                      onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                    />
                  </Field>
                  <Field label="UF">
                    <Input
                      maxLength={2}
                      value={address.state}
                      onChange={(e) =>
                        setAddress((a) => ({ ...a, state: e.target.value.toUpperCase() }))
                      }
                    />
                  </Field>
                  <Field label="País">
                    <Input
                      value={address.country}
                      onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value }))}
                    />
                  </Field>
                </div>
              </div>
            </Card>

            {isUnder21(member.birth_date) &&
              guardians.map((g, idx) => (
              <Card key={g.id} className="space-y-4 rounded-[12px] p-5">
                <h3 className="text-sm font-semibold">
                  Responsável {idx + 1}
                  <span className="ml-2 font-normal text-muted-foreground">{g.full_name}</span>
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Parentesco">
                    <Select
                      value={g.relationship || undefined}
                      onValueChange={(v) => patchGuardian(g.id, { relationship: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {(GUARDIAN_RELATIONSHIPS as readonly string[])
                          .concat(
                            g.relationship &&
                              !(GUARDIAN_RELATIONSHIPS as readonly string[]).includes(
                                g.relationship,
                              )
                              ? [g.relationship]
                              : [],
                          )
                          .map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="CPF">
                    <Input
                      value={g.cpf}
                      placeholder={formatCpfMask(g.cpf_last2)}
                      onChange={(e) => patchGuardian(g.id, { cpf: maskCpfInput(e.target.value) })}
                    />
                  </Field>
                  <Field label="Telefone">
                    <Input
                      value={g.phone}
                      placeholder="(00) 00000-0000"
                      onChange={(e) =>
                        patchGuardian(g.id, { phone: maskPhoneInput(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={g.email}
                      onChange={(e) => patchGuardian(g.id, { email: e.target.value })}
                    />
                  </Field>
                </div>
              </Card>
            ))}

            <div className="flex justify-end gap-2 pb-8">
              <Button
                type="button"
                onClick={() => save.mutate()}
                disabled={save.isPending || done}
                style={{ backgroundColor: "#9E1B32" }}
              >
                {save.isPending ? (
                  "Salvando…"
                ) : done ? (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Enviado
                  </>
                ) : (
                  "Salvar atualização"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
