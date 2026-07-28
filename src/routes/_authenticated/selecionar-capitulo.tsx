import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useActiveChapter } from "@/context/ActiveChapterContext";

export const Route = createFileRoute("/_authenticated/selecionar-capitulo")({
  head: () => ({
    meta: [
      { title: "Selecionar capítulo — SG-CDM" },
      { name: "description", content: "Escolha o capítulo com o qual deseja trabalhar." },
    ],
  }),
  component: ChapterPicker,
});

function ChapterPicker() {
  const { memberships, loading, setActiveChapterId } = useActiveChapter();
  const navigate = useNavigate();

  function pick(chapterId: string) {
    setActiveChapterId(chapterId);
    navigate({ to: "/" });
  }

  return (
    <div
      className="min-h-screen p-6 flex items-center justify-center bg-[#E9E8E3] dark:bg-background"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: "#9E1B32" }}
          >
            <span className="text-white font-bold text-xl">SG</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">Selecione o capítulo</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Você pertence a mais de um capítulo. Escolha com qual deseja trabalhar agora.
          </p>
        </div>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center">Carregando...</p>
          ) : memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center">Nenhum vínculo ativo.</p>
          ) : (
            memberships.map((m) => (
              <button
                key={m.id}
                onClick={() => pick(m.chapter_id)}
                className="w-full text-left bg-card rounded-2xl shadow-sm border border-border p-5 hover:border-muted-foreground/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: m.chapter.primary_color || "#9E1B32" }}
                  >
                    <span className="text-white font-bold text-xs">
                      {m.chapter.number}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">
                      {m.chapter.name}
                    </div>
                    {m.chapter.city && (
                      <div className="text-sm text-muted-foreground truncate">{m.chapter.city}</div>
                    )}
                    <div
                      className="inline-flex items-center gap-2 text-xs font-medium px-2 py-0.5 rounded-full mt-1.5"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${m.chapter.primary_color || "#9E1B32"} 18%, transparent)`,
                        color: m.chapter.primary_color || "#9E1B32",
                      }}
                    >
                      {m.role.label}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
