import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Jogo, ResumoPlataforma } from "../ponte";
import { tempoJogado } from "../navegacao";
import { focar } from "../foco";
import { capaConhecida, resolverCapa } from "../capas";
import { registrarVoltar } from "../voltar";
import { Capa } from "./pecas";
import { Icone, IconeConsole } from "./Icones";

export interface Colecao { id: string; nome: string; total: number; tipo: "todos" | "android" | "favoritos" | "recentes" | "console"; jogos: Jogo[] }

/** Monta a lista da cascata: Todos, Android (jogos instalados no aparelho), coleções especiais e um item por console (só os que têm jogos). */
export function colecoesDe(jogos: Jogo[], plats: ResumoPlataforma[], escondidos: string[] = []): Colecao[] {
  const fav = jogos.filter((j) => j.favorito);
  const jogados = jogos.filter((j) => j.ultimo_jogo > 0).sort((a, b) => b.ultimo_jogo - a.ultimo_jogo);
  const apps = jogos.filter((j) => j.plataforma === "android");
  const l: Colecao[] = [{ id: "todos", nome: "Todos os jogos", total: jogos.length, tipo: "todos", jogos }];
  if (apps.length) l.push({ id: "android", nome: "Android", total: apps.length, tipo: "android", jogos: apps });
  if (fav.length) l.push({ id: "favoritos", nome: "Favoritos", total: fav.length, tipo: "favoritos", jogos: fav });
  if (jogados.length) l.push({ id: "recentes", nome: "Jogados há pouco", total: jogados.length, tipo: "recentes", jogos: jogados.slice(0, 30) });
  for (const p of plats) {
    if (p.id === "android" || escondidos.includes(p.id)) continue;
    const js = jogos.filter((j) => j.plataforma === p.id);
    if (js.length) l.push({ id: p.id, nome: p.nome.replace(/\s*\(.*\)\s*$/, ""), total: js.length, tipo: "console", jogos: js });
  }
  return l;
}

const passoPara = () => (typeof window !== "undefined" && window.innerHeight < 520 ? 62 : 92);
const plural = (n: number) => `${n} ${n === 1 ? "jogo" : "jogos"}`;

/** Quantos itens para cada lado cabem na altura disponível (nada passa da borda e fica cortado). */
export function quantosCabem(altura: number, passo: number): number {
  let n = 0;
  while (n < 3 && (n + 1) * passo + passo * 0.28 + passo * 0.35 <= altura / 2 + 4) n++;
  return Math.max(1, n); // ao menos o vizinho de cada lado, senão as setas pulam para fora da lista
}

/** Lista em cascata (como nos consoles portáteis): o item em foco cresce, os vizinhos encolhem e somem. */
function Cascata<T>({ itens, sel, aoSel, chaveDe, nome, rotulo, passo, aoClicar, desenho }: {
  itens: T[]; sel: number; aoSel: (i: number) => void; chaveDe: (t: T) => string; nome: string; rotulo: string; passo: number;
  aoClicar: (t: T) => void; desenho: (t: T, d: number) => ReactNode;
}) {
  const raiz = useRef<HTMLDivElement | null>(null);
  const toque = useRef<number | null>(null);
  const y0 = useRef(0);
  const [altura, setAltura] = useState(() => (typeof window !== "undefined" ? window.innerHeight * 0.6 : 400));
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    setAltura(el.clientHeight || altura);
    if (typeof ResizeObserver === "undefined") return;
    const o = new ResizeObserver(() => setAltura(el.clientHeight || 400));
    o.observe(el);
    return () => o.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const alcance = quantosCabem(altura, passo);
  const ir = (d: number) => {
    const alvo = itens[Math.max(0, Math.min(itens.length - 1, sel + d))];
    const el = alvo && raiz.current?.querySelector<HTMLElement>(`[data-chave="${CSS.escape(chaveDe(alvo))}"]`);
    if (el) focar(el); else aoSel(Math.max(0, Math.min(itens.length - 1, sel + d)));
  };
  return (
    <div ref={raiz} className="cascata" role="listbox" aria-label={rotulo}
      onWheel={(e) => { if (Math.abs(e.deltaY) > 20) ir(e.deltaY > 0 ? 1 : -1); }}
      onTouchStart={(e) => { y0.current = e.touches[0].clientY; }}
      onTouchEnd={(e) => { const dy = e.changedTouches[0].clientY - y0.current; if (Math.abs(dy) > 50) ir(dy < 0 ? 1 : -1); }}>
      {itens.map((t, i) => ({ t, i, d: i - sel })).filter((x) => Math.abs(x.d) <= alcance).map(({ t, i, d }) => (
        <button key={chaveDe(t)} data-foco data-cascata={nome} data-chave={chaveDe(t)} role="option" aria-selected={d === 0} className="cascata-item" data-atual={d === 0}
          style={{ transform: `translateY(calc(-50% + ${d * passo + (d > 0 ? passo * 0.28 : d < 0 ? -passo * 0.28 : 0)}px)) scale(${1 - 0.09 * Math.abs(d)})`, opacity: 1 - 0.28 * Math.abs(d), zIndex: 10 - Math.abs(d) }}
          onFocus={() => aoSel(i)} onPointerDown={() => { toque.current = sel; }}
          onClick={() => { const a = toque.current; toque.current = null; if (a !== null && a !== i) return; aoClicar(t); }}>
          {desenho(t, d)}
        </button>
      ))}
    </div>
  );
}

/** Capa de fundo de um console: a primeira que se conhece entre os primeiros jogos; no item em foco ela é procurada na internet. */
function useCapaDaColecao(c: Colecao, buscar: boolean): string | null {
  const achada = () => c.jogos.slice(0, 6).map((j) => capaConhecida(j.id)).find(Boolean) ?? null;
  const [url, setUrl] = useState<string | null>(achada);
  useEffect(() => {
    setUrl(achada());
    if (!buscar || achada()) return;
    let vivo = true;
    const t = window.setTimeout(async () => {
      for (const j of c.jogos.slice(0, 6)) { const u = await resolverCapa(j); if (!vivo) return; if (u) { setUrl(u); return; } }
    }, 250);
    return () => { vivo = false; window.clearTimeout(t); };
  }, [c.id, c.jogos.length, buscar]); // eslint-disable-line react-hooks/exhaustive-deps
  return url;
}

const seloDe = (c: Colecao, tamanho: number) =>
  c.tipo === "console" || c.tipo === "android" ? <IconeConsole id={c.id} tamanho={tamanho} />
    : <span className="selo-colecao" style={{ width: tamanho, height: tamanho }}><Icone nome={c.tipo === "favoritos" ? "favoritos" : c.tipo === "recentes" ? "jogos" : "biblioteca"} className="size-1/2" /></span>;

function ItemConsole({ c, d, estreito, passo }: { c: Colecao; d: number; estreito: boolean; passo: number }) {
  const capa = useCapaDaColecao(c, d === 0);
  const baixo = passo < 70;
  const tam = estreito ? (d === 0 ? 52 : 42) : d === 0 ? (baixo ? 56 : 84) : baixo ? 40 : 56;
  return (
    <>
      {capa && !estreito && <span className="item-fundo" style={{ backgroundImage: `url("${capa}")` }} aria-hidden />}
      {seloDe(c, tam)}
      {!estreito && <span className="item-texto min-w-0 flex-1 text-left"><span className="block truncate text-xl font-extrabold leading-tight">{c.nome}</span><span className="block text-sm text-slate-200/85">{plural(c.total)}</span></span>}
      {!estreito && d === 0 && <span className="cores-neon text-2xl">›</span>}
    </>
  );
}

function ItemJogo({ j, d, passo }: { j: Jogo; d: number; passo: number }) {
  const w = passo < 70 ? (d === 0 ? 40 : 32) : d === 0 ? 56 : 44;
  return (
    <>
      <span className="mini-capa" style={{ width: w }}><Capa j={j} /></span>
      <span className="min-w-0 flex-1 text-left">
        <span className={`block text-base font-bold leading-tight ${d === 0 ? "line-clamp-2" : "truncate"}`}>{j.titulo}</span>
        <span className="block truncate text-xs uppercase tracking-wider text-cyan-200/70">{j.plataforma}{j.favorito ? " · ★" : ""}</span>
      </span>
    </>
  );
}

export interface PropsInicio {
  colecoes: Colecao[]; inicial: string | null;
  aoFocar: (c: Colecao) => void; aoFocarJogo: (j: Jogo | null) => void; aoLembrar: (id: string) => void;
  aoJogar: (j: Jogo) => void; aoDetalhes: (j: Jogo) => void; aoFavoritar: (j: Jogo) => void;
  jogoParaContinuar: Jogo | null; aoContinuar: (j: Jogo) => void;
  aoInfoConsole: (c: Colecao) => void;
}

/** Início: consoles em cascata; clicar abre, ao lado, a lista dos jogos do console (um de cada vez), sem trocar de tela. B volta. */
export function Inicio({ colecoes, inicial, aoFocar, aoFocarJogo, aoLembrar, aoJogar, aoDetalhes, aoFavoritar, jogoParaContinuar, aoContinuar, aoInfoConsole }: PropsInicio) {
  const [selC, setSelC] = useState(() => Math.max(0, colecoes.findIndex((c) => c.id === inicial)));
  const [selJ, setSelJ] = useState(0);
  const [nivel, setNivel] = useState<0 | 1>(0);
  const raiz = useRef<HTMLDivElement | null>(null);
  const [passo, setPasso] = useState(passoPara);
  const atual = colecoes[Math.min(selC, colecoes.length - 1)];
  const jogos = atual?.jogos ?? [];
  const jogoAtual = nivel === 1 ? jogos[Math.min(selJ, jogos.length - 1)] ?? null : null;

  useEffect(() => { const f = () => setPasso(passoPara()); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  useEffect(() => { if (selC >= colecoes.length) setSelC(Math.max(0, colecoes.length - 1)); }, [colecoes.length, selC]);
  useEffect(() => { if (atual) aoFocar(atual); }, [atual?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { aoFocarJogo(jogoAtual); }, [jogoAtual?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const focarEm = useCallback((nome: string, chave?: string) => {
    const el = raiz.current?.querySelector<HTMLElement>(chave ? `[data-cascata="${nome}"][data-chave="${CSS.escape(chave)}"]` : `[data-cascata="${nome}"][data-atual="true"]`);
    if (el) focar(el);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => focarEm("consoles", colecoes[selC]?.id), 80);
    return () => window.clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = (c: Colecao) => {
    if (!c.jogos.length) return;
    aoLembrar(c.id); setSelJ(0); setNivel(1);
    window.setTimeout(() => focarEm("jogos"), 90);
  };
  const voltar = useCallback(() => {
    setNivel(0);
    window.setTimeout(() => focarEm("consoles", atual?.id), 90);
  }, [atual?.id, focarEm]);
  useEffect(() => {
    if (nivel !== 1) return;
    window.addEventListener("vortex:voltar", voltar);
    return () => window.removeEventListener("vortex:voltar", voltar);
  }, [nivel, voltar]);
  useEffect(() => { if (nivel !== 1) return; return registrarVoltar(2, () => { voltar(); return true; }); }, [nivel, voltar]);
  // Y/F favorita o jogo selecionado
  useEffect(() => {
    if (!jogoAtual) return;
    const f = () => aoFavoritar(jogoAtual);
    window.addEventListener("vortex:favorito", f);
    return () => window.removeEventListener("vortex:favorito", f);
  }, [jogoAtual, aoFavoritar]);

  if (!atual) return null;
  return (
    <div ref={raiz} className="inicio-cascata entrar" data-nivel={nivel}>
      <Cascata nome="consoles" rotulo="Consoles" itens={colecoes} sel={selC} aoSel={(i) => { if (i !== selC) { setSelC(i); setSelJ(0); } }} chaveDe={(c) => c.id}
        passo={passo} aoClicar={abrir} desenho={(c, d) => <ItemConsole c={c} d={d} estreito={nivel === 1} passo={passo} />} />
      {nivel === 1 && (
        <div className="coluna-jogos entrar">
          <div className="coluna-jogos-cab"><button data-foco className="botao" onClick={voltar} aria-label="Voltar para os consoles">‹ {atual.nome}</button><span className="text-sm text-slate-300">{plural(atual.total)}</span>{atual.tipo === "console" && <button data-foco className="botao botao-topo" onClick={() => aoInfoConsole(atual)} aria-label="Informações do console" title="Informações do console">ⓘ</button>}</div>
          <Cascata nome="jogos" rotulo={`Jogos de ${atual.nome}`} itens={jogos} sel={Math.min(selJ, jogos.length - 1)} aoSel={setSelJ} chaveDe={(j) => j.id} passo={passo}
            aoClicar={aoJogar} desenho={(j, d) => <ItemJogo j={j} d={d} passo={passo} />} />
        </div>
      )}
      {nivel === 1 && jogoAtual ? (
        <div key={jogoAtual.id} className="previa previa-jogo entrar">
          <div className="capa-grande"><Capa j={jogoAtual} /></div>
          <div className="min-w-0">
            <h2 className="titulo-neon line-clamp-3 text-2xl font-black leading-tight sm:text-3xl">{jogoAtual.titulo}</h2>
            <p className="mt-1 text-sm text-slate-300">{[jogoAtual.plataforma.toUpperCase(), jogoAtual.ano, jogoAtual.sessoes ? tempoJogado(jogoAtual.tempo_total_s) : null].filter(Boolean).join(" · ")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button data-foco className="botao primario" onClick={() => aoJogar(jogoAtual)}>▶ Jogar</button>
              <button data-foco className="botao" aria-label={jogoAtual.favorito ? "Tirar dos favoritos" : "Favoritar"} onClick={() => aoFavoritar(jogoAtual)}>{jogoAtual.favorito ? "★" : "☆"}<span className="so-alto">{jogoAtual.favorito ? "Favorito" : "Favoritar"}</span></button>
              <button data-foco className="botao" aria-label="Detalhes" onClick={() => aoDetalhes(jogoAtual)}>ⓘ<span className="so-alto">Detalhes</span></button>
            </div>
          </div>
        </div>
      ) : (
        <div key={atual.id} className="previa entrar">
          <div className="previa-selo">{seloDe(atual, 150)}</div>
          <h2 className="titulo-neon text-3xl font-black leading-tight sm:text-4xl">{atual.nome}</h2>
          <p className="text-slate-300">{plural(atual.total)} · {tempoJogado(atual.jogos.reduce((s, j) => s + j.tempo_total_s, 0))} jogados</p>
          <div className="previa-capas" aria-hidden>
            {atual.jogos.slice(0, 4).map((j) => <div key={j.id} className="mini-capa"><Capa j={j} /></div>)}
          </div>
          {atual.tipo === "console" && <button data-foco className="botao mt-2 w-fit" onClick={() => aoInfoConsole(atual)}>ⓘ Informações do console</button>}
          {jogoParaContinuar && <button data-foco className="botao continuar mt-2" onClick={() => aoContinuar(jogoParaContinuar)}>▶ Continuar: {jogoParaContinuar.titulo}</button>}
        </div>
      )}
    </div>
  );
}
