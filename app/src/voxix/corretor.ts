// Corretor ortográfico do Voxix em português (puro, sem React): sugere, completa e corrige palavras, inclusive acentos.
// Funciona sem internet: usa a lista de palavras do arquivo ptbr-palavras.txt (da mais comum para a menos comum).
import { inserir, type Edicao } from "./edicaoTeclado.ts";

const ALFABETO = "abcdefghijklmnopqrstuvwxyzáàâãçéêíóôõúü";

export interface Dicionario {
  /** palavra → posição na lista (0 = a mais comum) */
  rank: Map<string, number>;
  /** forma sem acento → palavras acentuadas que a escrevem assim ("voce" → ["você"]) */
  porChave: Map<string, string[]>;
  /** duas primeiras letras (sem acento) → palavras e suas formas sem acento, da mais comum para a menos */
  porPrefixo: Map<string, { palavras: string[]; chaves: string[] }>;
}

export const semAcento = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

export function criarDicionario(palavras: readonly string[]): Dicionario {
  const rank = new Map<string, number>();
  const porChave = new Map<string, string[]>();
  const porPrefixo = new Map<string, { palavras: string[]; chaves: string[] }>();
  palavras.forEach((bruta, i) => {
    const p = bruta.trim(); // o arquivo pode chegar com fim de linha do Windows (\r\n): sem isso nenhuma palavra bateria
    if (!p || rank.has(p)) return;
    rank.set(p, i);
    const chave = semAcento(p);
    if (chave !== p) {
      const f = porChave.get(chave);
      if (f) f.push(p); else porChave.set(chave, [p]);
    }
    if (chave.length >= 2) {
      const pre = chave.slice(0, 2);
      let b = porPrefixo.get(pre);
      if (!b) { b = { palavras: [], chaves: [] }; porPrefixo.set(pre, b); }
      b.palavras.push(p);
      b.chaves.push(chave);
    }
  });
  return { rank, porChave, porPrefixo };
}

const ehLetra = (c: string): boolean => /\p{L}/u.test(c);

export interface PalavraNoCursor {
  /** onde a palavra começa */
  ini: number;
  /** a palavra (só letras) logo antes do cursor */
  palavra: string;
  /** o trecho sem espaços que termina no cursor: serve para não mexer em links, e-mails, @, # e números */
  trecho: string;
}

export function palavraAntesDoCursor(texto: string, pos: number): PalavraNoCursor {
  const fim = Math.max(0, Math.min(pos, texto.length));
  let ini = fim;
  while (ini > 0 && ehLetra(texto[ini - 1])) ini--;
  let t = fim;
  while (t > 0 && !/\s/.test(texto[t - 1])) t--;
  return { ini, palavra: texto.slice(ini, fim), trecho: texto.slice(t, fim) };
}

/** Links, e-mails, @apelidos, #tags, números e "a.b" não são corrigidos. */
const intocavel = (trecho: string): boolean => /[\d@#_/\\:]/.test(trecho) || /\p{L}\.\p{L}/u.test(trecho);

/** Mantém a caixa da palavra digitada: "Voce" → "Você", "VOCE" → "VOCÊ". */
export function igualarCaixa(original: string, nova: string): string {
  if (original.length > 1 && original === original.toUpperCase() && original !== original.toLowerCase()) return nova.toUpperCase();
  if (original[0] && original[0] !== original[0].toLowerCase()) return nova.charAt(0).toUpperCase() + nova.slice(1);
  return nova;
}

/** Todas as palavras a uma letra de distância (troca, falta, sobra ou letras trocadas de lugar) que existem no dicionário. */
function vizinhas(d: Dicionario, w: string): string[] {
  const achadas = new Set<string>();
  const ver = (c: string) => { if (c !== w && d.rank.has(c)) achadas.add(c); };
  for (let i = 0; i <= w.length; i++) {
    if (i < w.length) {
      ver(w.slice(0, i) + w.slice(i + 1));
      if (i < w.length - 1) ver(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
      for (const l of ALFABETO) ver(w.slice(0, i) + l + w.slice(i + 1));
    }
    for (const l of ALFABETO) ver(w.slice(0, i) + l + w.slice(i));
  }
  return [...achadas].sort((a, b) => (d.rank.get(a) ?? 0) - (d.rank.get(b) ?? 0));
}

/** Erros de ouvido comuns (comessar → começar, exelente → excelente, jente → gente): uma troca por vez. */
const SONS: ReadonlyArray<readonly [string, string]> = [["ss", "ç"], ["ç", "ss"], ["x", "ch"], ["ch", "x"], ["z", "s"], ["s", "z"], ["j", "g"], ["g", "j"], ["xc", "c"], ["c", "xc"], ["ss", "c"], ["c", "ss"]];
function porSom(d: Dicionario, w: string): string[] {
  const achadas = new Set<string>();
  for (const [de, para] of SONS) {
    let i = w.indexOf(de);
    while (i >= 0) {
      const c = w.slice(0, i) + para + w.slice(i + de.length);
      if (c !== w && d.rank.has(c)) achadas.add(c);
      i = w.indexOf(de, i + 1);
    }
  }
  return [...achadas].sort((a, b) => (d.rank.get(a) ?? 0) - (d.rank.get(b) ?? 0));
}

/** Palavras que começam com o que foi digitado (sem ligar para acento), as mais comuns primeiro. */
function completar(d: Dicionario, w: string, max: number): string[] {
  const chave = semAcento(w);
  if (chave.length < 2) return [];
  const b = d.porPrefixo.get(chave.slice(0, 2));
  if (!b) return [];
  const comAcento = chave !== w;
  const out: string[] = [];
  for (let i = 0; i < b.palavras.length && out.length < max; i++) {
    if (b.palavras[i] === w || !b.chaves[i].startsWith(chave)) continue;
    if (comAcento && !b.palavras[i].startsWith(w)) continue;
    out.push(b.palavras[i]);
  }
  return out;
}

export interface Sugestoes {
  /** a palavra digitada existe (no dicionário ou nas palavras que a pessoa já ensinou) */
  valida: boolean;
  /** até 3 palavras para oferecer, já na caixa da palavra digitada */
  opcoes: string[];
  /** troca automática quando a pessoa termina a palavra (null = deixar como está) */
  auto: string | null;
}

export function sugerir(d: Dicionario, digitada: string, pessoais: ReadonlySet<string> = new Set(), max = 3): Sugestoes {
  const w = digitada.toLowerCase();
  if (!w) return { valida: true, opcoes: [], auto: null };
  const valida = d.rank.has(w) || pessoais.has(w);
  const acentuadas = valida ? [] : (d.porChave.get(w) ?? []).slice().sort((a, b) => (d.rank.get(a) ?? 0) - (d.rank.get(b) ?? 0));
  const proximas = valida ? [] : vizinhas(d, w);
  const sons = valida || w.length < 4 ? [] : porSom(d, w);
  const lista: string[] = [];
  const escritas = new Set<string>();
  // uma opção por escrita sem acento: "você" entra, "voçê" e "vocé" (lixo de acento) não
  for (const c of [...acentuadas, ...sons, ...proximas, ...completar(d, w, max)]) {
    const chave = semAcento(c);
    if (c === w || lista.includes(c) || escritas.has(chave)) continue;
    escritas.add(chave);
    lista.push(c);
  }
  const opcoes = lista.slice(0, max).map((c) => igualarCaixa(digitada, c));

  let auto: string | null = null;
  const sigla = digitada.length <= 4 && digitada === digitada.toUpperCase() && digitada !== digitada.toLowerCase();
  if (!valida) {
    if (acentuadas.length && w.length >= 2) auto = acentuadas[0];
    else if (!sigla && w.length >= 4 && !/(\p{L})\1\1/u.test(w)) {
      // erro de digitação: só troca sozinho se for uma palavra bem comum e começar com a mesma letra
      const comuns = (p: string) => (d.rank.get(p) ?? Infinity) < 30000;
      const c = sons.find(comuns) ?? proximas.find((p) => p[0] === w[0] && comuns(p));
      if (c) auto = c;
    }
    if (auto) auto = igualarCaixa(digitada, auto);
  }
  return { valida, opcoes, auto };
}

export const SEPARADORES: ReadonlySet<string> = new Set([" ", ".", ",", "!", "?", ";", ":", ")", "\n"]);

export interface Correcao {
  original: string;
  corrigida: string;
  sep: string;
  /** onde o cursor ficou depois da troca (logo depois do separador) */
  fimPos: number;
}

/**
 * A pessoa digitou o separador `sep` (espaço, ponto…) no lugar da seleção ini..fim.
 * Se a palavra anterior estiver errada de um jeito seguro de consertar, já troca por ela.
 */
export function aplicarSeparador(d: Dicionario, pessoais: ReadonlySet<string>, texto: string, ini: number, fim: number, sep: string): Edicao & { correcao: Correcao | null } {
  const normal = (): Edicao & { correcao: null } => ({ ...inserir(texto, ini, fim, sep), correcao: null });
  if (ini !== fim) return normal();
  const { ini: iniPalavra, palavra, trecho } = palavraAntesDoCursor(texto, ini);
  if (!palavra || intocavel(trecho)) return normal();
  const { auto } = sugerir(d, palavra, pessoais);
  if (!auto) return normal();
  const novo = texto.slice(0, iniPalavra) + auto + sep + texto.slice(fim);
  const pos = iniPalavra + auto.length + sep.length;
  return { texto: novo, pos, correcao: { original: palavra, corrigida: auto, sep, fimPos: pos } };
}

/** Apagar logo depois de uma troca automática devolve a palavra como a pessoa escreveu. */
export function desfazerCorrecao(texto: string, pos: number, c: Correcao): Edicao | null {
  if (pos !== c.fimPos) return null;
  const ini = pos - c.sep.length - c.corrigida.length;
  if (ini < 0 || texto.slice(ini, pos) !== c.corrigida + c.sep) return null;
  return { texto: texto.slice(0, ini) + c.original + c.sep + texto.slice(pos), pos: ini + c.original.length + c.sep.length };
}

/** A pessoa tocou numa sugestão: troca a palavra pela escolhida e deixa um espaço depois. */
export function trocarPalavra(texto: string, pos: number, nova: string): Edicao {
  const { ini } = palavraAntesDoCursor(texto, pos);
  const depois = texto.slice(pos);
  const espaco = depois.startsWith(" ") || depois.startsWith("\n") ? "" : " ";
  return { texto: texto.slice(0, ini) + nova + espaco + depois, pos: ini + nova.length + (espaco ? 1 : (depois.startsWith(" ") ? 1 : 0)) };
}

/** Antes de enviar: conserta também a última palavra, que ainda não ganhou espaço depois. */
export function corrigirFim(d: Dicionario, pessoais: ReadonlySet<string>, texto: string): string {
  return aplicarSeparador(d, pessoais, texto, texto.length, texto.length, "").texto;
}
