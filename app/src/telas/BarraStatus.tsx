import { useEffect, useState } from "react";

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

/** Faixa do topo, ao lado do nome: hora, bateria, controle conectado e internet. */
export function BarraStatus({ hora, controle, demo }: { hora: Date; controle: boolean; demo: boolean }) {
  const { bateria, online } = useStatusDoAparelho();
  return (
    <div className="status-topo">
      <span className="font-semibold tabular-nums text-white">{hora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
      {bateria && (
        <span className={`item ${bateria.nivel <= 15 && !bateria.carregando ? "baixa" : ""}`} title={`Bateria ${bateria.nivel}%${bateria.carregando ? " (carregando)" : ""}`}>
          <span className="bateria"><i style={{ width: `${Math.max(8, bateria.nivel)}%`, right: "auto" }} /></span>{bateria.nivel}%{bateria.carregando ? "⚡" : ""}
        </span>
      )}
      <span className={`item ${controle ? "text-cyan-300" : "apagado"}`} title={controle ? "Controle conectado" : "Nenhum controle conectado"}>🎮<span className="max-sm:hidden">{controle ? "Controle" : "Sem controle"}</span></span>
      <span className={`item ${online ? "" : "apagado"}`} title={online ? "Com internet" : "Sem internet"}>{online ? "📶" : "✕"}<span className="max-md:hidden">{online ? "Online" : "Offline"}</span></span>
      {demo && <span className="chip max-lg:hidden">demonstração</span>}
    </div>
  );
}
