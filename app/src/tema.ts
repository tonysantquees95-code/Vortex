// Aparência do Vortex: cores, brilho, fundo e animações. Tudo guardado no próprio aparelho e aplicado por variáveis de CSS.
import { limparDisposicoes, type Escolha } from "./controlesVirtuais.ts";
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

/** console = o fundo acompanha a capa do console/jogo em foco; foto = imagem da própria pessoa; capa = capa de um jogo escolhida; o resto são modelos futuristas. */
export type Fundo = "console" | "aurora" | "grade" | "circuito" | "pontos" | "liso" | "foto" | "capa" | "crt" | "vidro" | "preto";
export const FUNDOS_VALIDOS: Fundo[] = ["console", "aurora", "grade", "circuito", "pontos", "liso", "foto", "capa", "crt", "vidro", "preto"];
export type Formato = "futurista" | "redondo";
export type TamanhoCartas = "pequeno" | "medio" | "grande";
/** Espessura do traço de todos os ícones do Vortex. */
export type Traco = "fino" | "medio" | "grosso";
export const TRACOS: Record<Traco, number> = { fino: 1.3, medio: 1.8, grosso: 2.5 };
/** Modelo dos botões virtuais na tela do jogo (Android). */
export type ModeloBotoes = "circulo" | "quadrado" | "neon" | "vidro";
export const MODELOS_BOTOES: ModeloBotoes[] = ["circulo", "quadrado", "neon", "vidro"];

/** A luz que corre em volta das letras do logo: padrão (branca + cor do tema), RGB (muda de cor), branca ou uma cor escolhida. */
export type ModoLuz = "padrao" | "rgb" | "branca" | "cor";
export const MODOS_LUZ: { id: ModoLuz; nome: string }[] = [
  { id: "padrao", nome: "Padrão" }, { id: "rgb", nome: "RGB" }, { id: "branca", nome: "Branca" }, { id: "cor", nome: "Cor escolhida" },
];

export interface Tema {
  luz: ModoLuz;           // luz do logo
  luzCor: string;         // "#rrggbb" usada no modo "cor"
  cor: string;            // id de uma cor pronta ou "#rrggbb" personalizada
  brilho: number;         // 0 a 100
  fundo: Fundo;
  formato: Formato;
  cartas: TamanhoCartas;
  icones: Traco;          // espessura dos ícones
  botoes: ModeloBotoes;   // formato dos botões virtuais
  tamanhoBotoes: TamanhoCartas; // tamanho dos botões virtuais
  opacidadeBotoes: number; // 30 a 100
  disposicoes: Record<string, Escolha>; // controle virtual escolhido por console (o resto segue o automático)
  animacoes: boolean;
  abertura: boolean;      // animação de entrada no vórtex
  foto: string | null;    // fundo "foto": imagem reduzida guardada no aparelho (data:image/...)
  capaFundo: string | null; // fundo "capa": endereço da capa escolhida
}

export const TEMA_PADRAO: Tema = { luz: "padrao", luzCor: "#19e3ff", cor: "vermelho", brilho: 70, fundo: "console", formato: "futurista", cartas: "medio", icones: "medio", botoes: "circulo", tamanhoBotoes: "medio", opacidadeBotoes: 85, disposicoes: {}, animacoes: true, abertura: true, foto: null, capaFundo: null };

const CHAVE = "vortex:tema";

export const hexValido = (h: unknown): h is string => typeof h === "string" && /^#[0-9a-f]{6}$/i.test(h);

/** Lê o que foi guardado, corrigindo qualquer valor estranho (nunca quebra). */
export function limparTema(bruto: unknown): Tema {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const cor = typeof o.cor === "string" && (CORES.some((c) => c.id === o.cor) || hexValido(o.cor)) ? (o.cor as string) : TEMA_PADRAO.cor;
  const b = Number(o.brilho);
  return {
    luz: MODOS_LUZ.some((m) => m.id === o.luz) ? (o.luz as ModoLuz) : TEMA_PADRAO.luz,
    luzCor: hexValido(o.luzCor) ? o.luzCor : TEMA_PADRAO.luzCor,
    cor,
    brilho: Number.isFinite(b) ? Math.max(0, Math.min(100, Math.round(b))) : TEMA_PADRAO.brilho,
    fundo: FUNDOS_VALIDOS.includes(o.fundo as Fundo) ? (o.fundo as Fundo) : TEMA_PADRAO.fundo, // "vortex" (antigo) cai no padrão
    formato: o.formato === "redondo" || o.formato === "futurista" ? o.formato : TEMA_PADRAO.formato,
    cartas: o.cartas === "pequeno" || o.cartas === "grande" || o.cartas === "medio" ? o.cartas : TEMA_PADRAO.cartas,
    icones: o.icones === "fino" || o.icones === "grosso" || o.icones === "medio" ? o.icones : TEMA_PADRAO.icones,
    botoes: MODELOS_BOTOES.includes(o.botoes as ModeloBotoes) ? (o.botoes as ModeloBotoes) : TEMA_PADRAO.botoes,
    tamanhoBotoes: o.tamanhoBotoes === "pequeno" || o.tamanhoBotoes === "grande" || o.tamanhoBotoes === "medio" ? o.tamanhoBotoes : TEMA_PADRAO.tamanhoBotoes,
    opacidadeBotoes: Number.isFinite(Number(o.opacidadeBotoes)) && o.opacidadeBotoes !== null ? Math.max(30, Math.min(100, Math.round(Number(o.opacidadeBotoes)))) : TEMA_PADRAO.opacidadeBotoes,
    disposicoes: limparDisposicoes(o.disposicoes),
    animacoes: typeof o.animacoes === "boolean" ? o.animacoes : TEMA_PADRAO.animacoes,
    abertura: typeof o.abertura === "boolean" ? o.abertura : TEMA_PADRAO.abertura,
    foto: typeof o.foto === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(o.foto) && o.foto.length < 2_500_000 ? o.foto : null,
    capaFundo: typeof o.capaFundo === "string" && /^https:\/\/[^\s"'()<>]+$/.test(o.capaFundo) ? o.capaFundo : null,
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
  s.setProperty("--traco", String(TRACOS[t.icones]));
  s.setProperty("--luz-cor", t.luzCor);
  raiz.dataset.luz = t.luz;
  raiz.dataset.fundo = t.fundo;
  raiz.dataset.formato = t.formato;
  raiz.dataset.animacoes = t.animacoes ? "1" : "0";
}

/** Temas prontos: um toque troca cor, fundo, formato, tamanho das cartas, ícones e luz do logo. Inspirados nos estilos mais queridos dos
 *  frontends de jogos (sala de estar, minimalista, cinema, tubo de TV, portátil); só mexem na aparência, nunca nos botões do jogo, foto ou capa escolhidas. */
export interface TemaPronto { id: string; nome: string; descricao: string; ajustes: Partial<Pick<Tema, "cor" | "fundo" | "formato" | "cartas" | "icones" | "brilho" | "luz" | "luzCor" | "animacoes">> }

export const TEMAS_PRONTOS: TemaPronto[] = [
  { id: "arcade", nome: "Arcade neon", descricao: "O visual clássico do Vortex: vermelho, neon e cantos cortados.", ajustes: { cor: "vermelho", fundo: "console", formato: "futurista", cartas: "medio", icones: "medio", brilho: 70, luz: "padrao", animacoes: true } },
  { id: "sala", nome: "Console de sala", descricao: "Cartas grandes e cantos redondos, para jogar do sofá.", ajustes: { cor: "azul", fundo: "console", formato: "redondo", cartas: "grande", icones: "medio", brilho: 45, luz: "branca", animacoes: true } },
  { id: "cinema", nome: "Cinema", descricao: "A arte do jogo ocupa a tela; luz suave e discreta.", ajustes: { cor: "roxo", fundo: "console", formato: "redondo", cartas: "grande", icones: "fino", brilho: 30, luz: "branca", animacoes: true } },
  { id: "minimo", nome: "Minimalista", descricao: "Limpo e rápido: fundo liso, ícones finos, sem enfeite.", ajustes: { cor: "ciano", fundo: "liso", formato: "redondo", cartas: "pequeno", icones: "fino", brilho: 15, luz: "branca", animacoes: false } },
  { id: "preto", nome: "Preto total", descricao: "Preto de verdade (bom para tela OLED) com um toque de cor.", ajustes: { cor: "verde", fundo: "preto", formato: "redondo", cartas: "medio", icones: "medio", brilho: 35, luz: "padrao", animacoes: true } },
  { id: "tubo", nome: "TV de tubo", descricao: "Linhas de TV antiga e brilho quente, como nos anos 90.", ajustes: { cor: "dourado", fundo: "crt", formato: "futurista", cartas: "medio", icones: "grosso", brilho: 60, luz: "padrao", animacoes: true } },
  { id: "portatil", nome: "Portátil", descricao: "Grade de pixels e verde de tela de Game Boy moderno.", ajustes: { cor: "verde", fundo: "grade", formato: "futurista", cartas: "pequeno", icones: "grosso", brilho: 55, luz: "padrao", animacoes: true } },
  { id: "vidro", nome: "Vidro", descricao: "Painéis de vidro fosco sobre a capa do jogo.", ajustes: { cor: "rosa", fundo: "vidro", formato: "redondo", cartas: "medio", icones: "fino", brilho: 50, luz: "rgb", animacoes: true } },
  { id: "retro80", nome: "Retrô 80", descricao: "Circuitos, rosa e luz RGB: fita VHS e fliperama.", ajustes: { cor: "rosa", fundo: "circuito", formato: "futurista", cartas: "medio", icones: "medio", brilho: 80, luz: "rgb", animacoes: true } },
];

/** Aplica um tema pronto por cima do atual (foto, capa, botões do jogo e controles ficam como a pessoa deixou). */
export function aplicarPronto(t: Tema, id: string): Tema {
  const p = TEMAS_PRONTOS.find((x) => x.id === id);
  return p ? limparTema({ ...t, ...p.ajustes }) : t;
}

/** Qual tema pronto é igual ao atual (ou null se a pessoa mexeu em algo). */
export function prontoAtual(t: Tema): string | null {
  const a = TEMAS_PRONTOS.find((p) => (Object.keys(p.ajustes) as (keyof TemaPronto["ajustes"])[]).every((k) => t[k] === p.ajustes[k]));
  return a ? a.id : null;
}
