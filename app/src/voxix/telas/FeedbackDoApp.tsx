import { plataforma } from "../conta";
import { SERVIDOR } from "../api";
import { BUILD } from "../atualizacao";


/** Feedback, relato de erro e pesquisa rápida: a página do servidor aberta aqui dentro, com o app, a versão e a plataforma. */
export function FeedbackDoApp({ aoFechar }: { aoFechar: () => void }) {
  const endereco = `${SERVIDOR}/feedback?app=voxix&v=${BUILD > 0 ? `1.${BUILD}` : ""}&p=${plataforma()}`;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-fundo">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 py-3">
        <span className="text-sm font-semibold tracking-wide text-suave">FEEDBACK · Voxix</span>
        <button className="rounded-xl border border-borda px-4 py-2" onClick={aoFechar}>Fechar</button>
      </div>
      <iframe title="Feedback e relato de erro" src={endereco} className="mx-auto min-h-0 w-full max-w-2xl flex-1 border-0 bg-[#070a1c]" />
    </div>
  );
}
