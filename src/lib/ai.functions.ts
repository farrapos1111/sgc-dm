import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";

/** Revisa ortografia/gramática de um texto curto, preservando o conteúdo original. */
export const improveText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        text: z.string().min(1, "Escreva algo antes de melhorar o texto").max(4000),
        context: z.string().max(300).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("IA indisponível: LOVABLE_API_KEY não configurada.");

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    try {
      const { text } = await generateText({
        model: gateway("google/gemini-3.6-flash"),
        system: [
          "Você revisa textos em português do Brasil para um sistema de gestão de capítulos da Ordem DeMolay.",
          "Corrija ortografia, acentuação, pontuação e concordância; melhore a clareza sem mudar o sentido.",
          "Mantenha o mesmo idioma, o tom institucional e cordial, e não invente informações novas.",
          "Preserve nomes próprios, datas, horários, valores e emojis existentes.",
          "Responda APENAS com o texto revisado, sem aspas, comentários ou explicações.",
        ].join(" "),
        prompt: [
          data.context ? `Contexto: ${data.context}` : null,
          "Texto para revisar:",
          data.text,
        ]
          .filter(Boolean)
          .join("\n\n"),
      });

      const improved = text.trim();
      if (!improved) throw new Error("A IA não retornou texto.");
      return { text: improved };
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("429")) throw new Error("Muitas solicitações à IA. Tente novamente em instantes.");
      if (msg.includes("402")) throw new Error("Créditos de IA esgotados no workspace.");
      throw new Error(msg || "Não foi possível melhorar o texto.");
    }
  });

/** Gera ou complementa a descrição de um item de calendário DeMolay. */
export const composeEventDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        title: z.string().min(1, "Informe o título antes de usar a IA").max(200),
        eventType: z.string().max(40).optional(),
        dressCode: z.string().max(120).optional(),
        location: z.string().max(200).optional(),
        dateLabel: z.string().max(120).optional(),
        mandatory: z.boolean().optional(),
        publicOpen: z.boolean().optional(),
        current: z.string().max(4000).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("IA indisponível: LOVABLE_API_KEY não configurada.");

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const has = Boolean(data.current?.trim());
    const facts = [
      `Título: ${data.title}`,
      data.eventType ? `Tipo de atividade: ${data.eventType}` : null,
      data.dateLabel ? `Data e horário: ${data.dateLabel}` : null,
      data.location ? `Local: ${data.location}` : null,
      data.dressCode ? `Traje: ${data.dressCode}` : null,
      data.mandatory === true ? "Presença obrigatória para os membros." : null,
      data.publicOpen === true ? "Atividade aberta ao público (convidados e familiares)." : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { text } = await generateText({
        model: gateway("google/gemini-3.6-flash"),
        system: [
          "Você escreve descrições de atividades para um capítulo da Ordem DeMolay, em português do Brasil.",
          "Tom formal, institucional e cordial, adequado à rotina de um capítulo DeMolay.",
          "Seja claro, objetivo e sem redundância: no máximo 2 parágrafos curtos (até ~90 palavras no total).",
          "Nunca invente datas, horários, locais, valores ou nomes que não tenham sido informados.",
          "Responda APENAS com a descrição final, sem títulos, aspas, marcadores ou comentários.",
        ].join(" "),
        prompt: has
          ? [
              "Dados da atividade:",
              facts,
              "",
              "Texto atual escrito pelo usuário (preserve o sentido, corrija e complemente):",
              data.current!.trim(),
            ].join("\n")
          : ["Gere a descrição da atividade a partir dos dados abaixo:", facts].join("\n"),
      });

      const out = text.trim();
      if (!out) throw new Error("A IA não retornou texto.");
      return { text: out };
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("429")) throw new Error("Muitas solicitações à IA. Tente novamente em instantes.");
      if (msg.includes("402")) throw new Error("Créditos de IA esgotados no workspace.");
      throw new Error(msg || "Não foi possível gerar a descrição.");
    }
  });
