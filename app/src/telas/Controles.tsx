import { useCallback, useEffect, useState } from "react";
import type { Controles as Ponte, ModeloControle, PerfilControle } from "../ponte";

type Dados = { perfis: PerfilControle[]; ativos: Record<string, string> };

/** Jogos de Android sem suporte a controle: escolher o jogo, um modelo de layout, posicionar os botões e guardar perfis. */
export function Controles({ controles, avisar }: { controles: Ponte; avisar: (t: string) => void }) {
  const [jogos, setJogos] = useState<{ pacote: string; nome: string }[] | null>(null);
  const [dados, setDados] = useState<Dados>({ perfis: [], ativos: {} });
  const [modelos, setModelos] = useState<ModeloControle[]>([]);
  const [servico, setServico] = useState(true);
  const [aberto, setAberto] = useState<{ pacote: string; nome: string } | null>(null);

  const recarregar = useCallback(() => {
    controles.perfis().then(setDados).catch((e) => avisar(String(e)));
    controles.servicoAtivo().then(setServico).catch(() => {});
  }, [controles, avisar]);
  useEffect(() => {
    controles.jogos().then((l) => setJogos(l.sort((a, b) => a.nome.localeCompare(b.nome)))).catch((e) => { avisar(String(e)); setJogos([]); });
    controles.modelos().then(setModelos).catch(() => {});
    recarregar();
    const v = () => recarregar();
    window.addEventListener("focus", v);
    return () => window.removeEventListener("focus", v);
  }, [controles, avisar, recarregar]);

  const tente = async (f: () => Promise<unknown>) => { try { await f(); recarregar(); } catch (e) { avisar(String(e instanceof Error ? e.message : e)); } };

  if (aberto) {
    const meus = dados.perfis.filter((p) => p.pacote === aberto.pacote);
    const ativo = dados.ativos[aberto.pacote];
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <button data-foco className="botao" onClick={() => setAberto(null)}>← Voltar</button>
        <h2 className="text-2xl font-bold">{aberto.nome}</h2>
        {!servico && <AvisoServico aoAbrir={() => tente(controles.abrirAcessibilidade)} />}
        <section className="space-y-2">
          <h3 className="font-semibold text-slate-300">Perfis salvos</h3>
          {meus.length === 0 && <p className="text-slate-400">Nenhum perfil ainda. Crie um a partir de um modelo abaixo.</p>}
          {meus.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 p-3">
              <span className="flex-1 font-medium">{p.nome}{ativo === p.id ? " · em uso" : ""}</span>
              {ativo !== p.id && <button data-foco className="botao" onClick={() => tente(() => controles.ativar(p.pacote, p.id))}>Usar</button>}
              <button data-foco className="botao" onClick={() => tente(() => controles.posicionar(p.pacote, p.id))}>Posicionar botões</button>
              <button data-foco className="botao" onClick={() => tente(() => controles.apagar(p.id))}>Apagar</button>
            </div>
          ))}
        </section>
        <section className="space-y-2">
          <h3 className="font-semibold text-slate-300">Criar perfil a partir de um modelo</h3>
          {modelos.map((m) => (
            <button key={m.modelo} data-foco className="block w-full rounded-xl bg-white/5 p-3 text-left" onClick={() => tente(() => controles.novo(aberto.pacote, "", m.modelo))}>
              <span className="font-medium">{m.nome}</span><span className="block text-sm text-slate-400">{m.descricao}</span>
            </button>
          ))}
        </section>
        <button data-foco className="botao primario" disabled={meus.length === 0} onClick={() => tente(() => controles.jogar(aberto.pacote))}>Jogar com o controle</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-slate-300">Para jogos de Android que não funcionam com controle: o Vortex transforma os botões do controle em toques na tela, no lugar que você escolher.</p>
      {!servico && <AvisoServico aoAbrir={() => tente(controles.abrirAcessibilidade)} />}
      {jogos === null ? <p className="text-slate-400">Procurando jogos instalados…</p> : jogos.length === 0 ? <p className="text-slate-400">Nenhum jogo de Android encontrado neste aparelho.</p> : jogos.map((j) => (
        <button key={j.pacote} data-foco className="flex w-full items-center justify-between rounded-xl bg-white/5 p-3 text-left" onClick={() => setAberto(j)}>
          <span className="font-medium">{j.nome}</span>
          <span className="text-sm text-slate-400">{dados.ativos[j.pacote] ? "perfil ativo" : "sem perfil"}</span>
        </button>
      ))}
    </div>
  );
}

function AvisoServico({ aoAbrir }: { aoAbrir: () => void }) {
  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
      <p>Falta ativar o serviço <b>Vortex Controle</b> em Acessibilidade. Ele só serve para tocar na tela por você quando o controle é apertado; não lê nada do que aparece.</p>
      <button data-foco className="botao mt-2" onClick={aoAbrir}>Abrir configurações de acessibilidade</button>
    </div>
  );
}
