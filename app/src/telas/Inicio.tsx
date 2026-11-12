import { useEffect, useMemo, useRef, useState } from "react";
import type { Jogo, ResumoPlataforma } from "../ponte";
import { tempoJogado } from "../navegacao";
import { focar } from "../foco";
import { Capa } from "./pecas";
import { Icone, IconeConsole } from "./Icones";

export interface Colecao { id: string; nome: string; total: number; tipo: "todos" | "favoritos" | "recentes" | "console"; jogos: Jogo[] }

/** Monta a lista da cascata: coleções especiais primeiro, depois um item por console (só os que têm jogos). */
export function colecoesDe(jogos: Jogo[], plats: ResumoPlataforma[]): Colecao[] {
  const fav = jogos.filter((j) => j.favorito);
  const jogados = jogos.filter((j) => j.ultimo_jogo > 0).sort((a, b) => b.ultimo_jogo - a.ultimo_jogo);
  const l: Colecao[] = [{ id: "todos", nome: "Todos os jogos", total: jogos.length, tipo: "todos", jogos }];
  if (fav.length) l.push({ id: "favoritos", nome: "Favoritos", total: fav.length, tipo: "favoritos", jogos: fav });
  if (jogados.length) l.push({ id: "recentes", nome: "Jogados há pouco", total: jogados.length, tipo: "recentes", jogos: jogados.slice(0, 30) });
  for (const p of plats) {
    const js = jogos.filter((j) => j.plataforma === p.id);
    if (js.length) l.push({ id: p.id, nome: p.nome.replace(/\s*\(.*\)\s*$/, ""), total: js.length, tipo: "console", jogos: js });
  }
  return l;
}

const passoPara = () => (typeof window !== "undefined" && window.innerHeight < 520 ? 62 : 92);

/** Início: lista em cascata de consoles (como nos consoles portáteis). Quem está em foco cresce, o fundo troca para a capa dele; A abre os jogos. */
export function Inicio({ colecoes, inicial, aoAbrir, aoFocar, jogoParaContinuar, aoContinuar }: {
  colecoes: Colecao[]; inicial: string | null; aoAbrir: (c: Colecao) => void; aoFocar: (c: Colecao) => void;
  jogoParaContinuar: Jogo | null; aoContinuar: (j: Jogo) => void;
}) {
  const inicioIdx = Math.max(0, colecoes.findIndex((c) => c.id === inicial));
  const [sel, setSel] = useState(inicioIdx);
  const toque = useRef<number | null>(null);
  const raiz = useRef<HTMLDivElement | null>(null);
  const atual = colecoes[Math.min(sel, colecoes.length - 1)];

  useEffect(() => { if (sel >= colecoes.length) setSel(Math.max(0, colecoes.length - 1)); }, [colecoes.length, sel]);
  useEffect(() => { if (atual) aoFocar(atual); }, [atual?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // ao entrar (ou voltar de uma coleção), o foco vai para o item certo
  useEffect(() => {
    const t = window.setTimeout(() => { const el = raiz.current?.querySelector<HTMLElement>(`[data-colecao="${colecoes[inicioIdx]?.id}"]`); if (el) focar(el); }, 80);
    return () => window.clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ir = (d: number) => {
    const alvo = colecoes[Math.max(0, Math.min(colecoes.length - 1, sel + d))];
    const el = raiz.current?.querySelector<HTMLElement>(`[data-colecao="${alvo.id}"]`);
    if (el) focar(el); else setSel(sel + d);
  };
  const y0 = useRef(0);
  const [passo, setPasso] = useState(passoPara);
  useEffect(() => { const f = () => setPasso(passoPara()); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const visiveis = useMemo(() => colecoes.map((c, i) => ({ c, i, d: i - sel })).filter((x) => Math.abs(x.d) <= 3), [colecoes, sel]);
  if (!atual) return null;

  return (
    <div ref={raiz} className="inicio-cascata entrar" onWheel={(e) => { if (Math.abs(e.deltaY) > 20) ir(e.deltaY > 0 ? 1 : -1); }}
      onTouchStart={(e) => { y0.current = e.touches[0].clientY; }} onTouchEnd={(e) => { const dy = e.changedTouches[0].clientY - y0.current; if (Math.abs(dy) > 50) ir(dy < 0 ? 1 : -1); }}>
      <div className="cascata" role="listbox" aria-label="Consoles">
        {visiveis.map(({ c, i, d }) => (
          <button key={c.id} data-foco data-colecao={c.id} role="option" aria-selected={d === 0} className="cascata-item" data-atual={d === 0}
            style={{ transform: `translateY(calc(-50% + ${d * passo + (d > 0 ? passo * 0.28 : d < 0 ? -passo * 0.28 : 0)}px)) scale(${1 - 0.09 * Math.abs(d)})`, opacity: 1 - 0.28 * Math.abs(d), zIndex: 10 - Math.abs(d) }}
            onFocus={() => setSel(i)} onPointerDown={() => { toque.current = sel; }}
            onClick={() => { const t = toque.current; toque.current = null; if (t !== null && t !== i) return; aoAbrir(c); }}>
            {c.tipo === "console" ? <IconeConsole id={c.id} tamanho={d === 0 ? (passo < 70 ? 52 : 76) : passo < 70 ? 40 : 56} /> : <span className="selo-colecao" style={{ width: d === 0 ? (passo < 70 ? 52 : 76) : passo < 70 ? 40 : 56, height: d === 0 ? (passo < 70 ? 52 : 76) : passo < 70 ? 40 : 56 }}><Icone nome={c.tipo === "favoritos" ? "favoritos" : c.tipo === "recentes" ? "jogos" : "biblioteca"} className="size-1/2" /></span>}
            <span className="min-w-0 flex-1 text-left"><span className="block truncate text-xl font-extrabold leading-tight">{c.nome}</span><span className="block text-sm text-slate-300/80">{c.total} {c.total === 1 ? "jogo" : "jogos"}</span></span>
            {d === 0 && <span className="cores-neon text-2xl">›</span>}
          </button>
        ))}
      </div>
      <div key={atual.id} className="previa entrar">
        <div className="previa-selo">{atual.tipo === "console" ? <IconeConsole id={atual.id} tamanho={150} /> : <span className="selo-colecao" style={{ width: 150, height: 150 }}><Icone nome={atual.tipo === "favoritos" ? "favoritos" : atual.tipo === "recentes" ? "jogos" : "biblioteca"} className="size-1/2" /></span>}</div>
        <h2 className="titulo-neon text-3xl font-black leading-tight sm:text-4xl">{atual.nome}</h2>
        <p className="text-slate-300">{atual.total} {atual.total === 1 ? "jogo" : "jogos"} · {tempoJogado(atual.jogos.reduce((s, j) => s + j.tempo_total_s, 0))} jogados</p>
        <div className="previa-capas" aria-hidden>
          {atual.jogos.slice(0, 4).map((j) => <div key={j.id} className="mini-capa"><Capa j={j} /></div>)}
        </div>
        {jogoParaContinuar && <button data-foco className="botao mt-2" onClick={() => aoContinuar(jogoParaContinuar)}>▶ Continuar: {jogoParaContinuar.titulo}</button>}
      </div>
    </div>
  );
}
