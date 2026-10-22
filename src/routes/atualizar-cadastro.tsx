import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// A atualização anônima por ID DeMolay foi removida (expunha e permitia alterar
// dados pessoais de qualquer membro). O link antigo agora orienta o login; a
// edição fica em Perfil → Cadastro (updateMyMemberCadastro, vinculado ao user_id).
export const Route = createFileRoute("/atualizar-cadastro")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Atualização cadastral — Templo Virtual" },
      {
        name: "description",
        content: "Atualize seus dados cadastrais entrando na sua conta do Templo Virtual.",
      },
    ],
  }),
  component: AtualizarCadastroPage,
});

function AtualizarCadastroPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-lg px-4 py-12">
        <Card className="space-y-4 rounded-[12px] p-6">
          <div>
            <h1 className="text-lg font-semibold">Atualização cadastral</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Por segurança, telefone, e-mail, endereço, documentos e dados dos
              responsáveis só podem ser alterados com login. Entre na sua conta e
              acesse <strong>Perfil → Cadastro</strong>.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Ainda não tem acesso? Peça à secretaria do seu capítulo para criar
              sua conta.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link to="/auth">Entrar na minha conta</Link>
          </Button>
        </Card>
      </main>
    </div>
  );
}
