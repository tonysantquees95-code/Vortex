import { SERVIDOR_VENUS } from "../atualizacao";
import { BUILD } from "../atualizacao";


/** Feedback, relato de erro e pesquisa rápida: a página do servidor aberta aqui dentro, com o app, a versão e a plataforma. */
export function FeedbackDoApp({ aoFechar }: { aoFechar: () => void }) {
  const plataforma = navigator.userAgent.includes("Android") ? "android" : "windows";
  const endereco = `${SERVIDOR_VENUS}/feedback?app=vortex&v=${BUILD > 0 ? `1.${BUILD}` : ""}&p=${plataforma}`;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#070a1c]">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 py-3">
        <span className="text-sm font-semibold tracking-wide text-slate-400">FEEDBACK · Vortex</span>
        <button data-foco className="botao" onClick={aoFechar}>Fechar</button>
      </div>
      <iframe title="Feedback e relato de erro" src={endereco} className="mx-auto min-h-0 w-full max-w-2xl flex-1 border-0 bg-[#070a1c]" />
    </div>
  );
}
