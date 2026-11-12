// Aparência do Vortex: cores, brilho, fundo e animações. Tudo guardado no próprio aparelho e aplicado por variáveis de CSS.
export interface Predefinida { id: string; nome: string; principal: string; segunda: string }

export const CORES: Predefinida[] = [
  { id: "vermelho", nome: "Vermelho", principal: "#ff2a3d", segunda: "#b0001a" },
  { id: "laranja", nome: "Laranja", principal: "#ff8a1f", segunda: "#d9300f" },
  { id: "dourado", nome: "Dourado", principal: "#ffc21a", segunda: "#ff7a00" },
  { id: "verde", nome: "Verde", principal: "#2dff8a", segunda: "#06a85a" },
  { id: "ciano", nome: "Ciano", principal: "#19e3ff", segunda: "#9b5cff" },
  { id: "azul", nome: "Azul", principal: "#3d8bff", segunda: "#1b3dbd" },
  { id: "roxo", nome: "Roxo", principal: "#a855ff", segunda: "#5b21b6" },
  { id: "rosa", nome: "Rosa", principal: "#ff3da6", segunda: "#9b5cff" },
];

export type Fundo = "vortex" | "grade" | "liso";
export type Formato = "futurista" | "redondo";
export type TamanhoCartas = "pequeno" | "medio" | "grande";

export interface Tema {
  cor: string;            // id de uma cor pronta ou "#rrggbb" personalizada
  brilho: number;         // 0 a 100
  fundo: Fundo;
  formato: Formato;
  cartas: TamanhoCartas;
  animacoes: boolean;
  abertura: boolean;      // animação de entrada no vórtex
}

export const TEMA_PADRAO: Tema = { cor: "vermelho", brilho: 70, fundo: "vortex", formato: "futurista", cartas: "medio", animacoes: true, abertura: true };

const CHAVE = "vortex:tema";

export const hexValido = (h: unknown): h is string => typeof h === "string" && /^#[0-9a-f]{6}$/i.test(h);

/** Lê o que foi guardado, corrigindo qualquer valor estranho (nunca quebra). */
export function limparTema(bruto: unknown): Tema {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const cor = typeof o.cor === "string" && (CORES.some((c) => c.id === o.cor) || hexValido(o.cor)) ? (o.cor as string) : TEMA_PADRAO.cor;
  const b = Number(o.brilho);
  return {
    cor,
    brilho: Number.isFinite(b) ? Math.max(0, Math.min(100, Math.round(b))) : TEMA_PADRAO.brilho,
    fundo: o.fundo === "grade" || o.fundo === "liso" || o.fundo === "vortex" ? o.fundo : TEMA_PADRAO.fundo,
    formato: o.formato === "redondo" || o.formato === "futurista" ? o.formato : TEMA_PADRAO.formato,
    cartas: o.cartas === "pequeno" || o.cartas === "grande" || o.cartas === "medio" ? o.cartas : TEMA_PADRAO.cartas,
    animacoes: typeof o.animacoes === "boolean" ? o.animacoes : TEMA_PADRAO.animacoes,
    abertura: typeof o.abertura === "boolean" ? o.abertura : TEMA_PADRAO.abertura,
  };
}

export function lerTema(): Tema {
  try { return limparTema(JSON.parse(localStorage.getItem(CHAVE) ?? "null")); } catch { return { ...TEMA_PADRAO }; }
}
export function guardarTema(t: Tema) {
  try { localStorage.setItem(CHAVE, JSON.stringify(t)); } catch { /* vale só nesta sessão */ }
}

export function rgbDe(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const paraHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/** Cor secundária de uma cor personalizada: a mesma cor, mais escura e levemente deslocada. */
export function segundaDe(hex: string): string {
  const [r, g, b] = rgbDe(hex);
  return paraHex(r * 0.55 + 10, g * 0.5, b * 0.7 + 20);
}

export function coresDoTema(t: Tema): { principal: string; segunda: string } {
  const p = CORES.find((c) => c.id === t.cor);
  if (p) return { principal: p.principal, segunda: p.segunda };
  const h = hexValido(t.cor) ? t.cor : CORES[0].principal;
  return { principal: h, segunda: segundaDe(h) };
}

/** Texto escuro sobre cores claras, branco sobre as escuras. */
export function textoSobre(hex: string): string {
  const [r, g, b] = rgbDe(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#08090f" : "#ffffff";
}

export function aplicarTema(t: Tema, raiz: HTMLElement = document.documentElement) {
  const { principal, segunda } = coresDoTema(t);
  const [r, g, b] = rgbDe(principal);
  const [r2, g2, b2] = rgbDe(segunda);
  const s = raiz.style;
  s.setProperty("--neon", principal);
  s.setProperty("--neon2", segunda);
  s.setProperty("--neon-rgb", `${r}, ${g}, ${b}`);
  s.setProperty("--neon2-rgb", `${r2}, ${g2}, ${b2}`);
  s.setProperty("--sobre-neon", textoSobre(principal));
  s.setProperty("--brilho", String(t.brilho / 100));
  s.setProperty("--carta-min", t.cartas === "pequeno" ? "130px" : t.cartas === "grande" ? "200px" : "160px");
  raiz.dataset.fundo = t.fundo;
  raiz.dataset.formato = t.formato;
  raiz.dataset.animacoes = t.animacoes ? "1" : "0";
}
