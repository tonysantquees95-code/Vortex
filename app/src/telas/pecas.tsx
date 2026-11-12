import type { ReactNode } from "react";
import type { Jogo } from "../ponte";
import { iniciais, matizDoTexto } from "../navegacao";

export function Capa({ j, className = "" }: { j: Jogo; className?: string }) {
  const m = matizDoTexto(j.titulo);
  return (
    <div className={`absolute inset-0 ${className}`} style={{ background: `linear-gradient(145deg, hsl(${m} 70% 32%), hsl(${(m + 60) % 360} 75% 14%))` }}>
      {j.capa_online ? <img src={j.capa_online} alt="" loading="lazy" /> : <div className="arte">{iniciais(j.titulo)}</div>}
    </div>
  );
}

export function Carta({ j, aoAbrir, tamanho = 170 }: { j: Jogo; aoAbrir: (j: Jogo) => void; tamanho?: number }) {
  return (
    <button data-foco className="carta" style={tamanho ? { width: tamanho } : undefined} onClick={() => aoAbrir(j)} title={j.titulo}>
      <Capa j={j} />
      {j.favorito && <span className="estrela">★</span>}
      <div className="rodape">
        <div className="text-sm font-bold leading-tight line-clamp-2">{j.titulo}</div>
        <div className="text-[11px] uppercase tracking-wider text-cyan-200/70">{j.plataforma}</div>
      </div>
    </button>
  );
}

export function Carrossel({ titulo, jogos, aoAbrir }: { titulo: string; jogos: Jogo[]; aoAbrir: (j: Jogo) => void }) {
  if (!jogos.length) return null;
  return (
    <section className="entrar mb-8">
      <h3 className="mb-3 px-10 text-lg font-bold tracking-wide text-cyan-100/90">{titulo}</h3>
      <div className="rolagem flex gap-5 px-10 py-5 -my-5">{jogos.map((j) => <Carta key={j.id} j={j} aoAbrir={aoAbrir} />)}</div>
    </section>
  );
}

export function Interruptor({ ligado, rotulo, detalhe, aoMudar }: { ligado: boolean; rotulo: string; detalhe?: string; aoMudar: (v: boolean) => void }) {
  return (
    <button data-foco className="linha" role="switch" aria-checked={ligado} onClick={() => aoMudar(!ligado)}>
      <span><span className="block font-semibold">{rotulo}</span>{detalhe && <span className="block text-sm text-slate-400">{detalhe}</span>}</span>
      <span className="interruptor" data-lig={ligado} />
    </button>
  );
}

export function Camada({ children, aoFechar }: { children: ReactNode; aoFechar: () => void }) {
  return (
    <div data-camada className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={(e) => e.target === e.currentTarget && aoFechar()}>
      {children}
    </div>
  );
}
