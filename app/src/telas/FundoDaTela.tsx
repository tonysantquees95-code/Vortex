import { Vortice } from "../Vortice";
import type { Tema } from "../tema";

/** Fundo do app: o vórtice 3D girando devagar (se escolhido e com animações ligadas) sobre o degradê. */
export function FundoDaTela({ tema }: { tema: Tema }) {
  return <div className="fundo-tela">{tema.fundo === "vortex" && tema.animacoes && <Vortice modo="fundo" />}</div>;
}
