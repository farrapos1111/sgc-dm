/** Contatos da Comissão de Tecnologia (sugestões / notificações). Fonte: env. */

export type TechCommissionContact = {
  name: string;
  role: string;
  email: string;
  phone: string;
  phoneTel: string;
};

function readEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env?.[name]?.trim()) {
    return process.env[name]!.trim();
  }
  return undefined;
}

function parseContactsJson(raw: string): TechCommissionContact[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const o = item as Record<string, unknown>;
        const email = typeof o.email === "string" ? o.email.trim() : "";
        if (!email) return null;
        return {
          name: typeof o.name === "string" ? o.name : "",
          role: typeof o.role === "string" ? o.role : "",
          email,
          phone: typeof o.phone === "string" ? o.phone : "",
          phoneTel: typeof o.phoneTel === "string" ? o.phoneTel : "",
        } satisfies TechCommissionContact;
      })
      .filter((c): c is TechCommissionContact => c != null);
  } catch {
    return [];
  }
}

/** Lê TECH_COMMISSION_CONTACTS_JSON (array JSON). Fallback: []. */
export function getTechCommissionContacts(): TechCommissionContact[] {
  const raw = readEnv("TECH_COMMISSION_CONTACTS_JSON");
  if (!raw) return [];
  return parseContactsJson(raw);
}

/** Lê TECH_COMMISSION_EMAILS (csv) ou e-mails dos contatos. Fallback: []. */
export function getTechCommissionEmails(): string[] {
  const raw = readEnv("TECH_COMMISSION_EMAILS");
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return getTechCommissionContacts().map((c) => c.email);
}
