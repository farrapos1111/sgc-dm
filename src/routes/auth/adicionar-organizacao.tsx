import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACTIVE_MEMBERS_BANDS,
  getOrgJoinCatalog,
  orgJoinRequestSchema,
  submitOrgJoinRequest,
  type ActiveMembersBand,
  type OrgJoinCatalog,
  type OrgJoinType,
  type OrgJoinTypeDef,
} from "@/lib/org-join-request.functions";
import { needsSponsor, sponsorFieldLabel } from "@/lib/org-types";
import {
  createCepLookupSeq,
  digitsOnly,
  lookupCep,
  maskCepInput,
} from "@/lib/cep";

export const Route = createFileRoute("/auth/adicionar-organizacao")({
  ssr: false,
  head: () => ({
    meta: [
      {
        title: "Adicionar organização — Templo Virtual",
      },
      {
        name: "description",
        content: "Solicite a inclusão da sua organização no Templo Virtual.",
      },
    ],
  }),
  component: AdicionarOrganizacaoPage,
});

const PLATFORM_BLUE = "#072D5A";
const RING = { ["--tw-ring-color" as string]: PLATFORM_BLUE };

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background";

function composeFullAddress(parts: {
  zip: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}): string {
  const line1 = [parts.street.trim(), parts.number.trim()]
    .filter(Boolean)
    .join(", ");
  const line2 = [parts.complement.trim(), parts.neighborhood.trim()]
    .filter(Boolean)
    .join(" — ");
  const line3 = [parts.city.trim(), parts.state.trim()]
    .filter(Boolean)
    .join("/");
  const cep = parts.zip.trim() ? `CEP ${parts.zip.trim()}` : "";
  return [line1, line2, line3, cep].filter(Boolean).join(". ");
}

function Field({
  label,
  htmlFor,
  children,
  error,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  error?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-medium text-foreground"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-0.5 text-[11px] text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function AdicionarOrganizacaoPage() {
  const [catalog, setCatalog] = useState<OrgJoinCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [potenciaId, setPotenciaId] = useState("");
  const [orgType, setOrgType] = useState<OrgJoinType>("capitulo");
  const [orgTypeOther, setOrgTypeOther] = useState("");
  const [nameNumber, setNameNumber] = useState("");
  const [foundedOn, setFoundedOn] = useState("");
  const [activeMembersBand, setActiveMembersBand] =
    useState<ActiveMembersBand>("10-25");
  const [sponsoringLodge, setSponsoringLodge] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [responsiblePhone, setResponsiblePhone] = useState("");
  const [responsibleEmail, setResponsibleEmail] = useState("");
  const [responsibleRole, setResponsibleRole] = useState("");

  const [zip, setZip] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [cepStatus, setCepStatus] = useState<
    "idle" | "loading" | "error" | "ok"
  >("idle");
  const [cepError, setCepError] = useState("");
  const lastLookedUp = useRef("");
  const cepSeq = useRef(createCepLookupSeq()).current;

  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOrgJoinCatalog()
      .then((data) => {
        if (cancelled) return;
        setCatalog(data);
        if (data.org_types[0]) {
          setOrgType(data.org_types[0].org_type);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setCatalogError(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar o catálogo",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isLoja = orgType === "loja";
  const catalogLoading = catalog === null && !catalogError;
  const lodgePotencias = useMemo(
    () =>
      (catalog?.potencias ?? []).filter(
        (p) => p.org_types.length === 0 || p.org_types.includes("loja"),
      ),
    [catalog],
  );
  const noLodgePotencias = catalog !== null && lodgePotencias.length === 0;

  const availableTypes = useMemo(
    () => (catalog?.org_types ?? []) as OrgJoinTypeDef[],
    [catalog],
  );

  const typeDef = useMemo(
    () => availableTypes.find((t) => t.org_type === orgType) ?? null,
    [availableTypes, orgType],
  );

  const sponsorKind = typeDef?.form_schema.sponsor_kind ?? null;
  const needsLodge = needsSponsor(sponsorKind);
  const needsOther = orgType === "outro";

  useEffect(() => {
    if (availableTypes.length === 0) return;
    if (!availableTypes.some((t) => t.org_type === orgType)) {
      setOrgType(availableTypes[0].org_type);
    }
  }, [availableTypes, orgType]);

  useEffect(() => {
    if (!isLoja) {
      if (potenciaId) setPotenciaId("");
      return;
    }
    if (potenciaId && lodgePotencias.some((p) => p.id === potenciaId)) {
      return;
    }
    const first = lodgePotencias[0];
    setPotenciaId(first?.id ?? "");
  }, [isLoja, lodgePotencias, potenciaId]);

  const fullAddress = useMemo(
    () =>
      composeFullAddress({
        zip,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
      }),
    [zip, street, number, complement, neighborhood, city, state],
  );

  const payload = useMemo(
    () => ({
      orgType,
      orgTypeOther: needsOther ? orgTypeOther : null,
      potenciaId: isLoja ? potenciaId || null : null,
      nameNumber,
      fullAddress,
      foundedOn,
      activeMembersBand,
      sponsoringLodge: needsLodge ? sponsoringLodge : null,
      responsibleName,
      responsiblePhone,
      responsibleEmail,
      responsibleRole,
      sponsorKind,
    }),
    [
      orgType,
      orgTypeOther,
      needsOther,
      isLoja,
      potenciaId,
      nameNumber,
      fullAddress,
      foundedOn,
      activeMembersBand,
      needsLodge,
      sponsoringLodge,
      responsibleName,
      responsiblePhone,
      responsibleEmail,
      responsibleRole,
      sponsorKind,
    ],
  );

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
      setZip(data.zip);
      setStreet(data.street);
      setNeighborhood(data.neighborhood);
      setCity(data.city);
      setState(data.state);
      setCepStatus("ok");
    } catch (e) {
      if (!cepSeq.isCurrent(reqId)) return;
      setCepStatus("error");
      setCepError(
        e instanceof Error ? e.message : "Não foi possível buscar o CEP",
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!street.trim() || !city.trim() || !state.trim() || !zip.trim()) {
      setError("Informe o CEP e complete o endereço");
      setFieldErrors({ fullAddress: "Endereço incompleto" });
      return;
    }

    if (isLoja && catalogLoading) {
      setError("Aguarde o carregamento das potências");
      return;
    }
    if (isLoja && noLodgePotencias) {
      setFieldErrors({
        potenciaId: "Nenhuma potência disponível para loja",
      });
      setError("Nenhuma potência disponível para loja");
      return;
    }

    const parsed = orgJoinRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      setError(Object.values(next)[0] ?? "Revise os campos do formulário");
      return;
    }

    setSubmitting(true);
    try {
      await submitOrgJoinRequest({ data: parsed.data });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível enviar a solicitação",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-start justify-center bg-[#E9E8E3] px-4 py-6 dark:bg-background sm:items-center sm:py-8"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-3xl">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h1 className="text-base font-semibold text-foreground sm:text-lg">
            Quero Adicionar à Minha Organização
          </h1>

          {sent ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Solicitação enviada com sucesso. A Comissão de Tecnologia
                receberá os dados e entrará em contato pelo e-mail informado.
              </p>
              <Link
                to="/auth"
                search={{}}
                className="inline-flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: PLATFORM_BLUE }}
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-4 mt-1 text-xs text-muted-foreground sm:text-sm">
                Preencha os dados. Campos com * são obrigatórios.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                {catalogError ? (
                  <p className="text-sm text-destructive">{catalogError}</p>
                ) : null}

                <div
                  className={
                    isLoja ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : undefined
                  }
                >
                  <Field label="Tipo de organização *" htmlFor="org-type">
                    <select
                      id="org-type"
                      value={orgType}
                      onChange={(e) =>
                        setOrgType(e.target.value as OrgJoinType)
                      }
                      className={inputClass}
                      style={RING}
                    >
                      {availableTypes.map((t) => (
                        <option key={t.org_type} value={t.org_type}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {isLoja ? (
                    <Field
                      label="Potência *"
                      htmlFor="potencia"
                      error={fieldErrors.potenciaId}
                    >
                      <select
                        id="potencia"
                        value={potenciaId}
                        onChange={(e) => setPotenciaId(e.target.value)}
                        className={inputClass}
                        style={RING}
                        required
                        disabled={catalogLoading || noLodgePotencias}
                      >
                        {catalogLoading ? (
                          <option value="">Carregando…</option>
                        ) : noLodgePotencias ? (
                          <option value="">Indisponível</option>
                        ) : (
                          lodgePotencias.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sigla} — {p.nome}
                            </option>
                          ))
                        )}
                      </select>
                      {noLodgePotencias ? (
                        <p className="mt-0.5 text-[11px] text-destructive">
                          Nenhuma potência disponível para loja.
                        </p>
                      ) : null}
                    </Field>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {needsOther ? (
                    <Field
                      label="Especifique o tipo *"
                      htmlFor="org-type-other"
                      error={fieldErrors.orgTypeOther}
                    >
                      <input
                        id="org-type-other"
                        value={orgTypeOther}
                        onChange={(e) => setOrgTypeOther(e.target.value)}
                        className={inputClass}
                        style={RING}
                        placeholder="Ex.: Conselho de Pais"
                      />
                    </Field>
                  ) : null}

                  <Field
                    label="Nome e número da organização *"
                    htmlFor="org-name-number"
                    error={fieldErrors.nameNumber}
                    className={needsOther ? undefined : "sm:col-span-2"}
                  >
                    <input
                      id="org-name-number"
                      value={nameNumber}
                      onChange={(e) => setNameNumber(e.target.value)}
                      className={inputClass}
                      style={RING}
                      placeholder={
                        typeDef?.unit_label
                          ? `Ex.: ${typeDef.unit_label} Exemplo Nº 123`
                          : "Ex.: Nome Nº 123"
                      }
                      required
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label="Data de Fundação/Instalação *"
                    htmlFor="founded-on"
                    error={fieldErrors.foundedOn}
                  >
                    <input
                      id="founded-on"
                      type="date"
                      value={foundedOn}
                      onChange={(e) => setFoundedOn(e.target.value)}
                      className={inputClass}
                      style={RING}
                      required
                    />
                  </Field>
                  {needsLodge ? (
                    <Field
                      label={`${sponsorFieldLabel(sponsorKind)} *`}
                      htmlFor="sponsoring-lodge"
                      error={fieldErrors.sponsoringLodge}
                    >
                      <input
                        id="sponsoring-lodge"
                        value={sponsoringLodge}
                        onChange={(e) => setSponsoringLodge(e.target.value)}
                        className={inputClass}
                        style={RING}
                        placeholder={
                          sponsorKind === "capitulo"
                            ? "Nome/número do capítulo"
                            : "Nome da loja"
                        }
                        required
                      />
                    </Field>
                  ) : (
                    <div className="hidden sm:block" />
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Membros ativos *
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {ACTIVE_MEMBERS_BANDS.map((band) => (
                      <label
                        key={band}
                        className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border px-2 text-xs font-medium sm:text-sm"
                        style={
                          activeMembersBand === band
                            ? {
                                borderColor: PLATFORM_BLUE,
                                backgroundColor:
                                  "color-mix(in srgb, #072D5A 10%, transparent)",
                                color: PLATFORM_BLUE,
                              }
                            : undefined
                        }
                      >
                        <input
                          type="radio"
                          name="activeMembersBand"
                          value={band}
                          className="sr-only"
                          checked={activeMembersBand === band}
                          onChange={() => setActiveMembersBand(band)}
                        />
                        {band}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Endereço completo *
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
                    <Field
                      label="CEP *"
                      htmlFor="addr-zip"
                      className="sm:col-span-2"
                      error={fieldErrors.fullAddress}
                    >
                      <div className="relative">
                        <input
                          id="addr-zip"
                          value={zip}
                          onChange={(e) => {
                            const masked = maskCepInput(e.target.value);
                            setZip(masked);
                            if (digitsOnly(masked).length < 8) {
                              cepSeq.invalidate();
                              lastLookedUp.current = "";
                              setCepStatus("idle");
                              setCepError("");
                              return;
                            }
                            void doLookupCep(masked);
                          }}
                          className={inputClass}
                          style={RING}
                          placeholder="00000-000"
                          inputMode="numeric"
                          required
                        />
                        {cepStatus === "loading" ? (
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                            Buscando…
                          </span>
                        ) : null}
                      </div>
                      {cepError ? (
                        <p className="mt-0.5 text-[11px] text-destructive">
                          {cepError}
                        </p>
                      ) : null}
                    </Field>
                    <Field
                      label="Número do endereço"
                      htmlFor="addr-number"
                      className="sm:col-span-2"
                    >
                      <input
                        id="addr-number"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        className={inputClass}
                        style={RING}
                        placeholder="Nº"
                      />
                    </Field>
                    <Field
                      label="Complemento"
                      htmlFor="addr-complement"
                      className="sm:col-span-2"
                    >
                      <input
                        id="addr-complement"
                        value={complement}
                        onChange={(e) => setComplement(e.target.value)}
                        className={inputClass}
                        style={RING}
                        placeholder="Apto, sala…"
                      />
                    </Field>
                    <Field
                      label="Logradouro *"
                      htmlFor="addr-street"
                      className="sm:col-span-6"
                    >
                      <input
                        id="addr-street"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className={inputClass}
                        style={RING}
                        placeholder="Rua / Avenida"
                        required
                      />
                    </Field>
                    <Field
                      label="Bairro"
                      htmlFor="addr-neighborhood"
                      className="sm:col-span-2"
                    >
                      <input
                        id="addr-neighborhood"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        className={inputClass}
                        style={RING}
                      />
                    </Field>
                    <Field
                      label="Cidade *"
                      htmlFor="addr-city"
                      className="sm:col-span-3"
                    >
                      <input
                        id="addr-city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={inputClass}
                        style={RING}
                        required
                      />
                    </Field>
                    <Field
                      label="UF *"
                      htmlFor="addr-state"
                      className="sm:col-span-1"
                    >
                      <input
                        id="addr-state"
                        value={state}
                        onChange={(e) =>
                          setState(e.target.value.toUpperCase().slice(0, 2))
                        }
                        className={inputClass}
                        style={RING}
                        maxLength={2}
                        required
                      />
                    </Field>
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Responsável
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                      label="Nome *"
                      htmlFor="responsible-name"
                      error={fieldErrors.responsibleName}
                    >
                      <input
                        id="responsible-name"
                        value={responsibleName}
                        onChange={(e) => setResponsibleName(e.target.value)}
                        className={inputClass}
                        style={RING}
                        required
                      />
                    </Field>
                    <Field
                      label="Cargo (MC, VM, HR…) *"
                      htmlFor="responsible-role"
                      error={fieldErrors.responsibleRole}
                    >
                      <input
                        id="responsible-role"
                        value={responsibleRole}
                        onChange={(e) => setResponsibleRole(e.target.value)}
                        className={inputClass}
                        style={RING}
                        placeholder="Ex.: MC, VM, HR"
                        required
                      />
                    </Field>
                    <Field
                      label="Telefone *"
                      htmlFor="responsible-phone"
                      error={fieldErrors.responsiblePhone}
                    >
                      <input
                        id="responsible-phone"
                        type="tel"
                        value={responsiblePhone}
                        onChange={(e) => setResponsiblePhone(e.target.value)}
                        className={inputClass}
                        style={RING}
                        placeholder="(00) 00000-0000"
                        required
                      />
                    </Field>
                    <Field
                      label="E-mail *"
                      htmlFor="responsible-email"
                      error={fieldErrors.responsibleEmail}
                    >
                      <input
                        id="responsible-email"
                        type="email"
                        value={responsibleEmail}
                        onChange={(e) => setResponsibleEmail(e.target.value)}
                        className={inputClass}
                        style={RING}
                        required
                      />
                    </Field>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    to="/auth"
                    search={{}}
                    className="order-2 text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground sm:order-1 sm:text-left"
                  >
                    Voltar ao login
                  </Link>
                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      (isLoja && (catalogLoading || noLodgePotencias))
                    }
                    className="order-1 h-10 w-full cursor-pointer rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 sm:order-2 sm:w-auto sm:min-w-[200px] sm:px-6"
                    style={{ backgroundColor: PLATFORM_BLUE }}
                  >
                    {submitting ? "Enviando…" : "Enviar solicitação"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
