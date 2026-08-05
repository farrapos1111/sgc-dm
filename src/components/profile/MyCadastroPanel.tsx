import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import {
  getMyMemberCadastro,
  updateMyMemberCadastro,
  type MyCadastroGuardian,
  type MyCadastroMember,
} from "@/lib/profile.functions";
import {
  Field,
  GUARDIAN_RELATIONSHIPS,
} from "@/components/members/MemberFields";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { lookupCep, maskCepInput } from "@/lib/cep";

type EditableGuardian = {
  id: string;
  full_name: string;
  relationship: string;
  cpf: string;
  phone: string;
  email: string;
  cpf_last2: string | null;
};

export function MyCadastroPanel({ memberId }: { memberId: string }) {
  const qc = useQueryClient();
  const [member, setMember] = useState<MyCadastroMember | null>(null);
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
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "error" | "ok">(
    "idle",
  );
  const [cepError, setCepError] = useState("");
  const lastLookedUp = useRef("");
  const [done, setDone] = useState(false);

  const { isLoading, error, data } = useQuery({
    queryKey: ["my-cadastro", memberId],
    queryFn: () => getMyMemberCadastro({ data: { memberId } }),
  });

  useEffect(() => {
    if (!data) return;
    setDone(false);
    setMember(data.member);
    setPhone(data.member.phone ?? "");
    setEmail(data.member.email ?? "");
    setCpf("");
    setRg("");
    const addr = data.member.address ?? {};
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
        ? (data.guardians ?? []).slice(0, 2).map((g: MyCadastroGuardian) => ({
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
  }, [data]);

  const save = useMutation({
    mutationFn: () => {
      if (!member) throw new Error("Cadastro não carregado");
      return updateMyMemberCadastro({
        data: {
          memberId,
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
      qc.invalidateQueries({ queryKey: ["my-cadastro", memberId] });
      qc.invalidateQueries({ queryKey: ["my-demolay-profile"] });
      if (res.changed) {
        toast.success("Cadastro atualizado");
      } else {
        toast.message("Nenhuma alteração detectada");
      }
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar"),
  });

  async function doLookupCep(raw: string) {
    const cep = digitsOnly(raw);
    if (cep.length !== 8 || cep === lastLookedUp.current) return;
    lastLookedUp.current = cep;
    setCepStatus("loading");
    setCepError("");
    try {
      const result = await lookupCep(raw);
      setAddress((a) => ({
        ...a,
        zip: result.zip,
        street: result.street,
        neighborhood: result.neighborhood,
        city: result.city,
        state: result.state,
        country: result.country,
      }));
      setCepStatus("ok");
    } catch (e) {
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
      lastLookedUp.current = "";
      setCepStatus("idle");
      setCepError("");
      return;
    }
    void doLookupCep(masked);
  }

  function patchGuardian(id: string, patch: Partial<EditableGuardian>) {
    setGuardians((list) =>
      list.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    );
  }

  if (isLoading) {
    return (
      <Card className="flex justify-center rounded-[12px] p-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  }

  if (error || !member) {
    return (
      <Card className="rounded-[12px] p-5 text-sm text-destructive">
        {error instanceof Error
          ? error.message
          : "Não foi possível carregar o cadastro"}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 rounded-[12px] p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">{member.full_name}</h3>
            <p className="text-sm text-muted-foreground">
              {member.chapter_name ?? "Capítulo"}
              {member.demolay_id ? ` · ID ${member.demolay_id}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{kindLabel(member.kind)}</Badge>
            <Badge variant="secondary">{statusLabel(member.status)}</Badge>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <ReadonlyRow label="Nascimento" value={formatDateBR(member.birth_date)} />
          <ReadonlyRow label="ID maçônico" value={member.masonic_id || "—"} />
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
        <p className="text-xs text-muted-foreground">
          Datas e graus são somente leitura. Solicite alteração à secretaria do
          capítulo originário se necessário.
        </p>
      </Card>

      <Card className="space-y-4 rounded-[12px] p-5">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Dados editáveis
        </h3>
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
                onChange={(e) =>
                  setAddress((a) => ({ ...a, street: e.target.value }))
                }
              />
            </Field>
            <Field label="Número">
              <Input
                value={address.number}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, number: e.target.value }))
                }
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
          {cepError ? (
            <p className="text-xs text-destructive">{cepError}</p>
          ) : null}
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
                onChange={(e) =>
                  setAddress((a) => ({ ...a, city: e.target.value }))
                }
              />
            </Field>
            <Field label="UF">
              <Input
                maxLength={2}
                value={address.state}
                onChange={(e) =>
                  setAddress((a) => ({
                    ...a,
                    state: e.target.value.toUpperCase(),
                  }))
                }
              />
            </Field>
            <Field label="País">
              <Input
                value={address.country}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, country: e.target.value }))
                }
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
              <span className="ml-2 font-normal text-muted-foreground">
                {g.full_name}
              </span>
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Parentesco">
                <Select
                  value={g.relationship || undefined}
                  onValueChange={(v) =>
                    patchGuardian(g.id, { relationship: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(GUARDIAN_RELATIONSHIPS as readonly string[])
                      .concat(
                        g.relationship &&
                          !(
                            GUARDIAN_RELATIONSHIPS as readonly string[]
                          ).includes(g.relationship)
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
                  onChange={(e) =>
                    patchGuardian(g.id, { cpf: maskCpfInput(e.target.value) })
                  }
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={g.phone}
                  placeholder="(00) 00000-0000"
                  onChange={(e) =>
                    patchGuardian(g.id, {
                      phone: maskPhoneInput(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={g.email}
                  onChange={(e) =>
                    patchGuardian(g.id, { email: e.target.value })
                  }
                />
              </Field>
            </div>
          </Card>
        ))}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || done}
        >
          {save.isPending ? (
            "Salvando…"
          ) : done ? (
            <>
              <Check className="mr-2 h-4 w-4" /> Salvo
            </>
          ) : (
            "Salvar atualização"
          )}
        </Button>
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
