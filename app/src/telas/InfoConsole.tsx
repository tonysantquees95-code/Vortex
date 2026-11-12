import { useEffect, useState } from "react";
import { tempoJogado } from "../navegacao";
import { focar } from "../foco";
import { infoDoConsole } from "../consoles";
import { Camada } from "./pecas";
import { IconeConsole } from "./Icones";
import type { Colecao } from "./Inicio";

const TIPO: Record<string, string> = { console: "Console de mesa", portatil: "Portátil", computador: "Computador", arcade: "Arcade" };

/** Informações do console e as duas saídas: esconder do Início ou tirar da biblioteca. Nenhum arquivo é apagado. */
export function InfoConsole({ c, aoEsconder, aoTirar, aoFechar }: { c: Colecao; aoEsconder: () => void; aoTirar: () => void; aoFechar: () => void }) {
  const [confirmar, setConfirmar] = useState<"esconder" | "fora" | null>(null);
  useEffect(() => {
    const v = () => (confirmar ? setConfirmar(null) : aoFechar());
    window.addEventListener("vortex:voltar", v);
    const primeiro = document.querySelector<HTMLElement>("[data-camada] [data-foco]");
    if (primeiro) focar(primeiro);
    return () => window.removeEventListener("vortex:voltar", v);
  }, [aoFechar, confirmar]);
  const info = infoDoConsole(c.id);
  const ausentes = c.jogos.filter((j) => !j.disponivel).length;
  const favoritos = c.jogos.filter((j) => j.favorito).length;
  const sessoes = c.jogos.reduce((s, j) => s + j.sessoes, 0);
  const ultimo = [...c.jogos].filter((j) => j.ultimo_jogo > 0).sort((a, b) => b.ultimo_jogo - a.ultimo_jogo)[0];
  const fatos: [string, string][] = [
    ["Jogos", String(c.total)],
    ["Tipo", TIPO[info.tipo] ?? "—"],
    ["Tempo jogado", tempoJogado(c.jogos.reduce((s, j) => s + j.tempo_total_s, 0))],
    ["Sessões", String(sessoes)],
    ["Favoritos", String(favoritos)],
    ["Arquivos faltando", String(ausentes)],
  ];
  return (
    <Camada aoFechar={aoFechar}>
      <div className="vidro entrar rolagem -m-0 flex max-h-[90vh] w-[min(620px,94vw)] flex-col gap-5 p-7">
        <div className="flex items-center gap-4"><IconeConsole id={c.id} tamanho={72} /><div className="min-w-0"><h2 className="titulo-neon text-2xl font-black leading-tight">{c.nome}</h2><p className="text-sm text-slate-400">{info.curto}</p></div></div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">{fatos.map(([k, v]) => <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl>
        {ultimo && <p className="text-sm text-slate-400">Último jogo: <span className="text-slate-200">{ultimo.titulo}</span></p>}
        {confirmar ? (
          <div className="grid gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm">
            <p>{confirmar === "esconder" ? `Esconder ${c.nome} do Início? Os jogos continuam em “Todos os jogos”.` : `Tirar ${c.nome} da biblioteca? Os ${c.total} jogos somem do Vortex, mesmo depois de procurar de novo. Seus arquivos não são apagados.`}</p>
            <p className="text-slate-400">Para trazer de volta: Ajustes › Jogos › Consoles escondidos.</p>
            <div className="flex flex-wrap gap-3"><button data-foco className="botao primario" onClick={confirmar === "esconder" ? aoEsconder : aoTirar}>Sim, {confirmar === "esconder" ? "esconder" : "tirar"}</button><button data-foco className="botao" onClick={() => setConfirmar(null)}>Cancelar</button></div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button data-foco className="botao" onClick={() => setConfirmar("esconder")}>🙈 Esconder do Início</button>
            <button data-foco className="botao" onClick={() => setConfirmar("fora")}>🗑 Tirar da biblioteca</button>
            <button data-foco className="botao" onClick={aoFechar}>Voltar</button>
          </div>
        )}
      </div>
    </Camada>
  );
}
