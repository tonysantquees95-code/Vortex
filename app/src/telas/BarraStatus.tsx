import { useEffect, useState } from "react";
import { Icone } from "./Icones";

interface Bateria { level: number; charging: boolean; addEventListener(t: string, f: () => void): void; removeEventListener(t: string, f: () => void): void }

/** Bateria do aparelho (quando o sistema deixa ler) e se há internet. */
export function useStatusDoAparelho() {
  const [bat, setBat] = useState<{ nivel: number; carregando: boolean } | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const a = () => setOnline(true), b = () => setOnline(false);
    window.addEventListener("online", a); window.addEventListener("offline", b);
    let b0: Bateria | null = null;
    let vivo = true;
    const ler = () => { if (b0 && vivo) setBat({ nivel: Math.round(b0.level * 100), carregando: b0.charging }); };
    (navigator as Navigator & { getBattery?: () => Promise<Bateria> }).getBattery?.().then((x) => {
      b0 = x; ler();
      x.addEventListener("levelchange", ler); x.addEventListener("chargingchange", ler);
    }).catch(() => {});
    return () => {
      vivo = false; window.removeEventListener("online", a); window.removeEventListener("offline", b);
      if (b0) { b0.removeEventListener("levelchange", ler); b0.removeEventListener("chargingchange", ler); }
    };
  }, []);
  return { bateria: bat, online };
}

/** Cantos do topo: à esquerda hora e bateria; à direita controle e internet. Tudo desenhado com os mesmos ícones (e a mesma espessura) do resto do Vortex. */
export function BarraStatus({ lado, hora, controle, demo }: { lado: "esquerda" | "direita"; hora: Date; controle: boolean; demo: boolean }) {
  const { bateria, online } = useStatusDoAparelho();
  if (lado === "esquerda") {
    return (
      <div className="status-topo">
        <span className="font-semibold tabular-nums text-white">{hora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
        {bateria && (
          <span className={`item ${bateria.nivel <= 15 && !bateria.carregando ? "baixa" : ""}`} title={`Bateria ${bateria.nivel}%${bateria.carregando ? " (carregando)" : ""}`}>
            <svg viewBox="0 0 24 24" className="ico size-6" aria-hidden fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="7" width="17" height="10" rx="2.5" /><path d="M21.5 10.5v3" />
              <rect x="4.6" y="9.1" width={Math.max(1.5, (12.8 * bateria.nivel) / 100)} height="5.8" rx="1" fill="currentColor" stroke="none" />
            </svg>
            {bateria.nivel}%{bateria.carregando ? <Icone nome="modo" className="ico size-4" /> : null}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="status-topo justify-end">
      {demo && <span className="chip max-lg:hidden">demonstração</span>}
      <span className={`item ${controle ? "text-cyan-300" : "apagado"}`} title={controle ? "Controle conectado" : "Nenhum controle conectado"}><Icone nome="controles" className="size-6" /><span className="max-sm:hidden">{controle ? "Controle" : "Sem controle"}</span></span>
      <span className={`item ${online ? "" : "apagado"}`} title={online ? "Com internet" : "Sem internet"}><Icone nome={online ? "wifi" : "semrede"} className="size-6" /><span className="max-md:hidden">{online ? "Online" : "Offline"}</span></span>
    </div>
  );
}
