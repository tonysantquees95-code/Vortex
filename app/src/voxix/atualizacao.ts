// Atualização do Voxix: pergunta ao servidor da Vênus qual é a versão mais nova e compara com a instalada.
import { SERVIDOR } from "./api";
import { plataforma } from "./conta";

export const BUILD: number = (() => {
  const n = Number((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_BUILD);
  return Number.isInteger(n) && n > 0 ? n : 0;
})();

export interface InfoVersao { numero: number; notas: string }
export const haNovaVersao = (instalada: number, nova: number | undefined | null): boolean => instalada > 0 && !!nova && nova > instalada;

const appDoServidor = (): string | null => (plataforma() === "android" ? "voxix-android" : plataforma() === "windows" ? "voxix-windows" : null);

export async function procurarVersao(): Promise<InfoVersao | null> {
  const app = appDoServidor();
  if (!app) return null;
  const r = await fetch(`${SERVIDOR}/atualizacao?app=${app}`, { cache: "no-store" });
  if (!r.ok) return null;
  const d = (await r.json()) as { numero?: number; notas?: string };
  return typeof d.numero === "number" ? { numero: d.numero, notas: String(d.notas ?? "").slice(0, 300) } : null;
}

/** Endereço que baixa a versão nova (o servidor leva até o arquivo no GitHub). */
export const enderecoDoDownload = (): string => `${SERVIDOR}/atualizacao?app=${appDoServidor() ?? "voxix-android"}&baixar=1`;
