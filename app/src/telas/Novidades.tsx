import { marcarVisto, ROTULO, ultimoId, type Novidade } from "../novidades";
import { BUILD } from "../atualizacao";

const COR = { novo: "bg-cyan-300/15 text-cyan-200", melhoria: "bg-violet-400/15 text-violet-300", correcao: "bg-emerald-400/15 text-emerald-300" } as const;

/** "O que há de novo": aparece depois que a pessoa atualiza o app. */
export function Novidades({ itens, aoFechar }: { itens: Novidade[]; aoFechar: () => void }) {
  const fechar = () => { marcarVisto(ultimoId()); aoFechar(); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4">
      <div className="vidro flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col gap-3 p-4 sm:p-6">
        <div><h2 className="text-xl font-bold sm:text-2xl">O que há de novo</h2><p className="text-xs text-slate-400">{BUILD > 0 ? `Vortex 1.${BUILD} · ` : ""}o que mudou desde a última vez que você abriu</p></div>
        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
          {itens.map((n) => (
            <li key={n.id} className="rounded-xl bg-white/5 p-3">
              <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${COR[n.tipo]}`}>{ROTULO[n.tipo]}</span><b>{n.titulo}</b></div>
              <p className="mt-1 text-sm text-slate-300">{n.texto}</p>
            </li>
          ))}
        </ul>
        <div className="shrink-0"><button data-foco className="botao primario" onClick={fechar}>Entendi</button></div>
      </div>
    </div>
  );
}
