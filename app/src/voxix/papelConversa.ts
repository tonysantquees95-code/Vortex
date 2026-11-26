// Papel de parede de cada conversa (escolhido pelo menu dos três pontinhos): vale só para aquela conversa, neste aparelho.
// Sem escolha, a conversa usa o papel padrão de Ajustes › Personalizar.
import { useMemo, useSyncExternalStore } from "react";
import { PAPEL_PADRAO, MODELOS_PAPEL, type Papel } from "./personalizar.ts";

const CHAVE = "voxix.papel.conv";
const chaveFoto = (c: string) => `voxix.papel.convfoto.${c}`;
const ouvintes = new Set<() => void>();
let versao = 0;
const avisar = () => { versao++; ouvintes.forEach((f) => f()); };

const modeloOk = (m: unknown): m is Papel["modelo"] => MODELOS_PAPEL.some((x) => x.id === m);
function lerMapa(): Record<string, Papel> {
  try {
    const o = JSON.parse(localStorage.getItem(CHAVE) || "{}") as Record<string, { modelo?: unknown; escurecer?: unknown }>;
    const r: Record<string, Papel> = {};
    for (const [k, v] of Object.entries(o ?? {})) if (v && modeloOk(v.modelo)) r[k] = { modelo: v.modelo, escurecer: Math.max(0, Math.min(85, Number(v.escurecer) || PAPEL_PADRAO.escurecer)) };
    return r;
  } catch { return {}; }
}
const fotoValida = (s: unknown): s is string => typeof s === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 1_800_000;

export interface PapelEscolhido { cfg: Papel; foto: string | null }
export function papelDaConversa(chave: string): PapelEscolhido | null {
  const cfg = lerMapa()[chave.toLowerCase()];
  if (!cfg) return null;
  let foto: string | null = null;
  if (cfg.modelo === "foto") { try { const v = localStorage.getItem(chaveFoto(chave.toLowerCase())); foto = fotoValida(v) ? v : null; } catch { foto = null; } }
  return { cfg, foto };
}
export function usePapelDaConversa(chave: string): PapelEscolhido | null {
  const v = useSyncExternalStore((f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, () => versao, () => 0);
  return useMemo(() => papelDaConversa(chave), [chave, v]);
}
/** Guarda (ou, com null, apaga) a escolha desta conversa. Devolve false se não coube no aparelho. */
export function definirPapelDaConversa(chave: string, cfg: Papel | null, foto?: string | null): boolean {
  const k = chave.toLowerCase();
  try {
    const mapa = lerMapa();
    if (cfg === null) { delete mapa[k]; localStorage.removeItem(chaveFoto(k)); }
    else {
      mapa[k] = cfg;
      if (foto !== undefined) { if (foto === null) localStorage.removeItem(chaveFoto(k)); else if (fotoValida(foto)) localStorage.setItem(chaveFoto(k), foto); else return false; }
    }
    localStorage.setItem(CHAVE, JSON.stringify(mapa));
  } catch { return false; }
  avisar();
  return true;
}
/** A conversa foi apagada: leva o papel dela junto. */
export const esquecerPapelDaConversa = (chave: string): void => { definirPapelDaConversa(chave, null); };
