import { useEffect, useState } from "react";
import type { Jogo } from "../ponte";
import { tempoJogado } from "../navegacao";
import { focar } from "../foco";
import { atalhosDeGuia, fichaConhecida, resolverFicha, type Ficha } from "../ficha";
import { Camada, Capa } from "./pecas";

/** Junta o que o arquivo já traz com o que se achou na internet (o do arquivo vale mais). */
function useFicha(j: Jogo): { ficha: Ficha | null; buscando: boolean } {
  const [ficha, setFicha] = useState<Ficha | null>(() => fichaConhecida(j.id) ?? null);
  const [buscando, setBuscando] = useState(false);
  useEffect(() => {
    const f = fichaConhecida(j.id);
    setFicha(f ?? null);
    const completo = j.descricao && j.ano && j.genero && j.desenvolvedor && j.jogadores;
    if (f !== undefined || completo || j.plataforma === "android") { setBuscando(false); return; }
    let vivo = true;
    setBuscando(true);
    void resolverFicha(j.id, j.titulo, j.plataforma).then((d) => { if (vivo) { setFicha(d); setBuscando(false); } });
    return () => { vivo = false; };
  }, [j.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ficha, buscando };
}

export function Detalhe({ jogo, aoJogar, aoFavoritar, aoFechar, aoAbrirUrl, aoEsconder, aoTirar }: { jogo: Jogo; aoJogar: (j: Jogo) => void; aoFavoritar: (j: Jogo) => void; aoFechar: () => void; aoAbrirUrl: (url: string) => void; aoEsconder: (j: Jogo) => void; aoTirar: (j: Jogo) => void }) {
  const [confirmar, setConfirmar] = useState<"esconder" | "fora" | null>(null);
  const { ficha, buscando } = useFicha(jogo);
  useEffect(() => {
    const voltar = () => aoFechar();
    const fav = () => aoFavoritar(jogo);
    window.addEventListener("vortex:voltar", voltar);
    window.addEventListener("vortex:favorito", fav);
    const primeiro = document.querySelector<HTMLElement>("[data-camada] [data-foco]");
    if (primeiro) focar(primeiro);
    return () => { window.removeEventListener("vortex:voltar", voltar); window.removeEventListener("vortex:favorito", fav); };
  }, [jogo, aoFechar, aoFavoritar]);

  const ano = jogo.ano ?? ficha?.ano;
  const dev = jogo.desenvolvedor ?? ficha?.desenvolvedor;
  const edi = jogo.editora ?? ficha?.editora;
  const descricao = jogo.descricao ?? ficha?.descricao;
  const vindoDaNet = Boolean(ficha && (ficha.descricao || ficha.ano || ficha.genero) && (!jogo.descricao || !jogo.ano || !jogo.genero));
  const faltou = buscando ? "buscando…" : "—";
  const fatos: [string, string][] = [
    ["Plataforma", jogo.plataforma.toUpperCase()],
    ["Ano", ano ? String(ano) : faltou],
    ["Gênero", jogo.genero ?? ficha?.genero ?? faltou],
    ["Jogadores", jogo.jogadores ?? ficha?.jogadores ?? faltou],
    ["Desenvolvedor", dev ?? faltou],
    ["Editora", edi ?? faltou],
    ["Tempo jogado", tempoJogado(jogo.tempo_total_s)],
    ["Sessões", String(jogo.sessoes)],
  ];
  return (
    <Camada aoFechar={aoFechar}>
      <div className="vidro entrar flex w-[min(920px,94vw)] max-h-[90vh] gap-8 overflow-hidden p-8 max-sm:flex-col">
        <div className="relative aspect-[3/4] w-56 flex-none overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(155,92,255,.35)] max-sm:w-40"><Capa j={jogo} /></div>
        <div className="rolagem -m-2 flex min-w-0 flex-1 flex-col p-2">
          <h2 className="titulo-neon text-3xl font-extrabold leading-tight">{jogo.titulo}</h2>
          <p className="mt-1 text-sm text-slate-400">{[dev, edi].filter((x, i, l) => x && l.indexOf(x) === i).join(" · ") || (buscando ? "Buscando informações…" : jogo.plataforma === "android" ? "Jogo instalado no aparelho" : "Desenvolvedor desconhecido")}</p>
          <p className="mt-4 text-slate-300">{descricao ?? (buscando ? "Buscando a descrição…" : "Não achei uma descrição para este jogo. Use os atalhos abaixo para ver vídeos e guias.")}</p>
          {vindoDaNet && ficha?.fonteUrl && <button data-foco className="mt-1 w-fit text-left text-xs text-slate-500 underline" onClick={() => aoAbrirUrl(ficha.fonteUrl!)}>Fonte: {ficha.fonte}</button>}
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {fatos.map(([k, v]) => <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
          </dl>
          {!jogo.disponivel && <p className="mt-4 rounded-lg bg-rose-500/15 p-3 text-sm text-rose-200">O arquivo deste jogo não foi encontrado. Confira se a pasta ou o HD está conectado.</p>}
          <div className="mt-auto flex flex-wrap gap-3 pt-6">
            <button data-foco className="botao primario" disabled={!jogo.disponivel} onClick={() => aoJogar(jogo)}>▶ Jogar</button>
            <button data-foco className="botao" onClick={() => aoFavoritar(jogo)}>{jogo.favorito ? "★ Nos favoritos" : "☆ Favoritar"}</button>
            <button data-foco className="botao" onClick={aoFechar}>Voltar</button>
          </div>
          <div className="pt-4">
            {confirmar ? (
              <div className="grid gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm">
                <p>{confirmar === "esconder" ? "Esconder este jogo do Início? Ele continua na Biblioteca." : "Tirar este jogo da biblioteca? Ele some do Vortex, mas o arquivo continua na pasta. Dá para trazer de volta em Ajustes › Jogos."}</p>
                <div className="flex flex-wrap gap-2"><button data-foco className="botao primario" onClick={() => (confirmar === "esconder" ? aoEsconder(jogo) : aoTirar(jogo))}>Sim, {confirmar === "esconder" ? "esconder" : "tirar"}</button><button data-foco className="botao" onClick={() => setConfirmar(null)}>Cancelar</button></div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button data-foco className="chip" onClick={() => setConfirmar("esconder")}>🙈 Esconder</button>
                <button data-foco className="chip" onClick={() => setConfirmar("fora")}>🗑 Tirar da biblioteca</button>
              </div>
            )}
          </div>
          <div className="pt-4">
            <p className="text-sm text-slate-500">Passar o jogo</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {atalhosDeGuia(jogo.titulo, jogo.plataforma).map((a) => <button key={a.nome} data-foco className="chip" onClick={() => aoAbrirUrl(a.url)}>{a.nome} ↗</button>)}
            </div>
          </div>
        </div>
      </div>
    </Camada>
  );
}
