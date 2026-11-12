import type { ReactNode } from "react";
import { infoDoConsole, type TipoConsole } from "../consoles";
import { matizDoTexto } from "../navegacao";

const tracos = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const DESENHOS: Record<string, ReactNode> = {
  inicio: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></>,
  biblioteca: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  loja: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
  controles: <><path d="M7 8h10a4 4 0 0 1 4 4.5l-.6 3.5a2.4 2.4 0 0 1-4.2 1.1L14.5 15h-5l-1.7 2.1a2.4 2.4 0 0 1-4.2-1.1L3 12.5A4 4 0 0 1 7 8Z" /><path d="M8 10.5v3M6.5 12h3" /><circle cx="15.5" cy="11" r=".6" /><circle cx="17.5" cy="13" r=".6" /></>,
  favoritos: <path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.8Z" />,
  ajustes: <><circle cx="12" cy="12" r="3.2" /><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" /></>,
  conta: <><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5H7Z" /></>,
  jogos: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5.5 5.5" /><path d="M8 10.5h5M10.5 8v5" /></>,
  aparencia: <><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.8 0-1.4-1.2-1.6-1.2-2.9 0-1 .8-1.8 1.9-1.8H17a3.5 3.5 0 0 0 3.5-3.5C20.5 6.6 16.7 3.5 12 3.5Z" /><circle cx="7.8" cy="11" r=".7" /><circle cx="10.2" cy="7.6" r=".7" /><circle cx="14.4" cy="7.6" r=".7" /></>,
  permissoes: <><path d="M12 3.5 19 6v5.5c0 4.4-2.9 7.5-7 9-4.1-1.5-7-4.6-7-9V6l7-2.5Z" /><path d="m9 12 2.2 2.2L15.2 10" /></>,
  modo: <path d="M13 2.8 5.5 13h5.3l-1 8.2L18.5 10.5h-5.4L13 2.8Z" />,
  emuladores: <><rect x="6.5" y="6.5" width="11" height="11" rx="2" /><rect x="9.5" y="9.5" width="5" height="5" rx=".8" /><path d="M9 3v3.5M15 3v3.5M9 17.5V21M15 17.5V21M3 9h3.5M3 15h3.5M17.5 9H21M17.5 15H21" /></>,
  atualizacoes: <><path d="M12 19V6" /><path d="m6.5 11.5 5.5-5.5 5.5 5.5" /><path d="M5 20h14" /></>,
  sobre: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r=".5" /></>,
  arquivos: <><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></>,
  atualizar: <><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v4.6h-4.6" /></>,
  wifi: <><path d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a8 8 0 0 1 11 0M9.4 16a4 4 0 0 1 5.2 0" /><circle cx="12" cy="19" r=".6" /></>,
  semrede: <><path d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a8 8 0 0 1 11 0" opacity=".45" /><path d="m5 5 14 14" /></>,
  nuvem: <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5H7Z" />,
};

export function Icone({ nome, className = "size-6" }: { nome: string; className?: string }) {
  return <svg viewBox="0 0 24 24" className={`ico ${className}`} aria-hidden {...tracos}>{DESENHOS[nome] ?? DESENHOS.sobre}</svg>;
}

/** Ícone grande com cara de objeto 3D: placa de vidro inclinada, camadas de sombra e brilho na cor do tema. */
export function Icone3D({ nome, tamanho = 112 }: { nome: string; tamanho?: number }) {
  return (
    <div className="icone3d" style={{ width: tamanho, height: tamanho }} aria-hidden>
      <div className="camada c3" /><div className="camada c2" />
      <div className="camada c1"><Icone nome={nome} className="size-[56%]" /></div>
    </div>
  );
}

const SILHUETAS: Record<TipoConsole, ReactNode> = {
  console: <><rect x="3" y="9" width="18" height="7.5" rx="2" /><path d="M7 12.7h4M15.5 11.5v2.4M14.3 12.7h2.4" /></>,
  portatil: <><rect x="6.5" y="3.5" width="11" height="17" rx="2.5" /><rect x="8.5" y="5.5" width="7" height="6" rx="1" /><path d="M9 15.5v2.4M7.8 16.7h2.4" /><circle cx="14.6" cy="16.2" r=".7" /><circle cx="16" cy="17.8" r=".7" /></>,
  computador: <><rect x="3.5" y="5" width="17" height="11" rx="1.6" /><path d="M9 20h6M12 16v4" /></>,
  arcade: <><path d="M5 20.5h14V11L16.5 6h-9L5 11v9.5Z" /><path d="M12 6V3.5" /><circle cx="12" cy="3" r="1" /><circle cx="8.5" cy="14.5" r=".9" /><circle cx="15.5" cy="14.5" r=".9" /></>,
};

/** Selo original do console: placa colorida (cor própria de cada console), silhueta do tipo e a sigla. Sem logotipos de fabricantes. */
export function IconeConsole({ id, tamanho = 96, sigla = true }: { id: string; tamanho?: number; sigla?: boolean }) {
  const info = infoDoConsole(id);
  const m = matizDoTexto(id);
  return (
    <div className="selo" style={{ width: tamanho, height: tamanho, ["--m" as string]: String(m), ["--t" as string]: `${tamanho}px` }} aria-hidden>
      <svg viewBox="0 0 24 24" className="ico size-[52%]" {...tracos}>{SILHUETAS[info.tipo]}</svg>
      {sigla && <span className="sigla">{info.curto}</span>}
    </div>
  );
}
