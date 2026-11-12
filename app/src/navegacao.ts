// Navegação espacial: teclado, controle (Gamepad API) e toque usam o mesmo caminho.
export type Direcao = "cima" | "baixo" | "esquerda" | "direita";
export interface Caixa { x: number; y: number; w: number; h: number }
export interface Candidato { id: string; caixa: Caixa }

const centro = (c: Caixa) => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 });

/** Escolhe o próximo item para onde o jogador apertou: o mais perto na direção, penalizando quem está muito torto. */
export function proximoFoco(origem: Caixa, candidatos: Candidato[], direcao: Direcao): string | null {
  const o = centro(origem);
  let melhor: string | null = null;
  let menor = Infinity;
  for (const c of candidatos) {
    const p = centro(c.caixa);
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const horizontal = direcao === "esquerda" || direcao === "direita";
    const along = direcao === "direita" ? dx : direcao === "esquerda" ? -dx : direcao === "baixo" ? dy : -dy;
    if (along <= 1) continue; // precisa estar de fato naquela direção
    const across = Math.abs(horizontal ? dy : dx);
    const nota = along + across * 2.2;
    if (nota < menor) { menor = nota; melhor = c.id; }
  }
  return melhor;
}

/** Traduz o estado de um controle em direções (D-pad ou analógico esquerdo). */
export function direcoesDoControle(botoes: boolean[], eixos: number[], zona = 0.55): Direcao[] {
  const r: Direcao[] = [];
  const x = eixos[0] ?? 0;
  const y = eixos[1] ?? 0;
  if (botoes[12] || y < -zona) r.push("cima");
  if (botoes[13] || y > zona) r.push("baixo");
  if (botoes[14] || x < -zona) r.push("esquerda");
  if (botoes[15] || x > zona) r.push("direita");
  return r;
}

/** Formata segundos jogados: "2 h 05 min", "35 min", "—". */
export function tempoJogado(s: number): string {
  if (!s || s < 60) return s > 0 ? "menos de 1 min" : "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

/** Cor estável por texto (para capas sem imagem). */
export function matizDoTexto(t: string): number {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function iniciais(t: string): string {
  const p = t.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean);
  return (p.length > 1 ? p[0][0] + p[1][0] : (p[0] ?? "?").slice(0, 2)).toUpperCase();
}
