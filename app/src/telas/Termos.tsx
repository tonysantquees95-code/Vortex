import { useState } from "react";
import { TERMOS } from "../termos";

/** Termos de uso: na primeira abertura a pessoa precisa aceitar para continuar; depois, dá para reler pelos Ajustes. */
export function Termos({ aoAceitar, aoFechar }: { aoAceitar?: () => void; aoFechar?: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4">
      <div className="vidro flex max-h-full w-full max-w-2xl flex-col gap-4 p-6">
        <h2 className="text-2xl font-bold">Termos de uso do Vortex</h2>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 text-sm text-slate-300" tabIndex={0}>
          {TERMOS.map((t) => <section key={t.titulo}><h3 className="mb-1 font-semibold text-cyan-100">{t.titulo}</h3><p>{t.texto}</p></section>)}
        </div>
        {aoAceitar ? (
          <>
            <label className="flex cursor-pointer items-center gap-3 text-sm"><input data-foco type="checkbox" className="size-5" checked={ok} onChange={(e) => setOk(e.target.checked)} />Li e aceito os termos de uso do Vortex.</label>
            <div><button data-foco className="botao primario" disabled={!ok} onClick={aoAceitar}>Aceitar e continuar</button></div>
          </>
        ) : <div><button data-foco className="botao primario" onClick={aoFechar}>Fechar</button></div>}
      </div>
    </div>
  );
}
