import { marcarVisto, ROTULO, ultimoId, type Novidade } from "../novidades";
import { BUILD } from "../atualizacao";

const COR = { novo: "bg-neon/15 text-neon", melhoria: "bg-magenta/15 text-magenta", correcao: "bg-ok/15 text-ok" } as const;

/** "O que há de novo": aparece depois que a pessoa atualiza o app. */
export function Novidades({ itens, aoFechar }: { itens: Novidade[]; aoFechar: () => void }) {
  const fechar = () => { marcarVisto(ultimoId()); aoFechar(); };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col gap-3 rounded-2xl border border-borda bg-painel p-5">
        <div><h2 className="text-xl font-extrabold">O que há de novo</h2><p className="text-xs text-suave">{BUILD > 0 ? `Voxix 1.${BUILD} · ` : ""}o que mudou desde a última vez que você abriu</p></div>
        <ul className="rolagem min-h-0 flex-1 space-y-3 overflow-y-auto">
          {itens.map((n) => (
            <li key={n.id} className="rounded-xl border border-borda p-3">
              <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${COR[n.tipo]}`}>{ROTULO[n.tipo]}</span><b>{n.titulo}</b></div>
              <p className="mt-1 text-sm text-suave">{n.texto}</p>
            </li>
          ))}
        </ul>
        <button onClick={fechar} className="rounded-xl bg-neon py-3 font-extrabold text-white">Entendi</button>
      </div>
    </div>
  );
}
