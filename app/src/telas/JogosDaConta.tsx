import { useEffect, useState } from "react";
import type { ContaVetorial, ResumoPlataforma } from "../ponte";
import type { Jogo } from "../ponte";
import { jogosQueFaltam, type JogoDaConta } from "../nuvemJogos";

/** "Na sua conta": jogos com progresso salvo em outro aparelho que ainda não estão neste. */
export function JogosDaConta({ conta, jogos, plats, aoProcurar }: { conta?: ContaVetorial; jogos: Jogo[]; plats: ResumoPlataforma[]; aoProcurar: () => void }) {
  const [lista, setLista] = useState<JogoDaConta[]>([]);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    let vivo = true;
    if (!conta) return;
    conta.estado().then((e) => (e.logado && e.vortex ? conta.nuvem() : [])).then((s) => { if (vivo) setLista(jogosQueFaltam(s, jogos, plats.map((p) => p.id))); }).catch(() => {});
    return () => { vivo = false; };
  }, [conta, jogos, plats]);
  if (!lista.length) return null;
  const nomeDaPlat = (id: string) => plats.find((p) => p.id === id)?.nome.replace(/\s*\(.*\)\s*$/, "") ?? "";
  return (
    <section className="vidro mb-6 p-5" aria-label="Jogos da sua conta em outro aparelho">
      <button data-foco className="flex w-full items-center justify-between text-left" onClick={() => setAberto(!aberto)}>
        <span className="text-lg font-black">☁ Na sua conta, em outro aparelho <span className="text-base font-semibold text-slate-400">{lista.length}</span></span>
        <span className="text-slate-400">{aberto ? "Fechar" : "Ver"}</span>
      </button>
      {aberto && (
        <>
          <p className="mt-2 text-sm text-slate-300">Esses jogos têm progresso salvo na sua conta. Coloque o mesmo arquivo do jogo numa das suas pastas deste aparelho e o Vortex continua de onde você parou. O Vortex não envia nem baixa jogos: só o save.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {lista.map((j) => (
              <li key={j.chave} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="font-semibold">{j.titulo}</div>
                <div className="text-xs text-slate-400">{[nomeDaPlat(j.plataforma), j.dispositivo && `salvo em ${j.dispositivo}`, j.atualizado ? new Date(j.atualizado).toLocaleDateString("pt-BR") : ""].filter(Boolean).join(" · ")}</div>
                <div className="mt-1 text-xs text-cyan-200">Baixe neste dispositivo o mesmo arquivo e continue de onde parou.</div>
              </li>
            ))}
          </ul>
          <div className="mt-3"><button data-foco className="botao" onClick={aoProcurar}>Já coloquei o arquivo: procurar jogos</button></div>
        </>
      )}
    </section>
  );
}
