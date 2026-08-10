/**
 * IP de cliente a partir de header de borda confiável.
 * Não usar x-forwarded-for (spoofável pelo cliente).
 *
 * EDGE_CLIENT_IP_HEADER: nome exato do header (ex.: cf-connecting-ip)
 * ou alias: cloudflare | vercel | fly | true-client-ip
 */

const HEADER_ALIASES: Record<string, string> = {
  cloudflare: "cf-connecting-ip",
  cf: "cf-connecting-ip",
  vercel: "x-vercel-forwarded-for",
  fly: "fly-client-ip",
  "true-client-ip": "true-client-ip",
};

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const IPV6_RE =
  /^(?:[0-9a-f]{1,4}:){1,7}[0-9a-f]{0,4}$|^::(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{0,4}$|^(?:[0-9a-f]{1,4}:){1,6}:$|^(?:[0-9a-f]{1,4}:){7}:$/i;

export function isValidIpAddress(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 64) return false;
  if (IPV4_RE.test(v)) return true;
  // IPv6 compact forms
  if (v.includes(":")) {
    try {
      // Node / browsers: URL parser accepts IPv6 in brackets
      if (IPV6_RE.test(v)) return true;
      // Fallback: reject obviously invalid
      return /^[0-9a-f:.]+$/i.test(v) && (v.match(/:/g)?.length ?? 0) >= 2;
    } catch {
      return false;
    }
  }
  return false;
}

function configuredHeaderName(): string | null {
  const raw =
    (typeof process !== "undefined" &&
      process.env?.EDGE_CLIENT_IP_HEADER?.trim()) ||
    "";
  if (!raw) return null;
  const lower = raw.toLowerCase();
  return HEADER_ALIASES[lower] ?? raw;
}

/**
 * Resolve IP apenas do header do provedor configurado.
 * Sem config ou valor inválido → null (pula throttle por IP).
 */
export async function resolveTrustedClientIp(): Promise<string | null> {
  const headerName = configuredHeaderName();
  if (!headerName) return null;
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const raw = request.headers.get(headerName)?.trim();
    if (!raw) return null;
    const candidate = raw.split(",")[0]?.trim() ?? "";
    if (!candidate) return null;
    const ip = candidate.slice(0, 64);
    if (!isValidIpAddress(ip)) return null;
    return ip;
  } catch {
    return null;
  }
}
