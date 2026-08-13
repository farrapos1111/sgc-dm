import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  REALM_CARD_BLURB,
  REALM_LABELS,
  REALMS,
  getClientRealm,
  getRealmForOrgType,
  realmEntryUrl,
  type Realm,
} from "@/lib/realm";
import { cn } from "@/lib/utils";

const NAVY = "#072D5A";
const CRIMSON = "#9E1B32";

type HubStatus =
  | { kind: "anon" }
  | { kind: "loading" }
  | { kind: "redirecting"; realm: Realm }
  | { kind: "choose"; realms: Realm[] };

export function HubLanding() {
  const [status, setStatus] = useState<HubStatus>({ kind: "loading" });

  useEffect(() => {
    if (getClientRealm()) {
      window.location.replace("/inicio");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        if (!cancelled) setStatus({ kind: "anon" });
        return;
      }
      const { data, error } = await supabase
        .from("chapter_members")
        .select("chapter:chapters(org_type)")
        .eq("user_id", user.id)
        .eq("active", true);
      if (cancelled) return;
      if (error) {
        setStatus({ kind: "anon" });
        return;
      }
      const realms = new Set<Realm>();
      for (const row of data ?? []) {
        const chapter = row.chapter as { org_type?: string } | { org_type?: string }[] | null;
        const orgType = Array.isArray(chapter)
          ? chapter[0]?.org_type
          : chapter?.org_type;
        const realm = getRealmForOrgType(orgType);
        if (realm) realms.add(realm);
      }
      const list = REALMS.filter((r) => realms.has(r));
      if (list.length === 1) {
        const only = list[0]!;
        setStatus({ kind: "redirecting", realm: only });
        window.location.assign(realmEntryUrl(only));
        return;
      }
      setStatus({ kind: "choose", realms: list });
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const highlighted = useMemo(() => {
    if (status.kind === "choose") return new Set(status.realms);
    return new Set<Realm>();
  }, [status]);

  if (status.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#E9E8E3] px-4 dark:bg-background">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (status.kind === "redirecting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#E9E8E3] px-4 dark:bg-background">
        <p className="text-sm text-muted-foreground">
          Abrindo {REALM_LABELS[status.realm]}…
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-[#E9E8E3] text-foreground dark:bg-background"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-12 sm:py-16">
        <header className="mb-12 text-center">
          <img
            src="/logos/templo-virtual.svg"
            alt="Templo Virtual"
            className="mx-auto mb-5 h-16 w-16"
            width={64}
            height={64}
          />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Templo Virtual
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
            A plataforma de gestão para Ordens Paramaçônicas e Lojas Maçônicas
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Escolha o ambiente da sua instituição. Não redirecionamos
            automaticamente — cada esfera tem o seu espaço.
          </p>
        </header>

        {status.kind === "choose" && status.realms.length > 1 ? (
          <p className="mb-4 text-center text-sm text-muted-foreground">
            Sua conta tem acesso a mais de uma esfera. Os cartões destacados
            são os que você já utiliza.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {REALMS.map((realm) => {
            const active = highlighted.has(realm);
            return (
              <a
                key={realm}
                href={realmEntryUrl(realm)}
                className={cn(
                  "rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                  active
                    ? "border-transparent ring-2"
                    : "border-border/70",
                )}
                style={
                  active
                    ? { ["--tw-ring-color" as string]: CRIMSON }
                    : undefined
                }
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {realm === "odm"
                    ? "odm.templovirtual.app"
                    : realm === "fdj"
                      ? "fdj.templovirtual.app"
                      : "lodge.templovirtual.app"}
                </div>
                <div className="mt-2 text-lg font-semibold" style={{ color: NAVY }}>
                  {REALM_LABELS[realm]}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {REALM_CARD_BLURB[realm]}
                </p>
                {active ? (
                  <p className="mt-3 text-xs font-medium" style={{ color: CRIMSON }}>
                    Você já tem vínculo aqui
                  </p>
                ) : null}
              </a>
            );
          })}
        </div>

        <section className="mt-12 rounded-2xl border border-border/70 bg-card p-6 text-center">
          <h2 className="text-base font-semibold">Não encontrou sua instituição?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Solicite a inclusão mesmo sem saber em qual esfera ela se encaixa.
          </p>
          <Link
            to="/auth/adicionar-organizacao"
            className="mt-4 inline-flex rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: CRIMSON }}
          >
            Quero Adicionar à Minha Organização
          </Link>
        </section>
      </main>

      <footer className="border-t border-border/60 px-6 py-6 text-center text-xs text-muted-foreground">
        <a
          href="/documentacao"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Documentação
        </a>
      </footer>
    </div>
  );
}
