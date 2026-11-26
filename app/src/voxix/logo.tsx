import { useId } from "react";
import type { ModoLuz } from "./personalizar";
import { useVisual } from "./useVisual";

/** Gradiente e brilho das letras do nome VOXIX (o V com X usa o Desenho abaixo). */
function Defs({ id }: { id: string }) {
  // as cores vêm das variáveis do tema (--color-neon e --color-magenta): trocou a cor do app, trocou o emblema
  return (
    <defs>
      <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--color-magenta) 88%, #fff)" }} />
        <stop offset=".55" style={{ stopColor: "color-mix(in srgb, var(--color-magenta) 50%, #000)" }} />
        <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--color-magenta) 28%, #000)" }} />
      </linearGradient>
      <filter id={`b${id}`} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="3" style={{ floodColor: "var(--color-neon)" }} floodOpacity=".85" /></filter>
    </defs>
  );
}

/** V fino com as pontas fechando para dentro, terminando em ponta; o X é um desenho de uma linha só, por cima das duas pernas. */
export const V_LOGO = "M-6 -8 L28 26 L60 88 L92 26 L126 -8 L60 128 Z";
const LADO = 29, MEIA = 5, CENTRO: [number, number] = [60, 41];
const PONTOS_X: [number, number][] = [[LADO, -MEIA], [MEIA, -MEIA], [MEIA, -LADO], [-MEIA, -LADO], [-MEIA, -MEIA], [-LADO, -MEIA], [-LADO, MEIA], [-MEIA, MEIA], [-MEIA, LADO], [MEIA, LADO], [MEIA, MEIA], [LADO, MEIA]];
export const X_LOGO = "M" + PONTOS_X.map(([u, v]) => `${(CENTRO[0] + (u + v) / Math.SQRT2).toFixed(1)} ${(CENTRO[1] + (u - v) / Math.SQRT2).toFixed(1)}`).join(" L") + " Z";
const NOME = "M0 0 L12 0 L22 28 L32 0 L44 0 L28 40 L16 40 Z M60 0 L88 0 L96 8 L96 32 L88 40 L60 40 L52 32 L52 8 Z M66 10 L82 10 L84 12 L84 28 L82 30 L66 30 L64 28 L64 12 Z M104 0 L116 0 L126 15 L136 0 L148 0 L132 20 L148 40 L136 40 L126 25 L116 40 L104 40 L120 20 Z M156 0 L168 0 L168 40 L156 40 Z M176 0 L188 0 L198 15 L208 0 L220 0 L204 20 L220 40 L208 40 L198 25 L188 40 L176 40 L192 20 Z";

/** As faixas de luz: cada uma é um pedaço do contorno que corre. RGB = três cores que mudam; senão duas faixas de uma cor só. */
export function faixasDeLuz(modo: ModoLuz, cor: string): { cor: string | null; pos: number; tam: number; atraso: number }[] {
  if (modo === "rgb") return [0, 1, 2].map((n) => ({ cor: null, pos: 5 + n * 33, tam: 7, atraso: -n * 1.7 }));
  const c = modo === "branca" ? "#ffffff" : cor;
  return [8, 58].map((pos) => ({ cor: c, pos, tam: 8, atraso: 0 }));
}

function Desenho({ id }: { id: string }) {
  const { luz } = useVisual();
  const faixas = faixasDeLuz(luz.modo, luz.cor);
  // Sem filtro SVG nas faixas que correm: filtro animado repinta a tela toda e deixava os textos com "sombra".
  const luzes = (d: string) => faixas.flatMap((f, k) => [3, 6.5].map((largura, j) => (
    <path key={`${k}-${j}`} d={d} pathLength={100} fill="none" strokeWidth={largura} strokeLinejoin="round" strokeLinecap="round" strokeOpacity={j === 0 ? 1 : 0.28}
      strokeDasharray={`${f.tam} ${100 - f.tam}`} strokeDashoffset={-f.pos}
      className={f.cor ? "luz-faixa" : "luz-faixa luz-rgb"} style={{ stroke: f.cor ?? undefined, animationDelay: `${f.atraso}s` }} />
  )));
  return (
    <g>
      <path d={V_LOGO} style={{ fill: "color-mix(in srgb, var(--color-neon) 16%, #000)", stroke: "var(--color-neon)" }} strokeWidth="2.6" strokeLinejoin="miter" filter={`url(#b${id})`} />
      <path d={X_LOGO} style={{ fill: "color-mix(in srgb, var(--color-neon) 8%, #000)", stroke: "var(--color-neon)" }} strokeWidth="2.6" strokeLinejoin="miter" filter={`url(#b${id})`} />
      {luzes(V_LOGO)}
      {luzes(X_LOGO)}
    </g>
  );
}

/** Só o V com X (ícone), com a luz correndo em volta do contorno. */
export function Logo({ tam = 40, className = "" }: { tam?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="-16 -14 148 154" width={tam} height={(tam * 154) / 148} className={`logo-isolado ${className ?? ""}`} role="img" aria-label="Voxix">
      <defs><filter id={`b${id}`} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="2.6" style={{ floodColor: "var(--color-neon)" }} floodOpacity=".85" /></filter></defs>
      <Desenho id={id} />
    </svg>
  );
}

/** O nome VOXIX em letras angulares, como no conceito. */
export function NomeVoxix({ largura = 200, className = "" }: { largura?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="-8 -8 236 56" width={largura} height={(largura * 56) / 236} className={`logo-isolado ${className ?? ""}`} role="img" aria-label="Voxix">
      <Defs id={id} />
      <path d={NOME} fill={`url(#g${id})`} style={{ stroke: "var(--color-neon)" }} strokeWidth="2.4" strokeLinejoin="round" fillRule="evenodd" filter={`url(#b${id})`} />
    </svg>
  );
}

/** Logo completo da tela de entrada: V com X, nome e "GAMING CHAT". */
export function Marca({ tam = 120 }: { tam?: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Logo tam={tam} />
      <NomeVoxix largura={tam * 1.9} />
      <div className="text-xs font-black tracking-[0.45em] text-white">GAMING CHAT</div>
    </div>
  );
}
