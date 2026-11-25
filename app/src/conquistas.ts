// Conquistas locais: marcos calculados só a partir da biblioteca da própria pessoa (tempo jogado, sessões, favoritos, consoles).
// Nada é enviado a lugar nenhum e nada precisa ser guardado para saber se foi cumprida: o que se guarda é só quais ela já viu.
import type { Jogo } from "./ponte/tipos.ts";

export interface Conquista {
  id: string;
  nome: string;
  descricao: string;
  atual: number;   // quanto já fez
  meta: number;    // quanto precisa
  feita: boolean;
  /** como mostrar o progresso: número simples ou horas */
  unidade: "jogos" | "horas" | "sessoes" | "consoles" | "favoritos";
}

interface Regra { id: string; nome: string; descricao: string; meta: number; unidade: Conquista["unidade"]; medir: (r: Resumo) => number }

export interface Resumo {
  jogos: number;           // jogos na biblioteca (sem os de Android instalados, que o Vortex não conta como ROM)
  horas: number;           // horas jogadas, com fração
  sessoes: number;
  favoritos: number;
  consolesJogados: number; // consoles diferentes onde já jogou algo
  maisAntigo: number | null; // menor ano entre os jogos já jogados
  maiorTempoEmUm: number;  // horas no jogo mais jogado
}

export function resumir(jogos: Jogo[]): Resumo {
  const roms = jogos.filter((j) => j.plataforma !== "android");
  const jogados = roms.filter((j) => j.sessoes > 0 || j.tempo_total_s > 0);
  const consoles = new Set(jogados.map((j) => j.plataforma));
  const anos = jogados.map((j) => j.ano).filter((a): a is number => typeof a === "number" && a > 1950);
  return {
    jogos: roms.length,
    horas: roms.reduce((s, j) => s + Math.max(0, j.tempo_total_s), 0) / 3600,
    sessoes: roms.reduce((s, j) => s + Math.max(0, j.sessoes), 0),
    favoritos: roms.filter((j) => j.favorito).length,
    consolesJogados: consoles.size,
    maisAntigo: anos.length ? Math.min(...anos) : null,
    maiorTempoEmUm: roms.reduce((m, j) => Math.max(m, j.tempo_total_s), 0) / 3600,
  };
}

const REGRAS: Regra[] = [
  { id: "primeiro", nome: "Primeira partida", descricao: "Jogue qualquer jogo pelo Vortex.", meta: 1, unidade: "sessoes", medir: (r) => r.sessoes },
  { id: "sessoes25", nome: "Voltando sempre", descricao: "Abra jogos 25 vezes.", meta: 25, unidade: "sessoes", medir: (r) => r.sessoes },
  { id: "sessoes100", nome: "Rotina de jogador", descricao: "Abra jogos 100 vezes.", meta: 100, unidade: "sessoes", medir: (r) => r.sessoes },
  { id: "horas5", nome: "Esquentando", descricao: "Some 5 horas jogadas.", meta: 5, unidade: "horas", medir: (r) => r.horas },
  { id: "horas25", nome: "Maratonista", descricao: "Some 25 horas jogadas.", meta: 25, unidade: "horas", medir: (r) => r.horas },
  { id: "horas100", nome: "Cem horas", descricao: "Some 100 horas jogadas.", meta: 100, unidade: "horas", medir: (r) => r.horas },
  { id: "um10", nome: "Esse eu não largo", descricao: "Passe 10 horas em um único jogo.", meta: 10, unidade: "horas", medir: (r) => r.maiorTempoEmUm },
  { id: "colecao25", nome: "Coleção começando", descricao: "Tenha 25 jogos na biblioteca.", meta: 25, unidade: "jogos", medir: (r) => r.jogos },
  { id: "colecao100", nome: "Colecionador", descricao: "Tenha 100 jogos na biblioteca.", meta: 100, unidade: "jogos", medir: (r) => r.jogos },
  { id: "colecao500", nome: "Museu em casa", descricao: "Tenha 500 jogos na biblioteca.", meta: 500, unidade: "jogos", medir: (r) => r.jogos },
  { id: "consoles3", nome: "Explorador", descricao: "Jogue em 3 consoles diferentes.", meta: 3, unidade: "consoles", medir: (r) => r.consolesJogados },
  { id: "consoles8", nome: "Viajante dos consoles", descricao: "Jogue em 8 consoles diferentes.", meta: 8, unidade: "consoles", medir: (r) => r.consolesJogados },
  { id: "fav10", nome: "Os queridinhos", descricao: "Favorite 10 jogos.", meta: 10, unidade: "favoritos", medir: (r) => r.favoritos },
  // 1 = jogou algo de antes de 1990
  { id: "classico", nome: "Clássico de verdade", descricao: "Jogue um jogo lançado antes de 1990.", meta: 1, unidade: "jogos", medir: (r) => (r.maisAntigo !== null && r.maisAntigo < 1990 ? 1 : 0) },
];

export function conquistasDe(jogos: Jogo[]): Conquista[] {
  const r = resumir(jogos);
  return REGRAS.map((g) => {
    const bruto = g.medir(r);
    const atual = g.unidade === "horas" ? Math.round(bruto * 10) / 10 : Math.floor(bruto);
    return { id: g.id, nome: g.nome, descricao: g.descricao, atual: Math.min(atual, g.meta), meta: g.meta, feita: bruto >= g.meta, unidade: g.unidade };
  });
}

/** "12 de 25 jogos", "3,5 de 5 horas" */
export function progressoEscrito(c: Conquista): string {
  const num = (n: number) => String(n).replace(".", ",");
  const un = c.unidade === "horas" ? "horas" : c.unidade === "sessoes" ? "partidas" : c.unidade === "consoles" ? "consoles" : c.unidade === "favoritos" ? "favoritos" : "jogos";
  return `${num(c.atual)} de ${num(c.meta)} ${un}`;
}

const CHAVE = "vortex.conquistas.vistas";
export function lerVistas(): string[] | null {
  try {
    const t = localStorage.getItem(CHAVE);
    if (t === null) return null;
    const v = JSON.parse(t);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
  } catch { return null; }
}
export function guardarVistas(ids: string[]): void {
  try { localStorage.setItem(CHAVE, JSON.stringify(ids)); } catch { /* sem armazenamento: avisa de novo na próxima vez */ }
}

/** Conquistas cumpridas que a pessoa ainda não viu. Na primeira vez (nada guardado) nada é "novo": só marca o que já tinha, sem chuva de avisos. */
export function novasConquistas(lista: Conquista[], vistas: string[] | null): Conquista[] {
  if (vistas === null) return [];
  return lista.filter((c) => c.feita && !vistas.includes(c.id));
}
