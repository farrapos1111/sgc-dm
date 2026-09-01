# send-email — Auth Send Email Hook

Cole [`index.ts`](./index.ts) no dashboard do projeto **Templo Virtual** (`erjficqzodpfqqdurwgt`). Não faça deploy pelo MCP/CLI deste workspace (o MCP pode estar em outro projeto).

## Checklist no dashboard

1. **Edge Functions → Create** nome `send-email`.
2. Cole o conteúdo de `index.ts` (arquivo único, **sem imports npm** — o bundler do dashboard falha com `standardwebhooks`).
3. **Verify JWT = off** (a Auth assina com o secret da hook, não com JWT de usuário).
4. **Deploy** da function.
5. **Project Settings → Edge Functions → Secrets** (ou Secrets da function):
   - `RESEND_API_KEY`
   - `EMAIL_FROM` — ex.: `Templo Virtual <noreply@seudominio.com.br>` (domínio verificado no Resend)
   - `SEND_EMAIL_HOOK_SECRET` — gerado no passo 7 (formato `v1,whsec_…`)
   - `APP_URL` — origem pública do app (ex.: `https://templovirtual.com.br`) para o logo PNG em `/logos/templo-virtual.png`
6. Copie a URL: `https://erjficqzodpfqqdurwgt.supabase.co/functions/v1/send-email`
7. **Authentication → Hooks → Send Email** → HTTPS → cole a URL → **Generate Secret** → salve. Atualize o secret da function se gerou agora.
8. Teste **Esqueci a senha** em `/auth/recuperar-senha`. Só então desligue o SMTP interno, se quiser.

`SUPABASE_URL` já é injetada nas Edge Functions.
