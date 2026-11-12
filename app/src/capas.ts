// Capas automáticas: tenta os endereços do repositório de capas da Libretro (nomes no padrão No-Intro) e guarda o que deu certo.
import { infoDoConsole } from "./consoles.ts";

const BASE = "https://thumbnails.libretro.com";
export interface DadosDaCapa { titulo: string; caminho: string; plataforma: string; regioes?: string[]; capa_online?: string | null }

/** A Libretro troca estes caracteres por "_" nos nomes de arquivo. */
export const nomeSeguro = (n: string) => n.replace(/[&*/:`<>?\\|"]/g, "_");

/** "The Legend of Zelda - A Link to the Past" → "Legend of Zelda, The - A Link to the Past" (como no No-Intro). */
export function artigoNoFim(titulo: string): string {
  const i = titulo.indexOf(" - ");
  const principal = i >= 0 ? titulo.slice(0, i) : titulo;
  const resto = i >= 0 ? titulo.slice(i) : "";
  const m = /^(The|A|An) (.+)$/.exec(principal);
  return m ? `${m[2]}, ${m[1]}${resto}` : titulo;
}

const REGIAO_EN: Record<string, string> = { EUA: "USA", Europa: "Europe", "Japão": "Japan", Brasil: "Brazil", Mundo: "World" };

export function nomeDoArquivo(caminho: string): string {
  const base = caminho.split(/[\\/]/).pop() ?? caminho;
  const ponto = base.lastIndexOf(".");
  return ponto > 0 && base.length - ponto <= 6 ? base.slice(0, ponto) : base;
}

/** Endereços possíveis da capa, do mais provável ao menos (no máximo 7). */
export function candidatosDeCapa(j: DadosDaCapa): string[] {
  const sistema = infoDoConsole(j.plataforma).libretro;
  const urls: string[] = [];
  if (j.capa_online) urls.push(j.capa_online);
  if (!sistema) return urls;
  const nomes: string[] = [nomeDoArquivo(j.caminho)];
  const base = artigoNoFim(j.titulo);
  const regioes = [...(j.regioes ?? []).map((r) => REGIAO_EN[r]).filter(Boolean), "USA", "Europe", "World", "Japan", "Brazil"];
  for (const r of regioes) nomes.push(`${base} (${r})`);
  nomes.push(base);
  const vistos = new Set<string>();
  for (const n of nomes) {
    const u = `${BASE}/${encodeURIComponent(sistema)}/Named_Boxarts/${encodeURIComponent(nomeSeguro(n))}.png`;
    if (!vistos.has(u)) { vistos.add(u); urls.push(u); }
  }
  return urls.slice(0, 7);
}

// ---- resolução no navegador (com cache e poucas conexões ao mesmo tempo)
const CHAVE = "vortex:capas";
const REPETIR_DEPOIS_S = 7 * 24 * 3600;
type Registro = { u: string } | { f: number };
let cache: Record<string, Registro> | null = null;
let gravar: number | undefined;
const emAndamento = new Map<string, Promise<string | null>>();
let ativos = 0;
const fila: (() => void)[] = [];

function memoria(): Record<string, Registro> {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(CHAVE) ?? "{}") as Record<string, Registro>; } catch { cache = {}; }
  if (!cache || typeof cache !== "object") cache = {};
  return cache;
}
function guardar() {
  window.clearTimeout(gravar);
  gravar = window.setTimeout(() => { try { localStorage.setItem(CHAVE, JSON.stringify(cache)); } catch { /* sem espaço: vale só nesta sessão */ } }, 800);
}

/** Ícones que já vêm prontos (apps do Android): ficam só na memória, nunca no localStorage. */
const locais = new Map<string, string>();
export const registrarCapaLocal = (id: string, url: string) => { locais.set(id, url); };

/** Capa que já se sabe qual é (sem rede). */
export function capaConhecida(id: string): string | null {
  const l = locais.get(id);
  if (l) return l;
  const r = memoria()[id];
  return r && "u" in r ? r.u : null;
}

const testar = (url: string) => new Promise<boolean>((ok) => {
  const img = new Image();
  const fim = window.setTimeout(() => { img.src = ""; ok(false); }, 8000);
  img.onload = () => { window.clearTimeout(fim); ok(img.naturalWidth > 8); };
  img.onerror = () => { window.clearTimeout(fim); ok(false); };
  img.src = url;
});

function vez(): Promise<void> {
  return new Promise((ok) => { const ir = () => { ativos++; ok(); }; if (ativos < 4) ir(); else fila.push(ir); });
}

/** Acha (e lembra) a capa de um jogo. null = não existe na internet; a tentativa se repete depois de uma semana. */
export function resolverCapa(j: DadosDaCapa & { id: string }): Promise<string | null> {
  const local = locais.get(j.id);
  if (local) return Promise.resolve(local);
  const feito = memoria()[j.id];
  if (feito && "u" in feito) return Promise.resolve(feito.u);
  if (feito && "f" in feito && Date.now() / 1000 - feito.f < REPETIR_DEPOIS_S) return Promise.resolve(null);
  const em = emAndamento.get(j.id);
  if (em) return em;
  const p = (async () => {
    await vez();
    try {
      for (const u of candidatosDeCapa(j)) {
        if (await testar(u)) { memoria()[j.id] = { u }; guardar(); return u; }
      }
      memoria()[j.id] = { f: Math.floor(Date.now() / 1000) }; guardar();
      return null;
    } finally { ativos--; fila.shift()?.(); emAndamento.delete(j.id); }
  })();
  emAndamento.set(j.id, p);
  return p;
}
