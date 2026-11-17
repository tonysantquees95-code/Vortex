import { useState } from "react";
import { marcarTourVisto, TOUR } from "../tour";

/** Telas passando (toque, setas do controle ou botões): cada função e como usar. Abre na primeira vez e em Ajustes › Sobre. */
export function Tour({ aoTerminar, rotuloFinal = "Continuar" }: { aoTerminar: () => void; rotuloFinal?: string }) {
  const [i, setI] = useState(0);
  const p = TOUR[i]!;
  const ultimo = i === TOUR.length - 1;
  const fim = () => { marcarTourVisto(); aoTerminar(); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4">
      <div className="vidro flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col gap-4 p-5 text-center sm:p-8">
        {/* o texto rola quando a tela é baixa (celular deitado); os botões ficam sempre à vista */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pr-1" style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" }} tabIndex={0}>
        <div className="text-5xl" aria-hidden>{p.icone}</div>
        <h2 className="text-2xl font-bold">{p.titulo}</h2>
        <p className="text-slate-300">{p.texto}</p>
        {p.como && <ul className="space-y-2 rounded-xl bg-white/5 p-4 text-left text-sm text-slate-300">{p.como.map((c) => <li key={c}>› {c}</li>)}</ul>}
        <div className="flex justify-center gap-2" aria-label={`Tela ${i + 1} de ${TOUR.length}`}>{TOUR.map((_, k) => <span key={k} className={`h-1.5 rounded-full ${k === i ? "w-8 bg-cyan-300" : "w-3 bg-white/20"}`} />)}</div>
        </div>
        <div className="flex gap-3">
          <button data-foco className="botao" disabled={i === 0} onClick={() => setI(i - 1)}>‹ Voltar</button>
          <button data-foco className="botao primario flex-1" onClick={() => (ultimo ? fim() : setI(i + 1))}>{ultimo ? rotuloFinal : "Próximo ›"}</button>
          {!ultimo && <button data-foco className="botao" onClick={fim}>Pular</button>}
        </div>
      </div>
    </div>
  );
}
