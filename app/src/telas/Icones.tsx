import type { ReactNode } from "react";
import { infoDoConsole, type TipoConsole } from "../consoles";
import { matizDoTexto } from "../navegacao";

const tracos = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const DESENHOS: Record<string, ReactNode> = {
  ia: <><rect x="5" y="8" width="14" height="11" rx="3" /><path d="M12 8V4.500M9 13h.01M15 13h.01M9.500 16.500h5M2.500 12.500v2M21.500 12.500v2" /></>,
  chat: <><path d="M5 4.5h14a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-8l-5 3.5V17H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z" /><path d="M8 10.8h.01M12 10.8h.01M16 10.8h.01" /></>,
  bateria: <><rect x="3.5" y="8" width="15" height="8.5" rx="2" /><path d="M21 11v2.5M7 11v2.5" /></>,
  balanca: <><path d="M12 4v16M8 20h8M4 8h16" /><path d="m4 8-2 5h4zM20 8l-2 5h4z" /></>,
  folha: <><path d="M5 19C5 9 11 5 20 4.5 20 14 15 19 5 19z" /><path d="M5 19c3-5 6-8 10-10" /></>,
  buscar: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5.5 5.5" /></>,
  limpar: <><path d="m14 4 6 6M16.5 6.5 10 13" /><path d="M7 11.5 12.5 17 9 20.500 3.500 15z" /></>,
  camera: <><path d="M4.500 8h3l1.600-2.500h5.800L16.500 8h3A1.500 1.500 0 0 1 21 9.500v8a1.500 1.500 0 0 1-1.500 1.500h-15A1.500 1.500 0 0 1 3 17.500v-8A1.500 1.500 0 0 1 4.500 8z" /><circle cx="12" cy="13" r="3.200" /></>,
  imagem: <><rect x="3.500" y="4.500" width="17" height="15" rx="2.500" /><circle cx="9" cy="10" r="1.600" /><path d="m4.500 17.500 4.500-4.500 3.500 3.500 3-3 4 4" /></>,
  esconder: <><path d="M3 12s3.200-6 9-6 9 6 9 6-3.200 6-9 6-9-6-9-6z" /><path d="M4 20 20 4" /></>,
  lixo: <path d="M5 7h14M9.500 7V4.500h5V7M7 7l.8 12.500h8.400L17 7" />,
  baixar: <path d="M12 4v11M7.500 11l4.500 4.500 4.500-4.500M5 20h14" />,
  inicio: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></>,
  biblioteca: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  loja: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
  controles: <><path d="M7 8h10a4 4 0 0 1 4 4.5l-.6 3.5a2.4 2.4 0 0 1-4.2 1.1L14.5 15h-5l-1.7 2.1a2.4 2.4 0 0 1-4.2-1.1L3 12.5A4 4 0 0 1 7 8Z" /><path d="M8 10.5v3M6.5 12h3" /><circle cx="15.5" cy="11" r=".6" /><circle cx="17.5" cy="13" r=".6" /></>,
  favoritos: <path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.8Z" />,
  ajustes: <><path d="M10.32 5.00 L10.87 2.47 L13.13 2.47 L13.68 5.00 L15.76 5.86 L17.94 4.46 L19.54 6.06 L18.14 8.24 L19.00 10.32 L21.53 10.87 L21.53 13.13 L19.00 13.68 L18.14 15.76 L19.54 17.94 L17.94 19.54 L15.76 18.14 L13.68 19.00 L13.13 21.53 L10.87 21.53 L10.32 19.00 L8.24 18.14 L6.06 19.54 L4.46 17.94 L5.86 15.76 L5.00 13.68 L2.47 13.13 L2.47 10.87 L5.00 10.32 L5.86 8.24 L4.46 6.06 L6.06 4.46 L8.24 5.86 Z" strokeLinejoin="round" /><circle cx="12" cy="12" r="3.1" /></>,
  conta: <><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5H7Z" /></>,
  drive: <><rect x="3.5" y="4" width="17" height="6" rx="1.8" /><rect x="3.5" y="14" width="17" height="6" rx="1.8" /><path d="M7 7h.01M7 17h.01M11 7h5M11 17h5" /></>,
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
  conquistas: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5a2 2 0 0 0 2 4M16 6h3a2 2 0 0 1-2 4" /><path d="M12 13v4M8.5 20h7M10 17h4" /></>,
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
