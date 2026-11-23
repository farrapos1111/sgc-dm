import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Bell, CalendarClock, ChevronRight, Plus, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { memberById, type DemoOrg, type Investigation, type Verdict } from "./demo-data";
import { Avatar, Chip, Panel, PrimaryButton, ScreenHeader } from "./demo-ui";
import { notInDemo } from "./demo-helpers";

const verdictChip = (v: Verdict) =>
  v === "F" ? (
    <Chip tone="in">Favorável</Chip>
  ) : v === "D" ? (
    <Chip tone="out">Desfavorável</Chip>
  ) : (
    <Chip tone="warn">Aguardando</Chip>
  );

function daysUntil(ddmmyyyy: string) {
  const [d, m, y] = ddmmyyyy.split("/").map(Number);
  const diff = new Date(y, m - 1, d).getTime() - new Date(2026, 10, 23).getTime();
  return Math.round(diff / 86400000);
}

export function InvestigationsScreen({
  org,
  list,
  setList,
  openId,
  setOpenId,
  openProfile,
}: {
  org: DemoOrg;
  list: Investigation[];
  setList: (fn: (l: Investigation[]) => Investigation[]) => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  openProfile: (memberId: string) => void;
}) {
  const current = list.find((i) => i.id === openId) ?? null;
  if (current) {
    return (
      <InvestigationDetail
        org={org}
        inv={current}
        onBack={() => setOpenId(null)}
        openProfile={openProfile}
        onChange={(fn) => setList((l) => l.map((i) => (i.id === current.id ? fn(i) : i)))}
      />
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <ScreenHeader
        eyebrow="Comissão de sindicância"
        title="Sindicâncias"
        subtitle={`Pareceres sobre ${org.memberWord.candidate.toLowerCase()}s antes da votação.`}
        actions={
          <PrimaryButton onClick={notInDemo}>
            <Plus className="h-[18px] w-[18px]" aria-hidden />
            Nova sindicância
          </PrimaryButton>
        }
      />
      <ul className="flex flex-col gap-2.5">
        {list.map((inv) => {
          const done = inv.investigators.filter((x) => x.verdict).length;
          const mine = inv.investigators.find((x) => x.memberId === org.user.memberId);
          return (
            <li key={inv.id}>
              <button
                type="button"
                onClick={() => setOpenId(inv.id)}
                className="flex w-full flex-wrap items-center gap-3 rounded-[20px] bg-tv-surface p-4 text-left transition-shadow hover:shadow-[0_4px_14px_rgba(20,20,20,0.07)] sm:flex-nowrap sm:p-5"
              >
                <Avatar name={inv.candidate} size={48} />
                <span className="min-w-0 flex-1 basis-[200px]">
                  <span className="block text-[16px] font-bold">{inv.candidate}</span>
                  <span className="block text-[13px] text-tv-text-2">{inv.candidateInfo}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {inv.status === "Concluída" ? (
                      <Chip tone={inv.result === "Favorável" ? "in" : "out"}>
                        Concluída · {inv.result}
                      </Chip>
                    ) : (
                      <Chip tone="brand">Em andamento</Chip>
                    )}
                    <Chip>
                      {done} de {inv.investigators.length} pareceres
                    </Chip>
                    {inv.status !== "Concluída" ? <Chip>Prazo {inv.deadline}</Chip> : null}
                    {mine && !mine.verdict && inv.status !== "Concluída" ? (
                      <Chip tone="warn">Falta o seu parecer</Chip>
                    ) : null}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-tv-text-2" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function InvestigationDetail({
  org,
  inv,
  onBack,
  onChange,
  openProfile,
}: {
  org: DemoOrg;
  inv: Investigation;
  onBack: () => void;
  onChange: (fn: (i: Investigation) => Investigation) => void;
  openProfile: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const sponsor = memberById(org, inv.sponsorId);
  const mine = inv.investigators.find((x) => x.memberId === org.user.memberId);
  const allDone = inv.investigators.every((x) => x.verdict);
  const left = daysUntil(inv.deadline);
  const closed = inv.status === "Concluída";

  return (
    <div className="flex flex-col gap-[18px]">
      <ScreenHeader
        back={{ label: "Sindicâncias", onClick: onBack }}
        title={inv.candidate}
        subtitle={inv.candidateInfo}
      />
      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-[18px]">
          {mine && !mine.verdict && !closed ? (
            <OpinionForm
              questions={org.questions}
              candidateWord={org.memberWord.candidate.toLowerCase()}
              onSubmit={(verdict, answers) => {
                onChange((i) => ({
                  ...i,
                  investigators: i.investigators.map((x) =>
                    x.memberId === org.user.memberId
                      ? { ...x, verdict, answers, answeredAt: "23/11/2026" }
                      : x,
                  ),
                }));
                toast.success("Parecer enviado", {
                  description: "A comissão já pode ver a sua resposta.",
                });
              }}
            />
          ) : null}

          <Panel className="p-0">
            <p className="px-5 pb-1 pt-4 text-[15px] font-bold">Sindicantes</p>
            <ul>
              {inv.investigators.map((x) => {
                const m = memberById(org, x.memberId);
                if (!m) return null;
                const isMe = x.memberId === org.user.memberId;
                const open = expanded === x.memberId;
                return (
                  <li key={x.memberId} className="border-t border-tv-line first:border-0">
                    <div className="flex flex-wrap items-center gap-3 px-5 py-3 sm:flex-nowrap">
                      <Avatar name={m.name} size={40} />
                      <span className="min-w-0 flex-1 basis-[160px]">
                        <button
                          type="button"
                          onClick={() => openProfile(m.id)}
                          className="block truncate text-left text-[15px] font-semibold hover:underline"
                        >
                          {m.name}
                          {isMe ? " (você)" : ""}
                        </button>
                        <span className="block text-[13px] text-tv-text-2">
                          {x.answeredAt ? `Respondeu em ${x.answeredAt}` : "Ainda não respondeu"}
                        </span>
                      </span>
                      {verdictChip(x.verdict)}
                      {x.verdict ? (
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setExpanded(open ? null : x.memberId)}
                          className="min-h-10 rounded-[10px] bg-tv-soft px-3 text-sm font-semibold text-tv-ink"
                        >
                          {open ? "Ocultar respostas" : "Ver respostas"}
                        </button>
                      ) : !isMe && !closed ? (
                        <button
                          type="button"
                          onClick={() =>
                            toast.success("Lembrete enviado", {
                              description: `${m.name.split(" ")[0]} vai receber um aviso por e-mail.`,
                            })
                          }
                          className="flex min-h-10 items-center gap-1.5 rounded-[10px] border border-tv-border px-3 text-sm font-semibold"
                        >
                          <Bell className="h-4 w-4" aria-hidden />
                          Lembrar
                        </button>
                      ) : null}
                    </div>
                    {open ? (
                      <dl className="mx-5 mb-4 flex flex-col gap-3 rounded-[14px] bg-tv-bg p-4">
                        {org.questions.map((q, qi) => (
                          <div key={q}>
                            <dt className="text-[13px] font-semibold text-tv-text-2">{q}</dt>
                            <dd className="mt-0.5 text-[15px]">
                              {x.answers[qi] || "Sem resposta."}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <div className="flex flex-col gap-[18px]">
          <Panel className="flex flex-col gap-3 text-[15px]">
            <span className="text-[15px] font-bold">Andamento</span>
            {closed ? (
              <p
                className={cn(
                  "flex items-center gap-2 font-semibold",
                  inv.result === "Favorável" ? "text-tv-in" : "text-tv-out",
                )}
              >
                <ShieldCheck className="h-5 w-5" aria-hidden />
                Concluída com parecer {inv.result?.toLowerCase()}
              </p>
            ) : (
              <p className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-tv-primary" aria-hidden />
                Prazo {inv.deadline} · {left >= 0 ? `faltam ${left} dias` : "prazo vencido"}
              </p>
            )}
            <div className="flex h-2.5 overflow-hidden rounded-full bg-[#EEEEEA] dark:bg-tv-line">
              <div
                className="bg-tv-primary"
                style={{
                  width: `${(inv.investigators.filter((x) => x.verdict).length / inv.investigators.length) * 100}%`,
                }}
              />
            </div>
            <p className="text-sm text-tv-text-2">
              {inv.investigators.filter((x) => x.verdict).length} de {inv.investigators.length}{" "}
              pareceres recebidos. Aberta em {inv.opened}.
            </p>
            {sponsor ? (
              <button
                type="button"
                onClick={() => openProfile(sponsor.id)}
                className="flex items-center gap-3 rounded-[14px] bg-tv-bg p-3 text-left"
              >
                <UserRound className="h-5 w-5 text-tv-text-2" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-tv-text-2">
                    {org.kind === "loja" ? "Proponente" : "Padrinho da indicação"}
                  </span>
                  <span className="block truncate font-semibold">{sponsor.name}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-tv-text-2" aria-hidden />
              </button>
            ) : null}
            {!closed ? (
              <PrimaryButton
                disabled={!allDone}
                onClick={() => {
                  const result = inv.investigators.every((x) => x.verdict === "F")
                    ? "Favorável"
                    : "Desfavorável";
                  onChange((i) => ({ ...i, status: "Concluída", result }));
                  toast.success("Sindicância concluída", {
                    description: `Parecer final ${result.toLowerCase()}. O resultado vai para a votação.`,
                  });
                }}
              >
                Concluir sindicância
              </PrimaryButton>
            ) : null}
            {!closed && !allDone ? (
              <p className="text-center text-[13px] text-tv-text-2">
                Disponível quando todos responderem.
              </p>
            ) : null}
          </Panel>
          <Panel className="text-sm text-tv-text-2">
            Só a comissão e a administração veem as respostas. Os pareceres ficam registrados com
            data e autor.
          </Panel>
        </div>
      </div>
    </div>
  );
}

function OpinionForm({
  questions,
  candidateWord,
  onSubmit,
}: {
  questions: string[];
  candidateWord: string;
  onSubmit: (v: Exclude<Verdict, null>, answers: string[]) => void;
}) {
  const [answers, setAnswers] = useState<string[]>(questions.map(() => ""));
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (answers.some((a) => !a.trim()))
      return setError("Responda todas as perguntas antes de enviar.");
    if (!verdict) return setError("Escolha se o seu parecer é favorável ou desfavorável.");
    onSubmit(
      verdict,
      answers.map((a) => a.trim()),
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[20px] border-2 border-[#E9D58A] bg-tv-surface p-5">
      <p className="text-[17px] font-bold">Seu parecer</p>
      <p className="mt-1 text-sm text-tv-text-2">
        Você é sindicante. Responda com base na sua conversa com{" "}
        {candidateWord === "candidata" ? "a candidata" : "o candidato"} e a família.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {questions.map((q, i) => (
          <label key={q} className="flex flex-col gap-1.5 text-sm font-semibold">
            {q}
            <textarea
              rows={2}
              value={answers[i]}
              onChange={(e) => {
                const v = e.target.value;
                setAnswers((a) => a.map((x, j) => (j === i ? v : x)));
              }}
              className="rounded-[12px] border border-tv-border bg-tv-bg px-3.5 py-2.5 text-[15px] font-normal outline-none focus:border-tv-primary"
            />
          </label>
        ))}
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">Parecer</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["F", "D"] as const).map((v) => (
            <label
              key={v}
              className={cn(
                "flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border text-[15px] font-semibold",
                verdict === v
                  ? v === "F"
                    ? "border-[#1F7A4D] bg-[#1F7A4D] text-white"
                    : "border-[#B42318] bg-[#B42318] text-white"
                  : "border-[#DCDCD8] dark:border-tv-border",
              )}
            >
              <input
                type="radio"
                name="verdict"
                className="sr-only"
                checked={verdict === v}
                onChange={() => setVerdict(v)}
              />
              {v === "F" ? "Favorável" : "Desfavorável"}
            </label>
          ))}
        </div>
      </fieldset>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-tv-out">
          {error}
        </p>
      ) : null}
      <PrimaryButton type="submit" className="mt-4 w-full">
        Enviar parecer
      </PrimaryButton>
    </form>
  );
}
