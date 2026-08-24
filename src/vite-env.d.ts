/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  /** Em localhost: `odm` | `fdj` | `loja`. Vazio = hub. */
  readonly VITE_DEV_REALM?: string;
  readonly VITE_APP_URL?: string;
  /** IDs (ou URLs) de demos do Supademo na landing do hub. */
  readonly VITE_SUPADEMO_OVERVIEW?: string;
  readonly VITE_SUPADEMO_SECRETARIA?: string;
  readonly VITE_SUPADEMO_TESOURARIA?: string;
  readonly VITE_SUPADEMO_GESTAO?: string;
  readonly VITE_SUPADEMO_COMISSOES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}
