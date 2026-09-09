import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function MyPasswordPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação não coincide com a nova senha.");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("A nova senha deve ser diferente da senha atual.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        toast.error("Sessão inválida. Entre novamente.");
        return;
      }
      const email = userData.user.email;
      if (!email) {
        toast.error(
          "Sua conta não tem e-mail vinculado. Use a recuperação de senha ou fale com a secretaria.",
        );
        return;
      }

      const { error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (authErr) {
        toast.error("Senha atual incorreta.");
        return;
      }

      const { error: updErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updErr) {
        toast.error(updErr.message || "Não foi possível atualizar a senha.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha atualizada.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível atualizar a senha.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="rounded-[12px] p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <KeyRound className="h-4 w-4" />
        Alterar senha
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Informe a senha atual e escolha uma nova com pelo menos 8 caracteres.
      </p>
      <form onSubmit={(e) => void handleSubmit(e)} className="max-w-md space-y-3">
        <PasswordField
          id="current-password"
          label="Senha atual"
          autoComplete="current-password"
          value={currentPassword}
          onChange={setCurrentPassword}
          show={showCurrent}
          onToggleShow={() => setShowCurrent((v) => !v)}
        />
        <PasswordField
          id="new-password"
          label="Nova senha"
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
          show={showNew}
          onToggleShow={() => setShowNew((v) => !v)}
          minLength={8}
        />
        <PasswordField
          id="confirm-password"
          label="Confirmar nova senha"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          show={showConfirm}
          onToggleShow={() => setShowConfirm((v) => !v)}
          minLength={8}
        />
        <Button type="submit" disabled={submitting} className="mt-1">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando…
            </>
          ) : (
            "Atualizar senha"
          )}
        </Button>
      </form>
    </Card>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  value,
  onChange,
  show,
  onToggleShow,
  minLength,
}: {
  id: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  minLength?: number;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-sm">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
