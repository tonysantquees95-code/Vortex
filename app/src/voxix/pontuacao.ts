// Pontuação rápida, feita no aparelho, para o texto ditado. Serve na hora; depois o servidor refina com vírgulas e mais cuidado.
const INTERROGATIVAS = new Set(["quem", "que", "qual", "quais", "como", "onde", "quando", "quanto", "quantos", "quanta", "quantas", "porque", "será", "sera", "cadê", "cade", "pra", "para"]);
const COMECO_DE_PERGUNTA = [/^por que\b/, /^o que\b/, /^de que\b/, /^com que\b/, /^em que\b/, /^você (está|esta|vai|pode|quer|sabe|tem|já|ja)\b/, /^(tu|vc) (está|esta|vai|pode|quer|sabe|tem)\b/, /^(será|sera) que\b/, /^(pode|podem|poderia|consegue|conseguem|existe|há|ha|tem|têm) /];

export function pareceUmaPergunta(frase: string): boolean {
  const f = frase.trim().toLowerCase();
  if (!f) return false;
  if (COMECO_DE_PERGUNTA.some((r) => r.test(f))) return true;
  const primeira = f.split(/\s+/)[0] ?? "";
  // "pra" e "para" sozinhos não bastam (são comuns em afirmações)
  return INTERROGATIVAS.has(primeira) && !["pra", "para", "que"].includes(primeira) ? true : /^(que|qual|quais)\s/.test(f) && f.split(/\s+/).length <= 8;
}

/** Maiúscula no começo, ponto de interrogação em perguntas e ponto final. Não mexe no que já tem pontuação. */
export function pontuacaoLocal(texto: string): string {
  let t = texto.replace(/\s+/g, " ").trim();
  if (!t) return t;
  t = t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1);
  t = t.replace(/([.!?])\s+(\p{Ll})/gu, (_m, p: string, l: string) => `${p} ${l.toLocaleUpperCase("pt-BR")}`);
  if (/[.!?…:;]$/.test(t)) return t;
  const ultima = t.split(/(?<=[.!?])\s+/).pop() ?? t;
  return t + (pareceUmaPergunta(ultima) ? "?" : ".");
}
