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
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const CRIMSON = "#9E1B32";
const HUB_AUTO_REALM_KEY = "tv.hub.autoRealm";

type HubStatus =
  | { kind: "anon" }
  | { kind: "loading" }
  | { kind: "redirecting"; realm: Realm }
  | { kind: "choose"; realms: Realm[] };

function readAutoRealmGuard(): string | null {
  try {
    return sessionStorage.getItem(HUB_AUTO_REALM_KEY);
  } catch {
    return null;
  }
}

function writeAutoRealmGuard(realm: Realm) {
  try {
    sessionStorage.setItem(HUB_AUTO_REALM_KEY, realm);
  } catch {
    // sessionStorage pode falhar em modo restrito
  }
}

function isCurrentEntryUrl(target: string): boolean {
  const here = window.location;
  const abs = new URL(target, here.href);
  const destPath = abs.pathname.replace(/\/$/, "") || "/";
  const herePath = here.pathname.replace(/\/$/, "") || "/";
  return abs.origin === here.origin && destPath === herePath;
}

export function HubLanding() {
  const hostRealm = getClientRealm();
  const [status, setStatus] = useState<HubStatus>({ kind: "loading" });

  useEffect(() => {
    if (hostRealm) {
      window.location.replace("/inicio");
    }
  }, [hostRealm]);

  useEffect(() => {
    if (hostRealm) return;
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
        const target = realmEntryUrl(only);
        if (readAutoRealmGuard() === only || isCurrentEntryUrl(target)) {
          setStatus({ kind: "choose", realms: list });
          return;
        }
        writeAutoRealmGuard(only);
        setStatus({ kind: "redirecting", realm: only });
        window.location.assign(target);
        return;
      }
      setStatus({ kind: "choose", realms: list });
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [hostRealm]);

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
      className="relative flex min-h-screen flex-col bg-[#E9E8E3] text-foreground dark:bg-background"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
        <ThemeToggle className="h-9 w-9" />
      </div>
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
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#072D5A] dark:text-foreground sm:text-3xl">
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
                  {realm}.templovirtual.app
                </div>
                <div className="mt-2 text-lg font-semibold text-[#072D5A] dark:text-foreground">
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
