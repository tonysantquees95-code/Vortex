// Consoles que a pessoa escondeu do Início ou tirou da biblioteca. Os arquivos nunca são mexidos: o Vortex só deixa de mostrar.
export interface Ocultos { esconder: string[]; fora: string[] }
const CHAVE = "vortex:ocultos";

export const OCULTOS_VAZIO: Ocultos = { esconder: [], fora: [] };

const lista = (x: unknown): string[] => (Array.isArray(x) ? [...new Set(x.filter((v): v is string => typeof v === "string" && v.length > 0 && v.length < 40))] : []);

export function limparOcultos(bruto: unknown): Ocultos {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const fora = lista(o.fora);
  return { fora, esconder: lista(o.esconder).filter((c) => !fora.includes(c)) };
}
export function lerOcultos(): Ocultos {
  try { return limparOcultos(JSON.parse(localStorage.getItem(CHAVE) ?? "null")); } catch { return { ...OCULTOS_VAZIO }; }
}
export function guardarOcultos(o: Ocultos) {
  try { localStorage.setItem(CHAVE, JSON.stringify(o)); } catch { /* vale só nesta sessão */ }
}

/** Esconder: some da lista do Início, os jogos continuam em "Todos". Tirar: some de tudo. Os dois são reversíveis. */
export function mudarOculto(o: Ocultos, id: string, como: "esconder" | "fora" | "mostrar"): Ocultos {
  const sem = { esconder: o.esconder.filter((c) => c !== id), fora: o.fora.filter((c) => c !== id) };
  if (como === "esconder") return { ...sem, esconder: [...sem.esconder, id] };
  if (como === "fora") return { ...sem, fora: [...sem.fora, id] };
  return sem;
}

export const aplicarFora = <T extends { plataforma: string }>(jogos: T[], o: Ocultos): T[] => (o.fora.length ? jogos.filter((j) => !o.fora.includes(j.plataforma)) : jogos);
