import { useState } from "react";
import type { Motor } from "../ponte";
import type { Tema } from "../tema";
import { ContaVetorial, TelaAparencia, TelaJogos } from "./Ajustes";
import { Permissoes } from "./Permissoes";

type Passo = { id: string; titulo: string; texto: string };

/** Configuração inicial, uma tela por vez: permissões → busca de jogos → aparência → conta → pronto. */
export function Configuracao({ motor, tema, aoMudarTema, avisar, aoMudarBiblioteca, aoTerminar }: { motor: Motor; tema: Tema; aoMudarTema: (t: Tema) => void; avisar: (t: string) => void; aoMudarBiblioteca: () => void; aoTerminar: () => void }) {
  const passos: Passo[] = [
    { id: "permissoes", titulo: "Permissões", texto: "Para funcionar direito o Vortex precisa de algumas liberações do aparelho. Toque em Liberar, ative na tela que abrir e volte." },
    { id: "jogos", titulo: "Buscar seus jogos", texto: "O Vortex procura as ROMs que você já tem e organiza por console. Se elas estiverem em outra pasta, adicione-a." },
    { id: "aparencia", titulo: "Deixe com a sua cara", texto: "Escolha a cor e o estilo. Dá para mudar depois em Ajustes › Personalização." },
    ...(motor.conta ? [{ id: "conta", titulo: "Conta Vetorial ID", texto: "Opcional agora: entre para liberar o Vortex e guardar os saves na nuvem." }] : []),
    { id: "pronto", titulo: "Tudo pronto", texto: "Seu Vortex está configurado. Boa jogatina!" },
  ];
  const [i, setI] = useState(0);
    const p = passos[i];
  const ultimo = i === passos.length - 1;
  return (
    <div data-camada className="fixed inset-0 z-[150] flex flex-col bg-[#04040a]">
      <div className="fundo-tela"><div className="espiral" /><div className="espiral b" /></div>
      <div className="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-5 px-6 py-8">
        <div className="text-center"><span className="marca"><span className="nome text-2xl">VORTEX</span></span></div>
        <div className="flex items-center justify-center gap-2" aria-label={`Passo ${i + 1} de ${passos.length}`}>
          {passos.map((x, k) => <span key={x.id} className="h-1.5 w-10 rounded-full" style={{ background: k <= i ? "var(--neon)" : "rgba(255,255,255,.15)", boxShadow: k === i ? "0 0 12px var(--neon)" : "none" }} />)}
        </div>
        <div>
          <h2 className="text-3xl font-black">{p.titulo}</h2>
          <p className="mt-1 text-slate-300">{p.texto}</p>
        </div>
        <div className="rolagem min-h-0 flex-1 pr-1">
          {p.id === "permissoes" && <Permissoes motor={motor} avisar={avisar} />}
          {p.id === "jogos" && <TelaJogos motor={motor} avisar={avisar} aoMudarBiblioteca={aoMudarBiblioteca} />}
          {p.id === "aparencia" && <TelaAparencia tema={tema} aoMudar={aoMudarTema} />}
          {p.id === "conta" && motor.conta && <ContaVetorial motor={motor} avisar={avisar} />}
          {p.id === "pronto" && <div className="vidro p-6 text-center text-lg">Os jogos que o Vortex achou já estão na sua biblioteca. A loja tem jogos gratuitos e liberados pelos autores.</div>}
        </div>
        <div className="flex items-center justify-between gap-3">
          <button data-foco className="botao" disabled={i === 0} onClick={() => setI(i - 1)}>‹ Voltar</button>
          <div className="flex gap-3">
            {!ultimo && p.id === "conta" && <button data-foco className="botao" onClick={() => setI(i + 1)}>Pular</button>}
            <button data-foco className="botao primario" onClick={() => (ultimo ? aoTerminar() : setI(i + 1))}>{ultimo ? "Começar" : "Continuar ›"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
