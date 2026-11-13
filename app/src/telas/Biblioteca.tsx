import { useMemo, useState } from "react";
import type { ContaVetorial, Jogo, Ordem, ResumoPlataforma } from "../ponte";
import { JogosDaConta } from "./JogosDaConta";
import { Carta } from "./pecas";
import { IconeConsole } from "./Icones";

/** Grade de jogos com capas, busca, ordem e filtro de console. Usada na Biblioteca, nos Favoritos e ao abrir um console da cascata. */
export function Biblioteca({ jogos, plats, aoAbrir, titulo, consoleFixo, vazio, aoVoltar, conta, aoProcurar }: {
  jogos: Jogo[]; plats: ResumoPlataforma[]; aoAbrir: (j: Jogo) => void; titulo?: string; consoleFixo?: string | null; vazio: string; aoVoltar?: () => void; conta?: ContaVetorial; aoProcurar?: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [plat, setPlat] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<Ordem>("titulo");
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const l = jogos.filter((j) => (!plat || j.plataforma === plat) && (!t || j.titulo.toLowerCase().includes(t)));
    return [...l].sort((a, b) => ordem === "recentes" ? b.ultimo_jogo - a.ultimo_jogo : ordem === "mais_jogados" ? b.tempo_total_s - a.tempo_total_s : ordem === "adicionados" ? b.adicionado - a.adicionado : ordem === "ano" ? (b.ano ?? 0) - (a.ano ?? 0) : a.titulo.localeCompare(b.titulo));
  }, [jogos, busca, plat, ordem]);
  return (
    <div className="entrar px-6 sm:px-10">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {aoVoltar && <button data-foco className="botao" onClick={aoVoltar}>‹ Voltar</button>}
        {titulo && <h2 className="flex items-center gap-3 text-2xl font-black">{consoleFixo && <IconeConsole id={consoleFixo} tamanho={44} sigla={false} />}{titulo}<span className="text-base font-semibold text-slate-400">{jogos.length}</span></h2>}
        <input data-foco value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar jogo…" className="vidro min-w-48 flex-1 px-4 py-3 text-base outline-none placeholder:text-slate-500 focus:border-cyan-300" />
        <select data-foco value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className="vidro bg-transparent px-3 py-3 text-sm outline-none" aria-label="Ordenar">
          <option value="titulo" className="bg-slate-900">A–Z</option><option value="recentes" className="bg-slate-900">Jogados agora</option>
          <option value="mais_jogados" className="bg-slate-900">Mais jogados</option><option value="adicionados" className="bg-slate-900">Novos</option><option value="ano" className="bg-slate-900">Ano</option>
        </select>
      </div>
      {!consoleFixo && conta && aoProcurar && <JogosDaConta conta={conta} jogos={jogos} plats={plats} aoProcurar={aoProcurar} />}
      {!consoleFixo && (
        <div className="rolagem mb-5 flex gap-2 py-2">
          <button data-foco className="chip" data-ativa={!plat} onClick={() => setPlat(null)}>Todas</button>
          {plats.map((p) => <button key={p.id} data-foco className="chip" data-ativa={plat === p.id} onClick={() => setPlat(plat === p.id ? null : p.id)}>{p.nome.replace(/\s*\(.*\)\s*$/, "")} · {p.total}</button>)}
        </div>
      )}
      {filtrados.length ? (
        <div className="grid gap-6 py-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(var(--carta-min), 1fr))" }}>
          {filtrados.map((j) => <Carta key={j.id} j={j} aoAbrir={aoAbrir} tamanho={0} />)}
        </div>
      ) : <p className="py-16 text-center text-slate-400">{vazio}</p>}
    </div>
  );
}
