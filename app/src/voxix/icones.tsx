import { ESCALAS_ICONE, TRACOS } from "./personalizar";
import { useVisual } from "./useVisual";

export type NomeIcone =
  | "config" | "fechar" | "voltar" | "mais" | "adicionar" | "enviar" | "microfone" | "parar" | "inicio" | "teclado" | "cores" | "formato" | "fundo"
  | "emoji" | "apagar" | "enter" | "shift" | "shiftTrava" | "estrela" | "seta"
  | "grupo" | "jogo" | "conversa" | "arroba" | "foguete" | "raio" | "coracao" | "escudo" | "chama" | "planeta" | "link" | "copiar" | "cadeado" | "hash" | "globo" | "buscar" | "sair";

/** Engrenagem de 8 dentes, gerada em código (centro 12,12). */
function engrenagem(): string {
  const pontos: string[] = [];
  const dentes = 8, re = 9.6, ri = 7.2;
  for (let i = 0; i < dentes; i++) {
    const a = (i * 2 * Math.PI) / dentes;
    const m = Math.PI / dentes / 2.6;
    for (const [ang, r] of [[a - m * 1.6, ri], [a - m, re], [a + m, re], [a + m * 1.6, ri]] as const) {
      pontos.push(`${(12 + r * Math.cos(ang)).toFixed(2)} ${(12 + r * Math.sin(ang)).toFixed(2)}`);
    }
  }
  return `M${pontos.join("L")}Z`;
}
const ENGRENAGEM = engrenagem();

/** Desenhos em 24x24. `area` = parte fechada que pode receber o preenchimento suave; `linhas` = só traço. */
const DESENHOS: Record<NomeIcone, { area?: string; linhas?: string; pontos?: [number, number][] }> = {
  arroba: { linhas: "M15.500 12a3.500 3.500 0 1 1-7 0 3.500 3.500 0 0 1 7 0zM15.500 12v1.500a2.500 2.500 0 0 0 5 0V12a8.500 8.500 0 1 0-3.500 6.900" },
  conversa: { area: "M5 4.5h14a2 2 0 012 2V15a2 2 0 01-2 2h-8l-5 3.5V17H5a2 2 0 01-2-2V6.500a2 2 0 012-2z", linhas: "M8 10.8h.01M12 10.8h.01M16 10.8h.01" },
  foguete: { area: "M12 3c3.5 2.5 5 6 4 11H8c-1-5 .5-8.5 4-11z", linhas: "M8 11l-3 3v3l3.500-1.500M16 11l3 3v3l-3.500-1.500M10.500 17.500L12 21l1.500-3.500M12 8.500h.01" },
  config: { area: ENGRENAGEM, linhas: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  fechar: { linhas: "M6 6l12 12M18 6L6 18" },
  voltar: { linhas: "M15 5l-7 7 7 7" },
  seta: { linhas: "M9 5l7 7-7 7" },
  mais: { pontos: [[12, 5], [12, 12], [12, 19]] },
  adicionar: { linhas: "M12 5v14M5 12h14" },
  enviar: { area: "M4 12L20 4l-5 16-3.5-6.5z", linhas: "M11.5 13.5L20 4" },
  parar: { area: "M8 8h8v8H8z", linhas: "" },
  microfone: { area: "M12 3a3 3 0 00-3 3v5a3 3 0 006 0V6a3 3 0 00-3-3z", linhas: "M5 11a7 7 0 0014 0M12 18v3M9 21h6" },
  inicio: { area: "M4 11l8-7 8 7v9h-5v-6H9v6H4z" },
  teclado: { area: "M4 6h16a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z", linhas: "M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" },
  cores: { area: "M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2.2-.5-1.2.3-2.3 1.7-2.3H18a3 3 0 003-3c0-5-4-10.5-9-10.5z", linhas: "M7.5 11h.01M10 7.5h.01M14.5 7.5h.01" },
  formato: { area: "M12 3l8 4.5v9L12 21l-8-4.5v-9z" },
  fundo: { area: "M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z", linhas: "M3 17l5-5 4 4 3-3 6 6M9 9.5h.01" },
  emoji: { area: "M12 3a9 9 0 100 18 9 9 0 000-18z", linhas: "M8.5 14a4 4 0 007 0M9 10h.01M15 10h.01" },
  apagar: { area: "M21 5H9l-6 7 6 7h12z", linhas: "M13 9.5l5 5M18 9.5l-5 5" },
  enter: { linhas: "M19 6v6a2 2 0 01-2 2H6M10 9.5L5.5 14l4.5 4.5" },
  shift: { area: "M12 4l8 9h-5v7H9v-7H4z" },
  shiftTrava: { area: "M12 3l8 8.5h-5V16H9v-4.5H4z", linhas: "M9 20h6" },
  grupo: { area: "M9 4a3.5 3.5 0 100 7 3.5 3.5 0 000-7z", linhas: "M2.5 20a6.5 6.5 0 0113 0M16 5a3 3 0 010 6M18 14.5a6 6 0 013.5 5.5" },
  jogo: { area: "M7 8h10a4 4 0 014 4.2l-.6 4A2.6 2.6 0 0115.7 17l-.9-1.5H9.2L8.3 17a2.6 2.6 0 01-4.7-.8l-.6-4A4 4 0 017 8z", linhas: "M8 10.5v3M6.5 12h3M16 11.5h.01M18 13h.01" },
  raio: { area: "M13 3L5 13.5h6L10 21l9-11.5h-6z" },
  coracao: { area: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.2 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z" },
  escudo: { area: "M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z" },
  chama: { area: "M12 3c1 3.5 5.5 5.5 5.5 10.5a5.5 5.5 0 01-11 0c0-2.2 1-3.6 2.2-4.8.2 1.4.9 2.3 1.8 2.8C10 9 10.5 5.5 12 3z" },
  planeta: { area: "M12 6.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z", linhas: "M3 12c0-1.5 4-3 9-3s9 1.5 9 3-4 3-9 3-9-1.5-9-3z" },
  link: { linhas: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" },
  copiar: { area: "M9 9h10a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0119 21H9a1.5 1.5 0 01-1.5-1.5v-9A1.5 1.5 0 019 9z", linhas: "M16.5 6V4.5A1.5 1.5 0 0015 3H5a1.5 1.5 0 00-1.5 1.5v9A1.5 1.5 0 005 15h1.5" },
  cadeado: { area: "M6 11h12a1 1 0 011 1v7a1 1 0 01-1 1H6a1 1 0 01-1-1v-7a1 1 0 011-1z", linhas: "M8 11V8a4 4 0 018 0v3" },
  hash: { linhas: "M9 4L7 20M17 4l-2 16M4 9h16M3.5 15h16" },
  globo: { area: "M12 3a9 9 0 100 18 9 9 0 000-18z", linhas: "M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" },
  buscar: { linhas: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4" },
  sair: { linhas: "M10 4H5a1 1 0 00-1 1v14a1 1 0 001 1h5M15 8l4 4-4 4M19 12H9" },
  estrela: { area: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3 9.5l6.1-.9z" },
};

/** Ícone do Voxix: espessura, tamanho, estilo e cor seguem o que a pessoa escolheu em Personalizar › Ícones. */
export function Icone({ nome, tam = 20, className = "" }: { nome: NomeIcone; tam?: number; className?: string }) {
  const { icones } = useVisual();
  const d = DESENHOS[nome];
  const px = Math.round(tam * ESCALAS_ICONE[icones.tamanho]);
  const suave = icones.estilo === "suave";
  const traco = TRACOS[icones.traco];
  return (
    <svg viewBox="0 0 24 24" width={px} height={px} className={className} aria-hidden="true" focusable="false"
      fill="none" stroke="currentColor" strokeWidth={traco} strokeLinecap="round" strokeLinejoin="round"
      style={icones.cor === "app" ? { color: "var(--color-neon)" } : undefined}>
      {d.area && <path d={d.area} fill={suave ? "currentColor" : "none"} fillOpacity={suave ? 0.22 : undefined} />}
      {d.linhas && <path d={d.linhas} />}
      {d.pontos && d.pontos.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={Math.max(1.4, traco * 0.75)} fill="currentColor" stroke="none" />)}
    </svg>
  );
}
