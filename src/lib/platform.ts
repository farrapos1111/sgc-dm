import { Capacitor } from "@capacitor/core";

/**
 * Plataforma em que o app está rodando.
 * Tudo que for exclusivo do app nativo deve ficar atrás de `isNative()`.
 * No navegador (e no servidor, durante o SSR) ambas retornam `false`.
 */
export type AppPlatform = "web" | "ios" | "android";

export function getPlatform(): AppPlatform {
  if (typeof window === "undefined") return "web";
  return Capacitor.getPlatform() as AppPlatform;
}

/** Rodando dentro do app (iOS/Android), não no navegador. */
export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}

/** Rodando dentro do app de iPhone/iPad. */
export function isIOS(): boolean {
  return isNative() && getPlatform() === "ios";
}
