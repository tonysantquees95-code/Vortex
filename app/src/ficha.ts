// Ficha completa do jogo: descrição, ano, gênero, produtora e jogadores, buscados na Wikipédia/Wikidata (sem chave, só leitura)
// e lembrados no aparelho. O que o próprio arquivo já traz (gamelist, .txt) sempre vale mais que o da internet.
import { infoDoConsole } from "./consoles.ts";

export interface Ficha { descricao?: string; ano?: number; genero?: string; desenvolvedor?: string; editora?: string; jogadores?: string; fonte?: string; fonteUrl?: string }

const palavras = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((p) => p && !["the", "a", "an", "of", "and", "de", "o", "a"].includes(p));

/** 0 a 1: o quanto o título do jogo e o da página se parecem. */
export function semelhanca(a: string, b: string): number {
  const x = new Set(palavras(a)), y = new Set(palavras(b));
  if (!x.size || !y.size) return 0;
  let comum = 0;
  for (const p of x) if (y.has(p)) comum++;
  return comum / Math.max(x.size, y.size);
}

/** "+1990-03-04T00:00:00Z" → 1990 */
export function anoDeWikidata(t: unknown): number | undefined {
  const m = typeof t === "string" ? /^[+-]?(\d{4})/.exec(t) : null;
  const a = m ? Number(m[1]) : 0;
  return a >= 1950 && a <= 2100 ? a : undefined;
}

/** Primeiras frases do texto, até o limite, sem cortar no meio. */
export function resumir(t: string, max = 520): string {
  const limpo = t.replace(/\s+/g, " ").replace(/\[\d+\]/g, "").trim();
  if (limpo.length <= max) return limpo;
  const corte = limpo.slice(0, max);
  const fim = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("! "));
  return fim > max * 0.5 ? corte.slice(0, fim + 1) : corte.replace(/\s+\S*$/, "") + "…";
}

const MODO: Record<string, string> = { Q208850: "1 jogador", Q6895044: "Multijogador", Q1332065: "Cooperativo", Q1758: "" };

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const get = async (url: string): Promise<Json | null> => {
  try {
    const c = new AbortController();
    const t = window.setTimeout(() => c.abort(), 9000);
    const r = await fetch(url, { signal: c.signal });
    window.clearTimeout(t);
    return r.ok ? ((await r.json()) as Json) : null;
  } catch { return null; }
};
const API = (lang: string, q: string) => `https://${lang}.wikipedia.org/w/api.php?format=json&origin=*&${q}`;
const idsDe = (claims: Json, p: string): string[] => ((claims[p] ?? []) as Json[]).map((c) => c.mainsnak?.datavalue?.value?.id as string | undefined).filter((x): x is string => Boolean(x));

/** Busca na internet. null = não achei nada confiável. */
export async function buscarFicha(titulo: string, plataforma: string): Promise<Ficha | null> {
  const curto = infoDoConsole(plataforma).curto;
  const base = titulo.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  const q = encodeURIComponent(`${base} ${curto} video game`);
  const r = await get(API("en", `action=query&generator=search&gsrsearch=${q}&gsrlimit=6&prop=pageprops|extracts&ppprop=wikibase_item&exintro=1&explaintext=1&exlimit=6`));
  const paginas = Object.values((r?.query?.pages ?? {}) as Record<string, Json>).sort((a, b) => (a.index ?? 9) - (b.index ?? 9));
  const pagina = paginas.find((p) => semelhanca(base, String(p.title)) >= 0.6 && /video game|videogame|game (developed|published)|(is|was) an? .*game/i.test(String(p.extract ?? "")));
  if (!pagina) return null;
  const ficha: Ficha = { fonte: "Wikipédia", fonteUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(pagina.title).replace(/ /g, "_"))}` };
  // descrição: em português quando existir a página; senão em inglês
  const ll = await get(API("en", `action=query&titles=${encodeURIComponent(String(pagina.title))}&prop=langlinks&lllang=pt`));
  const ptTitulo = (Object.values((ll?.query?.pages ?? {}) as Record<string, Json>)[0]?.langlinks?.[0]?.["*"]) as string | undefined;
  if (ptTitulo) {
    const pt = await get(API("pt", `action=query&titles=${encodeURIComponent(ptTitulo)}&prop=extracts&exintro=1&explaintext=1`));
    const t = (Object.values((pt?.query?.pages ?? {}) as Record<string, Json>)[0]?.extract) as string | undefined;
    if (t) { ficha.descricao = resumir(t); ficha.fonteUrl = `https://pt.wikipedia.org/wiki/${encodeURIComponent(ptTitulo.replace(/ /g, "_"))}`; }
  }
  if (!ficha.descricao && pagina.extract) ficha.descricao = resumir(String(pagina.extract));
  // dados estruturados
  const q1 = pagina.pageprops?.wikibase_item as string | undefined;
  if (q1) {
    const e = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&ids=${q1}&props=claims`);
    const claims = (e?.entities?.[q1]?.claims ?? {}) as Json;
    const datas = ((claims.P577 ?? []) as Json[]).map((c) => anoDeWikidata(c.mainsnak?.datavalue?.value?.time)).filter((x): x is number => x != null);
    if (datas.length) ficha.ano = Math.min(...datas);
    const gen = idsDe(claims, "P136"), dev = idsDe(claims, "P178"), edi = idsDe(claims, "P123"), modo = idsDe(claims, "P404");
    const todos = [...new Set([...gen.slice(0, 3), ...dev.slice(0, 2), ...edi.slice(0, 2)])];
    if (todos.length) {
      const l = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&ids=${todos.join("|")}&props=labels&languages=pt|pt-br|en`);
      const nome = (id: string) => { const lb = (l?.entities?.[id]?.labels ?? {}) as Json; return (lb["pt-br"] ?? lb.pt ?? lb.en)?.value as string | undefined; };
      const lista = (ids: string[], n: number) => ids.slice(0, n).map(nome).filter((x): x is string => Boolean(x)).join(", ") || undefined;
      ficha.genero = lista(gen, 3);
      ficha.desenvolvedor = lista(dev, 2);
      ficha.editora = lista(edi, 2);
    }
    const modos = [...new Set(modo.map((m) => MODO[m]).filter(Boolean))];
    if (modos.length) ficha.jogadores = modos.join(" · ");
  }
  return ficha;
}

// ---- cache no aparelho
const CHAVE = "vortex:fichas";
const REPETIR_S = 14 * 24 * 3600;
type Reg = { d: Ficha | null; t: number };
let cache: Record<string, Reg> | null = null;
const andamento = new Map<string, Promise<Ficha | null>>();
function memoria(): Record<string, Reg> {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(CHAVE) ?? "{}") as Record<string, Reg>; } catch { cache = {}; }
  if (!cache || typeof cache !== "object") cache = {};
  return cache;
}
const guardar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(cache)); } catch { /* vale só nesta sessão */ } };

export function fichaConhecida(id: string): Ficha | null | undefined {
  const r = memoria()[id];
  return r && Date.now() / 1000 - r.t < REPETIR_S ? r.d : undefined; // undefined = ainda não se sabe
}

export function resolverFicha(id: string, titulo: string, plataforma: string): Promise<Ficha | null> {
  const f = fichaConhecida(id);
  if (f !== undefined) return Promise.resolve(f);
  const em = andamento.get(id);
  if (em) return em;
  const p = buscarFicha(titulo, plataforma).then((d) => { memoria()[id] = { d, t: Math.floor(Date.now() / 1000) }; guardar(); return d; }).finally(() => andamento.delete(id));
  andamento.set(id, p);
  return p;
}

/** Endereços de pesquisa para "como passar o jogo" (abrem no navegador). */
export function atalhosDeGuia(titulo: string, plataforma: string): { nome: string; url: string }[] {
  const nome = `${titulo.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim()} ${infoDoConsole(plataforma).curto}`;
  const q = encodeURIComponent(nome);
  return [
    { nome: "Vídeo: como zerar", url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${nome} como zerar gameplay completo`)}` },
    { nome: "Guia passo a passo", url: `https://www.google.com/search?q=${encodeURIComponent(`${nome} guia passo a passo detonado`)}` },
    { nome: "Dicas e truques", url: `https://gamefaqs.gamespot.com/search?game=${q}` },
  ];
}
