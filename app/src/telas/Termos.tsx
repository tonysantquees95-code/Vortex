import { useState } from "react";
import { TERMOS } from "../termos";

/** Termos de uso: na primeira abertura a pessoa precisa aceitar para continuar; depois, dá para reler pelos Ajustes. */
export function Termos({ aoAceitar, aoFechar }: { aoAceitar?: () => void; aoFechar?: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4">
      <div className="vidro flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col gap-3 p-4 sm:p-6">
        <h2 className="shrink-0 text-xl font-bold sm:text-2xl">Termos de uso do Vortex</h2>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-2 text-sm text-slate-300" style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" }} tabIndex={0}>
          {TERMOS.map((t) => <section key={t.titulo}><h3 className="mb-1 font-semibold text-cyan-100">{t.titulo}</h3><p>{t.texto}</p></section>)}
        </div>
        {aoAceitar ? (
          <>
            <label className="flex shrink-0 cursor-pointer items-center gap-3 text-sm"><input data-foco type="checkbox" className="size-5" checked={ok} onChange={(e) => setOk(e.target.checked)} />Li e aceito os termos de uso do Vortex.</label>
            <div className="shrink-0"><button data-foco className="botao primario" disabled={!ok} onClick={aoAceitar}>Aceitar e continuar</button></div>
          </>
        ) : <div className="shrink-0"><button data-foco className="botao primario" onClick={aoFechar}>Fechar</button></div>}
      </div>
    </div>
  );
}
