import type { Motor } from "../ponte";

interface Portal { nome: string; url: string; detalhe: string; so?: "windows" }
const PORTAIS: Portal[] = [
  { nome: "Steam", url: "https://store.steampowered.com/", detalhe: "Loja e biblioteca da Steam" },
  { nome: "Epic Games", url: "https://store.epicgames.com/pt-BR/", detalhe: "Loja da Epic Games" },
  { nome: "PlayStation Store", url: "https://store.playstation.com/pt-br/", detalhe: "Entre com a sua conta PlayStation" },
  { nome: "Xbox", url: "https://www.xbox.com/pt-BR/games", detalhe: "Jogos e conta Xbox" },
  { nome: "Microsoft Store", url: "https://apps.microsoft.com/games", detalhe: "Jogos da Microsoft Store", so: "windows" },
  { nome: "Nintendo eShop", url: "https://www.nintendo.com/pt-br/", detalhe: "Site da Nintendo" },
  { nome: "GOG", url: "https://www.gog.com/pt", detalhe: "Jogos sem DRM" },
  { nome: "Google Play Jogos", url: "https://play.google.com/store/games", detalhe: "Jogos para Android" },
];

/** Atalhos para as lojas: abrem no navegador, onde a pessoa entra com a própria conta. O Vortex não vê senha nenhuma. */
export function Portais({ motor, avisar }: { motor: Motor; avisar: (t: string) => void }) {
  const lista = PORTAIS.filter((p) => !p.so || p.so === motor.plataforma);
  return (
    <section className="mb-8">
      <h3 className="mb-3 text-lg font-bold text-cyan-100/90">Lojas e contas de jogos</h3>
      <div className="flex flex-wrap gap-3">
        {lista.map((p) => (
          <button key={p.nome} data-foco className="vidro px-4 py-3 text-left" title={p.detalhe} onClick={() => { motor.abrirUrl(p.url).catch(() => avisar("Não consegui abrir o navegador.")); }}>
            <div className="font-semibold">{p.nome} ↗</div>
            <div className="text-xs text-slate-400">{p.detalhe}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
