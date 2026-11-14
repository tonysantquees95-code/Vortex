import { useEffect, useState } from "react";
import { LogoVortex } from "./LogoVortex";
import { Vortice } from "../Vortice";

/** Abertura: o app é puxado para dentro de um vórtice 3D e o nome VORTEX surge num clarão. Qualquer toque ou tecla pula. */
export function Abertura({ aoTerminar }: { aoTerminar: () => void }) {
  const [saindo, setSaindo] = useState(false);
  useEffect(() => {
    const sair = () => setSaindo(true);
    const t = window.setTimeout(sair, 3500);
    window.addEventListener("keydown", sair);
    return () => { window.clearTimeout(t); window.removeEventListener("keydown", sair); };
  }, []);
  useEffect(() => {
    if (!saindo) return;
    const t = window.setTimeout(aoTerminar, 500);
    return () => window.clearTimeout(t);
  }, [saindo, aoTerminar]);
  return (
    <div className="abertura" data-saindo={saindo} onPointerDown={() => setSaindo(true)} role="presentation">
      <Vortice modo="abertura" />
      <div className="letreiro" style={{ width: "min(80vw, 640px)" }}><LogoVortex className="parado" /></div>
      <div className="toque">toque para pular</div>
    </div>
  );
}
