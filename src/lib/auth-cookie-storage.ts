/** Cookie storage for Supabase Auth, shared across *.templovirtual.app. */

const CHUNK_SIZE = 3500;

function cookieDomain(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window.location.hostname;
  if (host === "templovirtual.app" || host.endsWith(".templovirtual.app")) {
    return ".templovirtual.app";
  }
  return undefined;
}

function cookieSecure(): boolean {
  if (typeof window === "undefined") return true;
  return window.location.protocol === "https:";
}

function writeCookie(name: string, value: string, maxAgeSec: number) {
  const domain = cookieDomain();
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "path=/",
    `max-age=${maxAgeSec}`,
    "SameSite=Lax",
  ];
  if (domain) parts.push(`domain=${domain}`);
  if (cookieSecure()) parts.push("Secure");
  document.cookie = parts.join("; ");
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const found = document.cookie.split("; ").find((row) => row.startsWith(prefix));
  if (!found) return null;
  try {
    return decodeURIComponent(found.slice(prefix.length));
  } catch {
    return found.slice(prefix.length);
  }
}

function deleteCookie(name: string) {
  writeCookie(name, "", 0);
}

export const supabaseAuthCookieStorage = {
  getItem(key: string): string | null {
    const chunksRaw = readCookie(`${key}.chunks`);
    if (!chunksRaw) {
      return readCookie(key);
    }
    const n = Number(chunksRaw);
    if (!Number.isFinite(n) || n < 1) return null;
    let out = "";
    for (let i = 0; i < n; i++) {
      const part = readCookie(`${key}.${i}`);
      if (part == null) return null;
      out += part;
    }
    return out;
  },
  setItem(key: string, value: string) {
    const existingChunks = Number(readCookie(`${key}.chunks`) ?? "0");
    if (value.length <= CHUNK_SIZE) {
      writeCookie(key, value, 60 * 60 * 24 * 400);
      deleteCookie(`${key}.chunks`);
      for (let i = 0; i < Math.max(existingChunks, 1); i++) {
        deleteCookie(`${key}.${i}`);
      }
      return;
    }
    const n = Math.ceil(value.length / CHUNK_SIZE);
    deleteCookie(key);
    writeCookie(`${key}.chunks`, String(n), 60 * 60 * 24 * 400);
    for (let i = 0; i < n; i++) {
      writeCookie(
        `${key}.${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        60 * 60 * 24 * 400,
      );
    }
    for (let i = n; i < existingChunks; i++) {
      deleteCookie(`${key}.${i}`);
    }
  },
  removeItem(key: string) {
    const existingChunks = Number(readCookie(`${key}.chunks`) ?? "0");
    deleteCookie(key);
    deleteCookie(`${key}.chunks`);
    for (let i = 0; i < Math.max(existingChunks, 8); i++) {
      deleteCookie(`${key}.${i}`);
    }
  },
};
