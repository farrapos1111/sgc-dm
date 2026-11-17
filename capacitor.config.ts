import type { CapacitorConfig } from "@capacitor/cli";

/**
 * App iOS do Templo Virtual (Capacitor).
 *
 * O app abre o site publicado (server.url) em vez de empacotar os arquivos:
 * o projeto usa funções de servidor (TanStack Start + Cloudflare Workers),
 * o "mundo" (hub, ODM, Bethel, Loja) vem do endereço e a sessão fica em
 * cookie — nada disso funciona num pacote estático sem mexer no login.
 * Detalhes e trade-offs no README, seção "App iOS".
 *
 * Para testar contra outro ambiente: CAP_SERVER_URL=https://... npm run cap:sync
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "https://templovirtual.app";

const config: CapacitorConfig = {
  appId: "app.templovirtual",
  appName: "Templo Virtual",
  // Só a tela de carregamento e a página offline vivem dentro do app.
  webDir: "capacitor-www",
  server: {
    url: serverUrl,
    // Só o próprio domínio abre dentro do app; links externos vão para o navegador.
    allowNavigation: ["templovirtual.app", "*.templovirtual.app"],
    // Mostrada quando o site não carrega (sem internet, por exemplo).
    errorPath: "offline.html",
  },
  ios: {
    // O próprio site cuida das áreas seguras (env(safe-area-inset-*)).
    contentInset: "never",
  },
};

export default config;
