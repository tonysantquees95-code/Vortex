// Consoles que a pessoa escondeu do Início ou tirou da biblioteca. Os arquivos nunca são mexidos: o Vortex só deixa de mostrar.
export interface Ocultos {
  esconder: string[]; fora: string[];
  /** jogos escondidos do Início (continuam na Biblioteca) e jogos tirados da biblioteca (ids) */
  jogosEsconder: string[]; jogosFora: string[];
}
const CHAVE = "vortex:ocultos";

export const OCULTOS_VAZIO: Ocultos = { esconder: [], fora: [], jogosEsconder: [], jogosFora: [] };

const lista = (x: unknown, max = 40): string[] => (Array.isArray(x) ? [...new Set(x.filter((v): v is string => typeof v === "string" && v.length > 0 && v.length < max))] : []);

export function limparOcultos(bruto: unknown): Ocultos {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const fora = lista(o.fora);
  const jogosFora = lista(o.jogosFora, 200);
  return { fora, esconder: lista(o.esconder).filter((c) => !fora.includes(c)), jogosFora, jogosEsconder: lista(o.jogosEsconder, 200).filter((c) => !jogosFora.includes(c)) };
}
export function lerOcultos(): Ocultos {
  try { return limparOcultos(JSON.parse(localStorage.getItem(CHAVE) ?? "null")); } catch { return { ...OCULTOS_VAZIO }; }
}
export function guardarOcultos(o: Ocultos) {
  try { localStorage.setItem(CHAVE, JSON.stringify(o)); } catch { /* vale só nesta sessão */ }
}

/** Esconder: some da lista do Início, os jogos continuam em "Todos". Tirar: some de tudo. Os dois são reversíveis. */
export function mudarOculto(o: Ocultos, id: string, como: "esconder" | "fora" | "mostrar"): Ocultos {
  const sem = { ...o, esconder: o.esconder.filter((c) => c !== id), fora: o.fora.filter((c) => c !== id) };
  if (como === "esconder") return { ...sem, esconder: [...sem.esconder, id] };
  if (como === "fora") return { ...sem, fora: [...sem.fora, id] };
  return sem;
}

/** O mesmo para um jogo só (pelo id): esconder do Início, tirar da biblioteca ou mostrar de novo. */
export function mudarJogo(o: Ocultos, id: string, como: "esconder" | "fora" | "mostrar"): Ocultos {
  const sem = { ...o, jogosEsconder: o.jogosEsconder.filter((c) => c !== id), jogosFora: o.jogosFora.filter((c) => c !== id) };
  if (como === "esconder") return { ...sem, jogosEsconder: [...sem.jogosEsconder, id] };
  if (como === "fora") return { ...sem, jogosFora: [...sem.jogosFora, id] };
  return sem;
}

export const aplicarFora = <T extends { plataforma: string; id?: string }>(jogos: T[], o: Ocultos): T[] =>
  o.fora.length || o.jogosFora.length ? jogos.filter((j) => !o.fora.includes(j.plataforma) && !(j.id !== undefined && o.jogosFora.includes(j.id))) : jogos;

/** Jogos que aparecem no Início (sem os escondidos). */
export const paraOInicio = <T extends { id: string }>(jogos: T[], o: Ocultos): T[] => (o.jogosEsconder.length ? jogos.filter((j) => !o.jogosEsconder.includes(j.id)) : jogos);
