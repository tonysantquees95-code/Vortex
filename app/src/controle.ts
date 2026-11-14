// Controle físico (Android e Windows): reconhecer o controle, guardar perfis de botões e achar driver.
// Tudo aqui é lógica pura (sem tela), para poder testar.

export interface IdDoControle { nome: string; vid: string; pid: string }

/** O Chromium entrega o id assim: "Nome (STANDARD GAMEPAD Vendor: 045e Product: 028e)" ou "045e-028e-Nome" (formato antigo). */
export function lerId(id: string): IdDoControle {
  let vid = "", pid = "", nome = id.trim();
  const a = /Vendor:\s*([0-9a-f]{4})\s+Product:\s*([0-9a-f]{4})/i.exec(id);
  const b = /^([0-9a-f]{4})-([0-9a-f]{4})-(.*)$/i.exec(id.trim());
  if (a) { vid = a[1].toLowerCase(); pid = a[2].toLowerCase(); nome = id.replace(/\s*\(.*\)\s*$/, "").trim(); }
  else if (b) { vid = b[1].toLowerCase(); pid = b[2].toLowerCase(); nome = b[3].trim(); }
  return { nome: nome || "Controle sem nome", vid, pid };
}

/** Uma entrada física: botão de número i, ou eixo i que ficou perto do valor v (setinha e analógico). */
export type Entrada = { t: "b"; i: number } | { t: "e"; i: number; v: number };

export const PASSOS = [
  { id: "A", nome: "A (confirmar)", padrao: 0 }, { id: "B", nome: "B (voltar)", padrao: 1 },
  { id: "X", nome: "X", padrao: 2 }, { id: "Y", nome: "Y (favoritar)", padrao: 3 },
  { id: "LB", nome: "LB / L1", padrao: 4 }, { id: "RB", nome: "RB / R1", padrao: 5 },
  { id: "LT", nome: "LT / L2", padrao: 6 }, { id: "RT", nome: "RT / R2", padrao: 7 },
  { id: "Select", nome: "Select / Voltar", padrao: 8 }, { id: "Start", nome: "Start", padrao: 9 },
  { id: "L3", nome: "Apertar o analógico esquerdo (L3)", padrao: 10 }, { id: "R3", nome: "Apertar o analógico direito (R3)", padrao: 11 },
  { id: "Cima", nome: "Direcional para cima", padrao: 12 }, { id: "Baixo", nome: "Direcional para baixo", padrao: 13 },
  { id: "Esquerda", nome: "Direcional para a esquerda", padrao: 14 }, { id: "Direita", nome: "Direcional para a direita", padrao: 15 },
] as const;
export type IdPasso = (typeof PASSOS)[number]["id"];
export type Mapa = Partial<Record<IdPasso, Entrada>>;

export interface Perfil { id: string; nome: string; vid: string; pid: string; mapa: Mapa; criado: number }

const LIMITE = 0.6;
/** O que mudou desde o repouso: o primeiro botão apertado ou o primeiro eixo que saiu do lugar. */
export function detectar(repouso: number[], botoes: boolean[], eixos: number[]): Entrada | null {
  const i = botoes.findIndex(Boolean);
  if (i >= 0) return { t: "b", i };
  let melhor: Entrada | null = null, maior = 0;
  eixos.forEach((v, k) => {
    const dif = Math.abs(v - (repouso[k] ?? 0));
    // setinha (hat) solta fica em ~1,29: só vale um dos valores exatos; ruído pequeno não conta
    if (dif > LIMITE && Math.abs(v) <= 1.05 && dif > maior) { maior = dif; melhor = { t: "e", i: k, v: Math.round(v * 100) / 100 }; }
  });
  return melhor;
}

export function entradaAtiva(e: Entrada, botoes: boolean[], eixos: number[]): boolean {
  if (e.t === "b") return !!botoes[e.i];
  const x = eixos[e.i];
  if (x === undefined) return false;
  return Math.abs(e.v) < 0.95 ? Math.abs(x - e.v) < 0.15 : x * Math.sign(e.v) > LIMITE;
}

export function rotuloDaEntrada(e: Entrada | undefined): string {
  if (!e) return "não definido";
  return e.t === "b" ? `Botão ${e.i}` : `Eixo ${e.i} (${e.v > 0 ? "+" : ""}${e.v})`;
}

/** Converte o que o controle mandou para o formato padrão (botões 0-15 como no Xbox), usando o perfil. Sem perfil, devolve igual. */
export function normalizar(mapa: Mapa | null, botoes: boolean[], eixos: number[]): { botoes: boolean[]; eixos: number[] } {
  if (!mapa) return { botoes, eixos };
  const saida = botoes.slice();
  for (const p of PASSOS) {
    const e = mapa[p.id];
    if (e) saida[p.padrao] = entradaAtiva(e, botoes, eixos);
  }
  // com os direcionais definidos no perfil, a setinha crua não pode mandar de novo
  const temDirecional = (["Cima", "Baixo", "Esquerda", "Direita"] as const).some((k) => mapa[k]);
  return { botoes: saida, eixos: temDirecional ? eixos.map((v, k) => (k === 9 ? 1.3 : v)) : eixos };
}

/** Onde procurar o driver quando o Windows não reconhece o controle. */
export function linksDeDriver(c: IdDoControle): { nome: string; url: string; detalhe: string }[] {
  const V = c.vid.toUpperCase(), P = c.pid.toUpperCase();
  const q = encodeURIComponent(c.vid ? `${c.nome} driver Windows VID_${V} PID_${P}` : `${c.nome} driver Windows`);
  const lista = [] as { nome: string; url: string; detalhe: string }[];
  if (c.vid) {
    lista.push({ nome: "Catálogo da Microsoft Update", url: `https://www.catalog.update.microsoft.com/Search.aspx?q=${encodeURIComponent(`VID_${V}&PID_${P}`)}`, detalhe: "Drivers assinados pela Microsoft para esse código de aparelho." });
    lista.push({ nome: "Quem fabrica (DeviceHunt)", url: `https://devicehunt.com/view/type/usb/vendor/${V}/device/${P}`, detalhe: "Mostra o fabricante e o nome oficial do aparelho." });
  }
  lista.push({ nome: "Pesquisar na internet", url: `https://www.google.com/search?q=${q}`, detalhe: "Busca o driver pelo nome e pelo código do controle." });
  return lista;
}

// ----- perfis guardados no aparelho -----
const CHAVE = "vortex:controles:perfis";
const CHAVE_ATIVOS = "vortex:controles:ativos";
let cache: { perfis: Perfil[]; ativos: Record<string, string> } | null = null;

function ler(): { perfis: Perfil[]; ativos: Record<string, string> } {
  if (cache) return cache;
  let perfis: Perfil[] = [], ativos: Record<string, string> = {};
  try { const p = JSON.parse(localStorage.getItem(CHAVE) ?? "[]"); if (Array.isArray(p)) perfis = p; } catch { /* vazio */ }
  try { const a = JSON.parse(localStorage.getItem(CHAVE_ATIVOS) ?? "{}"); if (a && typeof a === "object") ativos = a; } catch { /* vazio */ }
  cache = { perfis, ativos };
  return cache;
}
function gravar() {
  if (!cache) return;
  try { localStorage.setItem(CHAVE, JSON.stringify(cache.perfis)); localStorage.setItem(CHAVE_ATIVOS, JSON.stringify(cache.ativos)); } catch { /* sem armazenamento */ }
}
const chaveDe = (c: { vid: string; pid: string }) => `${c.vid}:${c.pid}`;

export const perfisDe = (c: { vid: string; pid: string }): Perfil[] => ler().perfis.filter((p) => chaveDe(p) === chaveDe(c));
export const perfilAtivoDe = (c: { vid: string; pid: string }): Perfil | null => {
  const e = ler(); const id = e.ativos[chaveDe(c)];
  return e.perfis.find((p) => p.id === id) ?? null;
};
export function salvarPerfil(c: IdDoControle, mapa: Mapa, nome?: string): Perfil {
  const e = ler();
  const n = e.perfis.filter((p) => chaveDe(p) === chaveDe(c)).length + 1;
  const p: Perfil = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, nome: nome?.trim() || `Perfil ${n}`, vid: c.vid, pid: c.pid, mapa, criado: Date.now() };
  e.perfis.push(p); e.ativos[chaveDe(c)] = p.id; gravar();
  return p;
}
export function usarPerfil(c: { vid: string; pid: string }, id: string | null) {
  const e = ler();
  if (id) e.ativos[chaveDe(c)] = id; else delete e.ativos[chaveDe(c)];
  gravar();
}
export function apagarPerfil(id: string) {
  const e = ler();
  e.perfis = e.perfis.filter((p) => p.id !== id);
  for (const k of Object.keys(e.ativos)) if (e.ativos[k] === id) delete e.ativos[k];
  gravar();
}

/** Enquanto a configuração de botões escuta o controle, a navegação do Vortex fica quieta (senão o A clicaria e o B voltaria). */
let escutando = false;
export const definirEscutando = (v: boolean) => { escutando = v; };
export const estaEscutando = () => escutando;
