import { useEffect, useState } from "react";

/** Abertura: a tela é puxada para dentro de um vórtex de anéis e o nome VORTEX surge no fim. Qualquer toque ou tecla pula. */
export function Abertura({ aoTerminar }: { aoTerminar: () => void }) {
  const [saindo, setSaindo] = useState(false);
  useEffect(() => {
    const sair = () => setSaindo(true);
    const t = window.setTimeout(sair, 3300);
    window.addEventListener("keydown", sair);
    return () => { window.clearTimeout(t); window.removeEventListener("keydown", sair); };
  }, []);
  useEffect(() => {
    if (!saindo) return;
    const t = window.setTimeout(aoTerminar, 600);
    return () => window.clearTimeout(t);
  }, [saindo, aoTerminar]);
  return (
    <div className="abertura" data-saindo={saindo} onPointerDown={() => setSaindo(true)} role="presentation">
      <div className="redemoinho" />
      <div className="tunel">
        {Array.from({ length: 9 }, (_, i) => <div key={i} className="anel" style={{ animationDelay: `${(i * 2.4) / 9}s` }} />)}
      </div>
      <div className="letreiro">VORTEX</div>
      <div className="toque">toque para pular</div>
    </div>
  );
}
