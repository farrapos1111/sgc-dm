import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Provider OpenAI-compatible para as funções de IA do servidor.
 * Use AI_API_KEY (+ opcional AI_BASE_URL / AI_MODEL).
 */
export function createAiProvider(apiKey: string, baseURL?: string) {
  return createOpenAICompatible({
    name: "openai-compatible",
    baseURL: (baseURL?.trim() || "https://api.openai.com/v1").replace(/\/$/, ""),
    apiKey,
  });
}

export function resolveAiModelId(): string {
  return process.env.AI_MODEL?.trim() || "gpt-4o-mini";
}
