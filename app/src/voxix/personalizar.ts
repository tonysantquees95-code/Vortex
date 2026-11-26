// Personalização do Voxix: cor (pronta ou RGB), formato dos ícones, papel de parede, teclado e a luz que corre em volta do logo.
// Este módulo é puro (sem React): dá para testar com node.
export interface Tema { id: string; nome: string; neon: string; magenta: string }
export const TEMAS: Tema[] = [
  { id: "voxix", nome: "Voxix", neon: "#ef2b3d", magenta: "#8b3cf0" },
  { id: "roxo", nome: "Roxo", neon: "#7c3aed", magenta: "#db2777" },
  { id: "azul", nome: "Azul", neon: "#2563eb", magenta: "#7c3aed" },
  { id: "verde", nome: "Verde", neon: "#16a34a", magenta: "#0891b2" },
  { id: "rosa", nome: "Rosa", neon: "#db2777", magenta: "#7c3aed" },
  { id: "ciano", nome: "Ciano", neon: "#0891b2", magenta: "#8b3cf0" },
  { id: "laranja", nome: "Laranja", neon: "#f97316", magenta: "#dc2626" },
  { id: "dourado", nome: "Dourado", neon: "#eab308", magenta: "#ea580c" },
];
/** Luz que corre em volta do contorno do logo: branca, RGB (muda de cor sem parar) ou uma cor escolhida. */
export type ModoLuz = "rgb" | "branca" | "cor";
export const MODOS_LUZ: { id: ModoLuz; nome: string; dica: string }[] = [
  { id: "rgb", nome: "RGB colorido", dica: "Vermelho, verde e azul correndo e mudando de cor." },
  { id: "branca", nome: "Branca", dica: "Faixas brancas, como no Velox." },
  { id: "cor", nome: "Minha cor", dica: "Faixas na cor que você escolher." },
];
export interface Luz { modo: ModoLuz; cor: string }
export const LUZ_PADRAO: Luz = { modo: "rgb", cor: "#3dff8a" };

/** Formato dos ícones, avatares, balões e botões do app inteiro. */
export type Formato = "redondo" | "quadrado" | "futurista";
export const FORMATOS: { id: Formato; nome: string; dica: string }[] = [
  { id: "redondo", nome: "Redondinho", dica: "Cantos bem arredondados, avatares em círculo." },
  { id: "quadrado", nome: "Quadradinho", dica: "Cantos quase retos." },
  { id: "futurista", nome: "Futurista", dica: "Cantos cortados e avatares em hexágono." },
];

/** Modelos de papel de parede prontos; "foto" usa uma imagem da própria pessoa. */
export type ModeloPapel = "nenhum" | "aurora" | "grade" | "circuito" | "pontos" | "tempestade" | "foto";
export const MODELOS_PAPEL: { id: ModeloPapel; nome: string }[] = [
  { id: "nenhum", nome: "Liso" }, { id: "aurora", nome: "Aurora" }, { id: "grade", nome: "Grade" }, { id: "circuito", nome: "Circuito" },
  { id: "pontos", nome: "Pontos" }, { id: "tempestade", nome: "Tempestade" }, { id: "foto", nome: "Minha foto" },
];
export interface Papel { modelo: ModeloPapel; escurecer: number }
export const PAPEL_PADRAO: Papel = { modelo: "nenhum", escurecer: 35 };

/** Teclado próprio do Voxix. */
export type FormaTecla = "redonda" | "quadrada" | "futurista";
export type EfeitoToque = "nenhum" | "brilho" | "rgb" | "cor"; // luzes que correm no teclado: desligadas, brancas, RGB, ou na cor do app
export type CorLed = "tema" | "arco" | "cor";
export type AlturaTeclado = "baixa" | "media" | "alta";
export interface Teclado {
  usar: boolean;            // false = teclado do sistema
  noPc: boolean;            // mostrar também no computador (com mouse/teclado físico)
  forma: FormaTecla;
  efeito: EfeitoToque;
  led: CorLed;
  ledCor: string;           // usada quando led === "cor"
  vibrar: boolean;
  altura: AlturaTeclado;
  corretor: boolean;        // sugere e corrige palavras em português enquanto escreve
  ajusteX: number;          // quantos px o toque da pessoa costuma cair à direita da tecla (negativo: à esquerda); 0 = sem ajuste. Vale na ponta ESQUERDA do teclado
  ajusteY: number;          // idem para baixo (negativo: para cima)
  ajusteDirX: number;       // o mesmo, na ponta DIREITA do teclado (no meio vale o valor entre as duas pontas: o polegar erra diferente de cada lado)
  ajusteDirY: number;
}
export const TECLADO_PADRAO: Teclado = { usar: true, noPc: false, forma: "redonda", efeito: "brilho", led: "tema", ledCor: "#19e3ff", vibrar: true, altura: "media", corretor: true, ajusteX: 0, ajusteY: 0, ajusteDirX: 0, ajusteDirY: 0 };

/** Desenho dos ícones do app (engrenagem, enviar, microfone…): espessura do traço, tamanho, estilo e cor. */
export type Traco = "fino" | "medio" | "grosso";
export type TamanhoIcone = "pequeno" | "medio" | "grande";
export type EstiloIcone = "contorno" | "suave";
export type CorIcone = "texto" | "app";
export interface Icones { traco: Traco; tamanho: TamanhoIcone; estilo: EstiloIcone; cor: CorIcone }
export const TRACOS: Record<Traco, number> = { fino: 1.4, medio: 2, grosso: 2.8 };
export const ESCALAS_ICONE: Record<TamanhoIcone, number> = { pequeno: 0.85, medio: 1, grande: 1.25 };
export const ICONES_PADRAO: Icones = { traco: "medio", tamanho: "medio", estilo: "contorno", cor: "texto" };
export function limparIcones(v: unknown): Icones {
  const o = obj(v);
  return {
    traco: um(["fino", "medio", "grosso"] as const, o.traco, ICONES_PADRAO.traco),
    tamanho: um(["pequeno", "medio", "grande"] as const, o.tamanho, ICONES_PADRAO.tamanho),
    estilo: um(["contorno", "suave"] as const, o.estilo, ICONES_PADRAO.estilo),
    cor: um(["texto", "app"] as const, o.cor, ICONES_PADRAO.cor),
  };
}

export interface Visual {
  cor: string;              // id de um tema pronto ou "#rrggbb" escolhido no RGB
  luz: Luz;
  formato: Formato;
  papelInicio: Papel;
  papelConversa: Papel;
  teclado: Teclado;
  icones: Icones;
  pacoteEmoji: string;      // pacote aberto por último no teclado
}
export const VISUAL_PADRAO: Visual = {
  cor: "voxix", luz: LUZ_PADRAO, formato: "redondo",
  papelInicio: PAPEL_PADRAO, papelConversa: PAPEL_PADRAO, teclado: TECLADO_PADRAO, icones: ICONES_PADRAO, pacoteEmoji: "recentes",
};

export const hexValido = (h: unknown): h is string => typeof h === "string" && /^#[0-9a-f]{6}$/i.test(h);
const um = <T extends string>(lista: readonly T[], v: unknown, padrao: T): T => (lista.includes(v as T) ? (v as T) : padrao);
const limite = (v: unknown, min: number, max: number, padrao: number): number => {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : padrao;
};
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export function limparLuz(v: unknown): Luz {
  const o = obj(v);
  return { modo: um(MODOS_LUZ.map((m) => m.id), o.modo, LUZ_PADRAO.modo), cor: hexValido(o.cor) ? o.cor.toLowerCase() : LUZ_PADRAO.cor };
}
export function limparPapel(v: unknown): Papel {
  const o = obj(v);
  return { modelo: um(MODELOS_PAPEL.map((m) => m.id), o.modelo, PAPEL_PADRAO.modelo), escurecer: limite(o.escurecer, 0, 85, PAPEL_PADRAO.escurecer) };
}
/** Até onde o ajuste do toque pode ir (px): acima disso o toque erraria mais do que acerta. */
export const AJUSTE_MAX = 14;
/** Reta que melhor liga a posição na largura (0 a 1) ao desvio medido; devolve o desvio na ponta esquerda (0) e na direita (1). */
export function pontasDoDesvio(f: number[], d: number[]): [number, number] {
  const n = f.length, mf = f.reduce((a, b) => a + b, 0) / n, md = d.reduce((a, b) => a + b, 0) / n;
  let cov = 0, vr = 0;
  for (let k = 0; k < n; k++) { cov += (f[k] - mf) * (d[k] - md); vr += (f[k] - mf) ** 2; }
  const b = vr > 0 ? cov / vr : 0, a = md - b * mf;
  return [a, a + b];
}

function ajustes(o: Record<string, unknown>) {
  const ax = limite(o.ajusteX, -AJUSTE_MAX, AJUSTE_MAX, 0), ay = limite(o.ajusteY, -AJUSTE_MAX, AJUSTE_MAX, 0);
  // quem guardou só um ajuste (versão anterior) fica com o mesmo valor nas duas pontas
  return { ajusteX: ax, ajusteY: ay, ajusteDirX: limite(o.ajusteDirX, -AJUSTE_MAX, AJUSTE_MAX, ax), ajusteDirY: limite(o.ajusteDirY, -AJUSTE_MAX, AJUSTE_MAX, ay) };
}
export function limparTeclado(v: unknown): Teclado {
  const o = obj(v);
  const b = (x: unknown, p: boolean) => (typeof x === "boolean" ? x : p);
  return {
    usar: b(o.usar, TECLADO_PADRAO.usar), noPc: b(o.noPc, TECLADO_PADRAO.noPc),
    forma: um(["redonda", "quadrada", "futurista"] as const, o.forma, TECLADO_PADRAO.forma),
    efeito: um(["nenhum", "brilho", "rgb", "cor"] as const, o.efeito, TECLADO_PADRAO.efeito),
    led: um(["tema", "arco", "cor"] as const, o.led, TECLADO_PADRAO.led),
    ledCor: hexValido(o.ledCor) ? o.ledCor : TECLADO_PADRAO.ledCor,
    vibrar: b(o.vibrar, TECLADO_PADRAO.vibrar),
    altura: um(["baixa", "media", "alta"] as const, o.altura, TECLADO_PADRAO.altura),
    corretor: b(o.corretor, TECLADO_PADRAO.corretor),
    ...ajustes(o),
  };
}

/** Aceita só valores conhecidos; qualquer coisa estranha volta ao padrão. Lê também o formato antigo (campo "tema"). */
export function limparVisual(v: unknown): Visual {
  const o = obj(v);
  const bruta = o.cor ?? o.tema;
  const cor = typeof bruta === "string" && (TEMAS.some((t) => t.id === bruta) || hexValido(bruta)) ? bruta : VISUAL_PADRAO.cor;
  return {
    cor,
    luz: limparLuz(o.luz),
    formato: um(FORMATOS.map((f) => f.id), o.formato, VISUAL_PADRAO.formato),
    papelInicio: limparPapel(o.papelInicio),
    papelConversa: limparPapel(o.papelConversa),
    teclado: limparTeclado(o.teclado),
    icones: limparIcones(o.icones),
    pacoteEmoji: typeof o.pacoteEmoji === "string" && /^[a-z]{3,20}$/.test(o.pacoteEmoji) ? o.pacoteEmoji : VISUAL_PADRAO.pacoteEmoji,
  };
}

// ---- cores ----
export const rgbDe = (hex: string): [number, number, number] => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const hexDe = (r: number, g: number, b: number): string =>
  "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");

/** Gira o matiz de uma cor (graus) mantendo brilho e saturação: dá a segunda cor do tema quando a pessoa escolhe só uma. */
export function girarMatiz(hex: string, graus: number): string {
  const [r, g, b] = rgbDe(hex).map((x) => x / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h2 = (((h + graus) % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h2 / 60) % 2) - 1)), m = l - c / 2;
  const [r1, g1, b1] = h2 < 60 ? [c, x, 0] : h2 < 120 ? [x, c, 0] : h2 < 180 ? [0, c, x] : h2 < 240 ? [0, x, c] : h2 < 300 ? [x, 0, c] : [c, 0, x];
  return hexDe((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255);
}

/** As duas cores do app: do tema pronto, ou a escolhida no RGB (a segunda é a mesma cor com o matiz girado). */
export function coresDe(cor: string): { neon: string; magenta: string } {
  const t = TEMAS.find((x) => x.id === cor);
  if (t) return { neon: t.neon, magenta: t.magenta };
  if (!hexValido(cor)) return { neon: TEMAS[0].neon, magenta: TEMAS[0].magenta };
  return { neon: cor, magenta: girarMatiz(cor, 55) };
}
export const temaDe = (id: string): Tema => TEMAS.find((t) => t.id === id) ?? TEMAS[0];

// ---- guarda e aplica ----
const CHAVE = "voxix.visual";
function ler(): Visual {
  try { return limparVisual(JSON.parse(localStorage.getItem(CHAVE) ?? "null")); } catch { return VISUAL_PADRAO; }
}
let atual: Visual = ler();
const ouvintes = new Set<() => void>();
/** Para a tela acompanhar as mudanças (usado por useVisual). */
export const visualAtual = (): Visual => atual;
export function ouvirVisual(f: () => void): () => void { ouvintes.add(f); return () => { ouvintes.delete(f); }; }

export function aplicarVisual(v: Visual, raiz: HTMLElement = document.documentElement) {
  const c = coresDe(v.cor);
  raiz.style.setProperty("--color-neon", c.neon);
  raiz.style.setProperty("--color-magenta", c.magenta);
  raiz.dataset.formato = v.formato;
  raiz.dataset.forma = v.teclado.forma;
}
export function iniciarVisual() { try { aplicarVisual(atual); } catch { /* sem DOM */ } }

export function mudarVisual(parcial: Partial<Visual>) {
  atual = limparVisual({ ...atual, ...parcial });
  try { localStorage.setItem(CHAVE, JSON.stringify(atual)); } catch { /* sem armazenamento */ }
  try { aplicarVisual(atual); } catch { /* sem DOM */ }
  ouvintes.forEach((f) => f());
}
export const mudarTeclado = (p: Partial<Teclado>) => mudarVisual({ teclado: { ...atual.teclado, ...p } });
export const mudarPapel = (qual: "papelInicio" | "papelConversa", p: Partial<Papel>) =>
  mudarVisual(qual === "papelInicio" ? { papelInicio: { ...atual.papelInicio, ...p } } : { papelConversa: { ...atual.papelConversa, ...p } });
export const mudarLuz = (p: Partial<Luz>) => mudarVisual({ luz: { ...atual.luz, ...p } });
export const mudarIcones = (p: Partial<Icones>) => mudarVisual({ icones: { ...atual.icones, ...p } });
export function restaurarVisual() { mudarVisual({ ...VISUAL_PADRAO }); }
