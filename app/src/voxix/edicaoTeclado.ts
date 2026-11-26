// Teclas e edição do teclado do Voxix (puro, sem React).
// Sem tecla de ç, como no teclado do Android: o ç sai segurando o C (assim ninguém toca nele sem querer na ponta da fileira).
export const LETRAS: string[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];
export const NUMEROS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["@", "#", "$", "%", "&", "-", "+", "(", ")", "/"],
  ["*", "\"", "'", ":", ";", "!", "?"],
];
/** Fileira de números que fica em cima das letras (como no teclado do Android). */
export const LINHA_NUMEROS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
/** Símbolo pequeno no canto de cada letra (como no teclado do Android); segurar a tecla digita ele. */
export const DICAS: Record<string, string> = {
  q: "%", w: "\\", e: "|", r: "=", t: "[", y: "]", u: "<", i: ">", o: "{", p: "}",
  a: "@", s: "#", d: "$", f: "-", g: "&", h: "-", j: "+", k: "(", l: ")",
  z: "*", x: "\"", c: "'", v: ":", b: ";", n: "!", m: "?",
};
/** Letras que abrem as variações com acento ao segurar. */
export const ACENTOS: Record<string, string[]> = {
  a: ["á", "à", "â", "ã", "ä"], e: ["é", "è", "ê", "ë"], i: ["í", "ì", "î", "ï"],
  o: ["ó", "ò", "ô", "õ", "ö"], u: ["ú", "ù", "û", "ü"], c: ["ç"], n: ["ñ"],
};
export const TECLADO_ALTURA: Record<"baixa" | "media" | "alta", number> = { baixa: 38, media: 44, alta: 50 };

export interface Edicao { texto: string; pos: number }

/** Coloca `ins` no lugar da seleção (ini..fim) e devolve o texto novo e onde fica o cursor. */
export function inserir(texto: string, ini: number, fim: number, ins: string): Edicao {
  const a = Math.max(0, Math.min(ini, texto.length));
  const b = Math.max(a, Math.min(fim, texto.length));
  return { texto: texto.slice(0, a) + ins + texto.slice(b), pos: a + ins.length };
}

/** Apaga a seleção, ou o caractere antes do cursor (inteiro, mesmo sendo emoji com mais de uma unidade). */
export function apagar(texto: string, ini: number, fim: number): Edicao {
  const a = Math.max(0, Math.min(ini, texto.length));
  const b = Math.max(a, Math.min(fim, texto.length));
  if (b > a) return { texto: texto.slice(0, a) + texto.slice(b), pos: a };
  if (a === 0) return { texto, pos: 0 };
  const antes = Array.from(texto.slice(0, a));
  const tirado = antes.pop() ?? "";
  return { texto: antes.join("") + texto.slice(a), pos: a - tirado.length };
}

/** Maiúscula depois de ponto, ! ou ? seguidos de espaço, e no começo do texto. */
export function comecaFrase(texto: string, pos: number): boolean {
  const antes = texto.slice(0, pos);
  return antes.trim() === "" || /[.!?]\s+$/.test(antes) || /\n$/.test(antes);
}
