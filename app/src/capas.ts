// Capas automáticas: tenta os endereços do repositório de capas da Libretro (nomes no padrão No-Intro) e guarda o que deu certo.
import { infoDoConsole } from "./consoles.ts";

const BASE = "https://thumbnails.libretro.com";
export interface DadosDaCapa { titulo: string; caminho: string; plataforma: string; regioes?: string[]; capa_online?: string | null; nome_interno?: string }

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

/** Endereços possíveis da capa, do mais provável ao menos (no máximo 11). */
export function candidatosDeCapa(j: DadosDaCapa): string[] {
  const sistema = infoDoConsole(j.plataforma).libretro;
  const urls: string[] = [];
  if (j.capa_online) urls.push(j.capa_online);
  if (!sistema) return urls;
  const arquivo = nomeDoArquivo(j.caminho);
  // sites de ROMs põem um número na frente ("3298 - Pro Evolution Soccer 2014 (Europe)"); no repositório de capas o nome não tem
  const nomes: string[] = [arquivo, arquivo.replace(/^\d{4,5} - /, "")];
  const base = artigoNoFim(j.titulo);
  const regioes = [...(j.regioes ?? []).map((r) => REGIAO_EN[r]).filter(Boolean), "USA", "Europe", "World", "Japan", "Brazil"];
  for (const r of regioes) nomes.push(`${base} (${r})`);
  nomes.push(base);
  // GameCube/Wii: o nome gravado no próprio disco (com a região do código) quando o nome do arquivo não bate
  if (j.nome_interno && j.nome_interno.trim()) {
    const interno = artigoNoFim(j.nome_interno.trim());
    for (const r of regioes.slice(0, 3)) nomes.push(`${interno} (${r})`);
  }
  const vistos = new Set<string>();
  for (const n of nomes) {
    const u = `${BASE}/${encodeURIComponent(sistema)}/Named_Boxarts/${encodeURIComponent(nomeSeguro(n))}.png`;
    if (!vistos.has(u)) { vistos.add(u); urls.push(u); }
  }
  return urls.slice(0, 11);
}

// ---- lista de capas que existem de verdade (só no Android): acha a capa mesmo quando o nome do arquivo é diferente do padrão
type FonteDeIndice = (sistema: string) => Promise<string[]>;
let fonteDeIndice: FonteDeIndice | null = null;
export const usarIndiceDeCapas = (f: FonteDeIndice | undefined) => { fonteDeIndice = f ?? null; };
const indices = new Map<string, Promise<Map<string, string[]> | null>>();

/** Nome sem região/versão, sem acento nem pontuação, com o artigo no começo ("Legend of Zelda, The" → "the legend of zelda"). */
export function chaveDeNome(n: string): string {
  let t = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/&/g, " and ");
  t = t.replace(/\b(.+?), (the|a|an)\b(?= - |$| )/, "$2 $1");
  return t.replace(/[^a-z0-9]+/g, " ").trim();
}

function indiceDe(sistema: string): Promise<Map<string, string[]> | null> {
  let p = indices.get(sistema);
  if (!p) {
    p = (async () => {
      if (!fonteDeIndice) return null;
      try {
        const m = new Map<string, string[]>();
        for (const nome of await fonteDeIndice(sistema)) { const k = chaveDeNome(nome); if (k) (m.get(k) ?? m.set(k, []).get(k)!).push(nome); }
        return m.size ? m : null;
      } catch { indices.delete(sistema); return null; }
    })();
    indices.set(sistema, p);
  }
  return p;
}

/** Escolhe, entre as capas com o mesmo nome base, a da região que o jogo tem (ou USA, Europe...). */
function melhorNome(nomes: string[], regioes: string[]): string {
  const pref = [...regioes.map((r) => REGIAO_EN[r]).filter(Boolean), "USA", "Europe", "World", "Japan"];
  for (const r of pref) { const f = nomes.find((n) => n.includes(`(${r}`)); if (f) return f; }
  return nomes[0];
}

export function acharNoIndice(ind: Map<string, string[]>, j: DadosDaCapa): string | null {
  const arquivo = nomeDoArquivo(j.caminho).replace(/^\d{4,5} - /, "");
  const consultas = [arquivo, j.titulo, j.nome_interno ?? ""].map(chaveDeNome).filter((k) => k.length >= 3);
  for (const k of consultas) { const e = ind.get(k); if (e) return melhorNome(e, j.regioes ?? []); }
  // parecido: todas as palavras de um nome estão no outro (ex.: "gta liberty city stories" x "grand theft auto liberty city stories" não entra; precisa ser contido por inteiro)
  for (const k of consultas) {
    if (k.length < 6) continue;
    for (const [chave, nomes] of ind) if (chave.startsWith(k + " ") || k.startsWith(chave + " ")) { if (Math.min(chave.length, k.length) >= 6 && Math.min(chave.length, k.length) / Math.max(chave.length, k.length) >= 0.75) return melhorNome(nomes, j.regioes ?? []); }
  }
  return null;
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
  try {
    if (localStorage.getItem("vortex:capas:sem3") !== "1") {
      for (const k of Object.keys(cache)) if ("f" in (cache[k] as object)) delete cache[k];
      localStorage.setItem("vortex:capas:sem3", "1");
      localStorage.setItem(CHAVE, JSON.stringify(cache));
    }
  } catch { /* sem armazenamento: segue só com a memória */ }
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
      const sistema = infoDoConsole(j.plataforma).libretro;
      const ind = sistema ? await indiceDe(sistema) : null;
      const exato = ind && sistema ? acharNoIndice(ind, j) : null;
      if (exato && sistema) {
        const u = `${BASE}/${encodeURIComponent(sistema)}/Named_Boxarts/${encodeURIComponent(exato)}.png`;
        if (await testar(u)) { memoria()[j.id] = { u }; guardar(); return u; }
      }
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

// ---- troca manual da capa (quando a busca automática não acha o jogo)
const avisar = (id: string) => window.dispatchEvent(new CustomEvent("vortex:capa", { detail: id }));

/** Procura nomes na lista real da Libretro: todas as palavras digitadas precisam aparecer no nome. */
export async function buscarCapas(plataforma: string, texto: string): Promise<{ nome: string; url: string }[]> {
  const sistema = infoDoConsole(plataforma).libretro;
  if (!sistema) return [];
  const ind = await indiceDe(sistema);
  if (!ind) return [];
  const palavras = chaveDeNome(texto).split(" ").filter((x) => x.length >= 2);
  if (!palavras.length) return [];
  const achados: { nome: string; url: string; nota: number }[] = [];
  for (const [chave, nomes] of ind) {
    if (!palavras.every((p) => chave.includes(p))) continue;
    for (const nome of nomes) achados.push({ nome, url: `${BASE}/${encodeURIComponent(sistema)}/Named_Boxarts/${encodeURIComponent(nome)}.png`, nota: chave.length });
  }
  return achados.sort((a, b) => a.nota - b.nota).slice(0, 24);
}

/** Fixa a capa escolhida pelo usuário (endereço ou imagem já reduzida). */
export function definirCapa(id: string, url: string) { memoria()[id] = { u: url }; guardar(); avisar(id); }

/** Esquece a capa e deixa a busca automática tentar de novo. */
export function refazerCapa(id: string) { delete memoria()[id]; guardar(); avisar(id); }

/** Imagem da galeria → JPEG pequeno (cabe no armazenamento do app). */
export function reduzirImagem(arquivo: File): Promise<string> {
  return new Promise((ok, erro) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const f = Math.min(1, 420 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * f)); c.height = Math.max(1, Math.round(img.naturalHeight * f));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error("imagem inválida")); };
    img.src = url;
  });
}
