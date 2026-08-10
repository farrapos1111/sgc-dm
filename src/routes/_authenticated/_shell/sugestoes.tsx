import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Mail, MessageCircle, Phone, Users } from "lucide-react";
import {
  getTechCommissionContacts,
  type TechCommissionContact,
} from "@/lib/tech-commission";

const loadTechContacts = createServerFn({ method: "GET" }).handler(
  async (): Promise<TechCommissionContact[]> => getTechCommissionContacts(),
);

export const Route = createFileRoute("/_authenticated/_shell/sugestoes")({
  head: () => ({
    meta: [
      { title: "Portal de Sugestões — Templo Virtual" },
      {
        name: "description",
        content:
          "Contatos da Comissão de Tecnologia e Desenvolvimento do Templo Virtual.",
      },
    ],
  }),
  loader: () => loadTechContacts(),
  component: SugestoesPage,
});

function SugestoesPage() {
  const contacts = Route.useLoaderData();

  return (
    <div>
      <PageHeader
        title="Portal de Sugestões"
        subtitle="Fale com a Comissão de Tecnologia e Desenvolvimento do Templo Virtual."
      />

      <Card className="mb-6 rounded-[12px] border-border p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Lightbulb className="h-5 w-5" />
          Como contribuir
        </div>
        <p className="text-sm leading-relaxed text-foreground">
          Tem ideia de melhoria, encontrou um bug ou precisa de suporte técnico?
          Entre em contato com os responsáveis abaixo por e-mail ou WhatsApp.
          Descreva o capítulo, o que aconteceu e, se possível, anexe prints.
        </p>
      </Card>

      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Users className="h-4 w-4" />
        Responsáveis
      </div>

      {contacts.length === 0 ? (
        <Card className="rounded-[12px] border-border p-5">
          <p className="text-sm text-muted-foreground">
            Contatos da comissão ainda não configurados. Defina
            TECH_COMMISSION_CONTACTS_JSON no ambiente do servidor.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {contacts.map((c) => (
            <li key={c.email}>
              <Card className="flex h-full flex-col rounded-[12px] p-5">
                <div className="mb-1 text-base font-semibold text-foreground">
                  {c.name}
                </div>
                <p className="mb-4 text-xs text-muted-foreground">{c.role}</p>

                <div className="mt-auto space-y-2">
                  <a
                    href={`mailto:${c.email}?subject=${encodeURIComponent("Sugestão — Templo Virtual")}`}
                    className="flex items-center gap-2 text-sm text-foreground hover:underline"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="break-all">{c.email}</span>
                  </a>
                  {c.phone ? (
                    <a
                      href={`tel:${c.phoneTel || c.phone}`}
                      className="flex items-center gap-2 text-sm text-foreground hover:underline"
                    >
                      <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {c.phone}
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={`mailto:${c.email}?subject=${encodeURIComponent("Sugestão — Templo Virtual")}`}
                      >
                        <Mail className="mr-1.5 h-3.5 w-3.5" />
                        E-mail
                      </a>
                    </Button>
                    {c.phoneTel || c.phone ? (
                      <Button
                        asChild
                        size="sm"
                        style={{ backgroundColor: "var(--chapter-primary)" }}
                      >
                        <a
                          href={`https://wa.me/${(c.phoneTel || c.phone).replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
