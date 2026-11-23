import { toast } from "sonner";
import { Cake, Download, IdCard, Mail, MessageCircle, Pencil, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  brl,
  DEMO_TODAY,
  DUE_META,
  MONTHS_LONG,
  MONTHS_SHORT,
  type DemoMember,
  type DemoOrg,
  type DueStatus,
} from "./demo-data";
import { Avatar, Chip, Panel, ScreenHeader, SoftButton } from "./demo-ui";
import { notInDemo } from "./demo-helpers";

/** QR "de mentira", determinístico, só para compor a carteirinha. */
function FakeQr({ seed }: { seed: string }) {
  const n = 21;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const cells: [number, number][] = [];
  const finder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (finder(x, y)) continue;
      h = (h * 1103515245 + 12345) >>> 0;
      if ((h >>> 16) % 2 === 0) cells.push([x, y]);
    }
  }
  const eye = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="#17181A" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="#17181A" />
    </g>
  );
  return (
    <svg
      viewBox={`-1 -1 ${n + 2} ${n + 2}`}
      className="h-full w-full"
      aria-hidden
      shapeRendering="crispEdges"
    >
      <rect x="-1" y="-1" width={n + 2} height={n + 2} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width="1" height="1" fill="#17181A" />
      ))}
      {eye(0, 0)}
      {eye(n - 7, 0)}
      {eye(0, n - 7)}
    </svg>
  );
}

function MemberCard({ org, member }: { org: DemoOrg; member: DemoMember }) {
  return (
    <div className="relative aspect-[1.586] w-full overflow-hidden rounded-[20px] bg-tv-primary p-5 text-white shadow-[0_12px_30px_-12px_rgba(20,20,20,0.45)]">
      <img
        src={org.emblem}
        alt=""
        className="pointer-events-none absolute -right-6 -top-4 h-40 w-40 object-contain opacity-[0.14] grayscale"
      />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-white p-1.5">
            <img src={org.emblem} alt="" className="h-full w-full object-contain" />
          </span>
          <div className="leading-tight">
            <p className="text-xs opacity-80">Carteirinha digital</p>
            <p className="text-sm font-bold">{org.short}</p>
          </div>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold leading-tight">{member.name}</p>
            <p className="text-[13px] opacity-85">{member.role ?? member.grade}</p>
            <p className="mt-2 text-xs opacity-75">Registro {member.regNo} · válida até 12/2026</p>
          </div>
          <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[8px]">
            <FakeQr seed={member.regNo} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileScreen({
  org,
  member,
  dues,
  isMe,
  onBack,
}: {
  org: DemoOrg;
  member: DemoMember;
  dues: DueStatus[];
  isMe: boolean;
  onBack: () => void;
}) {
  const idx = org.members.findIndex((m) => m.id === member.id);
  const today = DEMO_TODAY.getDate();
  const sessions = org.events
    .filter(
      (e) =>
        (e.type === "Ritualística" || e.type === "Obrigatória" || e.type === "Administrativa") &&
        e.day < today,
    )
    .map((e, i) => ({ ...e, present: (idx * 17 + i * 29) % 100 < member.attendance }));
  const owed = dues.filter((s) => s === "A" || s === "T").length * org.dueValue;
  const currentRole =
    member.role ??
    (org.kind === "loja"
      ? "Obreiro do quadro"
      : `${org.memberWord.one[0].toUpperCase()}${org.memberWord.one.slice(1)} do quadro`);

  return (
    <div className="flex flex-col gap-[18px]">
      <ScreenHeader
        back={{ label: isMe ? "Início" : "Membros", onClick: onBack }}
        title={isMe ? "Meu perfil" : member.name}
        subtitle={`${member.role ?? member.grade} · ${org.short}`}
        actions={
          <>
            <SoftButton onClick={notInDemo}>
              <Download className="h-[18px] w-[18px]" aria-hidden />
              Declaração
            </SoftButton>
            <SoftButton onClick={notInDemo}>
              <Pencil className="h-[18px] w-[18px]" aria-hidden />
              Editar cadastro
            </SoftButton>
          </>
        }
      />

      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="flex flex-col gap-[18px]">
          <Panel>
            <div className="flex items-center gap-4">
              <Avatar name={member.name} size={72} />
              <div className="min-w-0">
                <p className="font-display text-xl font-bold leading-tight">{member.name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Chip tone="brand">{member.grade}</Chip>
                  <Chip tone={member.status === "Ativo" ? "in" : "warn"}>{member.status}</Chip>
                  {member.role ? <Chip>{member.role}</Chip> : null}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <SoftButton
                onClick={() =>
                  toast("Abrindo o WhatsApp", {
                    description: "Na versão completa, abre a conversa com o membro.",
                  })
                }
              >
                <MessageCircle className="h-[18px] w-[18px]" aria-hidden />
                WhatsApp
              </SoftButton>
              <SoftButton
                onClick={() =>
                  toast("Novo e-mail", {
                    description: `Na versão completa, abre um e-mail para ${member.email}.`,
                  })
                }
              >
                <Mail className="h-[18px] w-[18px]" aria-hidden />
                E-mail
              </SoftButton>
            </div>
            <dl className="mt-4 grid gap-x-4 text-[15px] sm:grid-cols-2">
              {[
                ["Nascimento", member.birthDate],
                [org.kind === "loja" ? "Iniciação" : "Iniciação no " + org.orgType, member.since],
                ["Registro", member.regNo],
                ["Cidade", org.city],
                ["Telefone", member.phone],
                ["E-mail", member.email],
              ].map(([k, v]) => (
                <div key={k} className="border-b border-tv-line py-2.5">
                  <dt className="text-[13px] text-tv-text-2">{k}</dt>
                  <dd className="truncate font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <div>
            <p className="mb-2 flex items-center gap-2 text-[15px] font-bold">
              <IdCard className="h-5 w-5 text-tv-primary" aria-hidden />
              Carteirinha digital
            </p>
            <MemberCard org={org} member={member} />
          </div>
        </div>

        <div className="flex flex-col gap-[18px]">
          <Panel>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-bold">Frequência em 2026</span>
              <Chip tone={member.attendance >= 75 ? "in" : "warn"}>
                {member.attendance >= 75 ? "Dentro do mínimo" : "Abaixo de 75%"}
              </Chip>
            </div>
            <p className="mt-3 font-display text-[34px] font-extrabold leading-none">
              {member.attendance}%
            </p>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#EEEEEA] dark:bg-tv-line">
              <div
                className="h-full rounded-full bg-tv-primary"
                style={{ width: `${member.attendance}%` }}
              />
            </div>
            <ul className="mt-4">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 border-t border-tv-line py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{s.title}</span>
                    <span className="block text-[13px] text-tv-text-2">
                      {String(s.day).padStart(2, "0")}/11/2026 · {s.type}
                    </span>
                  </span>
                  <Chip tone={s.present ? "in" : "out"}>{s.present ? "Presente" : "Faltou"}</Chip>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-bold">Mensalidades de 2026</span>
              <span className={cn("text-sm font-bold", owed ? "text-tv-out" : "text-tv-in")}>
                {owed ? `${brl(owed)} em aberto` : "Tudo em dia"}
              </span>
            </div>
            <ul className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {dues.map((s, i) => (
                <li
                  key={i}
                  className="rounded-[10px] px-1 py-2 text-center"
                  style={{
                    background: s === "-" ? "var(--tv-line)" : DUE_META[s].bg,
                    color: DUE_META[s].fg,
                  }}
                  title={`${MONTHS_LONG[i]}: ${DUE_META[s].label}`}
                >
                  <span className="block text-xs font-bold">{MONTHS_SHORT[i]}</span>
                  <span className="block text-[11px] font-semibold">{DUE_META[s].label}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <span className="text-[15px] font-bold">Cargos</span>
            <ul className="mt-2">
              <li className="flex items-center gap-3 border-b border-tv-line py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{currentRole}</span>
                  <span className="block text-[13px] text-tv-text-2">
                    Gestão atual · 2º semestre de 2026
                  </span>
                </span>
                <Chip tone="brand">Atual</Chip>
              </li>
              {member.history.map((h) => (
                <li key={h.term + h.role} className="border-b border-tv-line py-2.5 last:border-0">
                  <span className="block text-[15px] font-semibold">{h.role}</span>
                  <span className="block text-[13px] text-tv-text-2">{h.term}</span>
                </li>
              ))}
              {member.history.length === 0 ? (
                <li className="py-2.5 text-sm text-tv-text-2">Sem cargos em gestões anteriores.</li>
              ) : null}
            </ul>
            <p className="mt-3 flex items-center gap-2 text-[13px] text-tv-text-2">
              <Cake className="h-4 w-4" aria-hidden />
              Aniversário em {member.birthday}
              <Phone className="ml-2 h-4 w-4" aria-hidden />
              {member.phone}
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
