import { useEffect } from "react";
import type { Jogo } from "../ponte";
import { tempoJogado } from "../navegacao";
import { focar } from "../foco";
import { Camada, Capa } from "./pecas";

export function Detalhe({ jogo, aoJogar, aoFavoritar, aoFechar }: { jogo: Jogo; aoJogar: (j: Jogo) => void; aoFavoritar: (j: Jogo) => void; aoFechar: () => void }) {
  useEffect(() => {
    const voltar = () => aoFechar();
    const fav = () => aoFavoritar(jogo);
    window.addEventListener("vortex:voltar", voltar);
    window.addEventListener("vortex:favorito", fav);
    const primeiro = document.querySelector<HTMLElement>("[data-camada] [data-foco]");
    if (primeiro) focar(primeiro);
    return () => { window.removeEventListener("vortex:voltar", voltar); window.removeEventListener("vortex:favorito", fav); };
  }, [jogo, aoFechar, aoFavoritar]);

  const fatos: [string, string][] = [
    ["Plataforma", jogo.plataforma.toUpperCase()],
    ["Ano", jogo.ano ? String(jogo.ano) : "—"],
    ["Gênero", jogo.genero ?? "—"],
    ["Jogadores", jogo.jogadores ?? "—"],
    ["Tempo jogado", tempoJogado(jogo.tempo_total_s)],
    ["Sessões", String(jogo.sessoes)],
  ];
  return (
    <Camada aoFechar={aoFechar}>
      <div className="vidro entrar flex w-[min(920px,94vw)] max-h-[90vh] gap-8 overflow-hidden p-8 max-sm:flex-col">
        <div className="relative aspect-[3/4] w-56 flex-none overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(155,92,255,.35)] max-sm:w-40"><Capa j={jogo} /></div>
        <div className="rolagem flex min-w-0 flex-1 flex-col">
          <h2 className="titulo-neon text-3xl font-extrabold leading-tight">{jogo.titulo}</h2>
          <p className="mt-1 text-sm text-slate-400">{[jogo.desenvolvedor, jogo.editora].filter(Boolean).join(" · ") || "Desenvolvedor desconhecido"}</p>
          <p className="mt-4 text-slate-300">{jogo.descricao ?? "Sem descrição ainda."}</p>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {fatos.map(([k, v]) => <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
          </dl>
          {!jogo.disponivel && <p className="mt-4 rounded-lg bg-rose-500/15 p-3 text-sm text-rose-200">O arquivo deste jogo não foi encontrado. Confira se a pasta ou o HD está conectado.</p>}
          <div className="mt-auto flex flex-wrap gap-3 pt-6">
            <button data-foco className="botao primario" disabled={!jogo.disponivel} onClick={() => aoJogar(jogo)}>▶ Jogar</button>
            <button data-foco className="botao" onClick={() => aoFavoritar(jogo)}>{jogo.favorito ? "★ Nos favoritos" : "☆ Favoritar"}</button>
            <button data-foco className="botao" onClick={aoFechar}>Voltar</button>
          </div>
        </div>
      </div>
    </Camada>
  );
}
