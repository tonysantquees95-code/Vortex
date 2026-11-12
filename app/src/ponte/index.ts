import { Capacitor } from "@capacitor/core";
import { motorAndroid } from "./android";
import { motorDemo } from "./demo";
import { motorTauri } from "./tauri";
import type { Motor } from "./tipos";

export * from "./tipos";

/** Escolhe o motor certo para onde o app está rodando. */
export async function criarMotor(): Promise<Motor> {
  if (Capacitor.isNativePlatform()) return motorAndroid();
  if ("__TAURI_INTERNALS__" in window) return motorTauri();
  return motorDemo();
}
