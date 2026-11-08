import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { REALMS, REALM_CARD_BLURB, type Realm } from "@/lib/realm";
import "./sphere-auth.css";

type SphereTheme = {
  kicker: string;
  name: string;
  logo: string;
  /** Gradiente da fatia (escuro → cor → escuro). */
  c1: string;
  c2: string;
  c3: string;
  /** Cor de destaque do formulário. */
  accent: string;
  accentSoft: string;
};

const SPHERE_THEMES: Record<Realm, SphereTheme> = {
  odm: {
    kicker: "ODM",
    name: "Ordem DeMolay",
    logo: "/esferas/odm.webp",
    c1: "#2a0507",
    c2: "#8f1219",
    c3: "#3a070b",
    accent: "#a3161c",
    accentSoft: "#e2474d",
  },
  fdj: {
    kicker: "FDJ",
    name: "Filhas de Jó",
    logo: "/esferas/fdj.webp",
    c1: "#1c0636",
    c2: "#6b1aa8",
    c3: "#260a47",
    accent: "#7a1fc4",
    accentSoft: "#b36af0",
  },
  loja: {
    kicker: "Loja",
    name: "Maçonaria",
    logo: "/esferas/loja.webp",
    c1: "#061631",
    c2: "#1650b8",
    c3: "#081d42",
    accent: "#1f5fd1",
    accentSoft: "#5e95f2",
  },
};

export type SphereLoginFields = {
  identifier: string;
  password: string;
};

type Props = {
  selected: Realm | null;
  onSelect: (realm: Realm | null) => void;
  onSubmit: (realm: Realm, fields: SphereLoginFields) => Promise<void>;
  submitting: boolean;
  error: string | null;
};

export function SphereAuth({ selected, onSelect, onSubmit, submitting, error }: Props) {
  const [ready, setReady] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const identifierRef = useRef<HTMLInputElement>(null);

  // Mantém o tema do formulário durante a animação de volta ao seletor.
  const [formRealm, setFormRealm] = useState<Realm>(selected ?? "odm");
  useEffect(() => {
    if (selected) setFormRealm(selected);
  }, [selected]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const t = window.setTimeout(() => identifierRef.current?.focus({ preventScroll: true }), 650);
    return () => window.clearTimeout(t);
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSelect(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onSelect]);

  const theme = SPHERE_THEMES[formRealm];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void onSubmit(formRealm, { identifier: identifier.trim(), password });
  }

  return (
    <div
      className="sa-root"
      data-selected={selected ?? undefined}
      data-ready={ready ? "" : undefined}
      style={
        {
          "--accent": theme.accent,
          "--accent-soft": theme.accentSoft,
        } as CSSProperties
      }
    >
      <header className="sa-top">
        <a href="/" className="sa-brand">
          <img src="/logos/templo-virtual.svg" alt="" width={30} height={30} />
          Templo Virtual
        </a>
        <span className="sa-title">Escolha sua esfera</span>
      </header>

      {REALMS.map((realm, i) => {
        const t = SPHERE_THEMES[realm];
        const state = !selected ? "idle" : selected === realm ? "active" : "hidden";
        return (
          <section
            key={realm}
            className="sa-panel"
            data-realm={realm}
            data-index={i}
            data-state={state}
            aria-hidden={state === "hidden" || undefined}
            style={
              {
                "--c1": t.c1,
                "--c2": t.c2,
                "--c3": t.c3,
                "--i": i,
              } as CSSProperties
            }
          >
            <img className="sa-glow" src={t.logo} alt="" aria-hidden />
            <img className="sa-mark" src={t.logo} alt="" aria-hidden />
            <span className="sa-veil" />

            <button
              type="button"
              className="sa-hit"
              onClick={() => onSelect(realm)}
              tabIndex={state === "idle" ? 0 : -1}
              aria-label={`Entrar em ${t.name}`}
            />

            <div className="sa-content">
              <img className="sa-logo" src={t.logo} alt={t.name} />
              <div className="sa-text">
                <span className="sa-kicker">{t.kicker}</span>
                <span className="sa-name">{t.name}</span>
                <span className="sa-blurb">{REALM_CARD_BLURB[realm]}</span>
                <span className="sa-cta">
                  Entrar <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </div>

            <button
              type="button"
              className="sa-back"
              onClick={() => onSelect(null)}
              tabIndex={state === "active" ? 0 : -1}
            >
              <ArrowLeft className="h-4 w-4" />
              Trocar esfera
            </button>
          </section>
        );
      })}

      <section className="sa-form-pane" aria-hidden={!selected || undefined}>
        <div className="sa-form-scroll">
          <div className="sa-form-wrap">
            <span className="sa-form-kicker">{theme.name}</span>
            <h1 className="sa-form-title">Acesse sua conta</h1>
            <p className="sa-form-sub">Acesse com e-mail ou ID da Organização e senha.</p>

            <form onSubmit={handleSubmit}>
              <div className="sa-field">
                <div className="sa-label-row">
                  <label className="sa-label" htmlFor="sa-identifier">
                    E-mail ou ID da Organização
                  </label>
                </div>
                <input
                  id="sa-identifier"
                  ref={identifierRef}
                  className="sa-input"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="voce@exemplo.com ou 12345"
                  tabIndex={selected ? 0 : -1}
                />
              </div>

              <div className="sa-field">
                <div className="sa-label-row">
                  <label className="sa-label" htmlFor="sa-password">
                    Senha
                  </label>
                  <Link
                    to="/auth/recuperar-senha"
                    preload={false}
                    className="sa-link-muted"
                    tabIndex={selected ? 0 : -1}
                  >
                    Esqueci a senha
                  </Link>
                </div>
                <div className="sa-input-wrap">
                  <input
                    id="sa-password"
                    className="sa-input"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    tabIndex={selected ? 0 : -1}
                  />
                  <button
                    type="button"
                    className="sa-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    tabIndex={selected ? 0 : -1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <div className="sa-error">{error}</div>}

              <button
                type="submit"
                className="sa-submit"
                disabled={submitting}
                tabIndex={selected ? 0 : -1}
              >
                {submitting ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <p className="sa-join">
              <Link to="/auth/adicionar-organizacao" tabIndex={selected ? 0 : -1}>
                Quero Adicionar à Minha Organização
              </Link>
            </p>
          </div>

          <p className="sa-foot">
            <a href="/documentacao">Documentação</a>
            <span style={{ margin: "0 8px" }}>·</span>
            Sugestões:{" "}
            <a href="mailto:pedro.bossle.s@gmail.com?subject=Sugest%C3%A3o%20%E2%80%94%20Templo%20Virtual">
              Pedro Bossle
            </a>
            {" · "}
            <a href="mailto:lucasboeiraborges@gmail.com?subject=Sugest%C3%A3o%20%E2%80%94%20Templo%20Virtual">
              Lucas Borges
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
