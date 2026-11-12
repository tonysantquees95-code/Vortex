import { useCallback, useEffect, useMemo, useState } from "react";
import type { Jogo, Motor, Oferta } from "../ponte";
import { focar } from "../foco";
import { Camada, Capa } from "./pecas";

const NOMES: Record<string, string> = { nes: "Nintendo 8 bits", snes: "Super Nintendo", gba: "Game Boy Advance", gb: "Game Boy", gbc: "Game Boy Color", genesis: "Mega Drive", mastersystem: "Master System", gamegear: "Game Gear" };

const comoJogo = (o: Oferta): Jogo => ({
  id: o.id, titulo: o.titulo, plataforma: o.plataforma, caminho: "", bytes: o.bytes, regioes: [], idiomas: [], tags: [], capa: null, capa_online: null,
  descricao: o.descricao, desenvolvedor: o.autor, editora: null, ano: null, genero: null, jogadores: null, adicionado: 0, favorito: false, ultimo_jogo: 0, tempo_total_s: 0, sessoes: 0, disponivel: true,
});

const tamanho = (b: number) => (b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function Loja({ motor, aoInstalar, aoJogar, avisar }: { motor: Motor; aoInstalar: () => void; aoJogar: (jogoId: string) => void; avisar: (t: string) => void }) {
  const [lista, setLista] = useState<Oferta[] | null>(null);
  const [aberta, setAberta] = useState<Oferta | null>(null);
  const [baixando, setBaixando] = useState<Record<string, boolean>>({});
  const [busca, setBusca] = useState("");

  const carregar = useCallback(() => { motor.lojaCatalogo().then(setLista).catch((e) => { avisar(String(e)); setLista([]); }); }, [motor, avisar]);
  useEffect(carregar, [carregar]);

  // o download continua mesmo se a pessoa sair da loja ou fechar o detalhe
  const baixar = async (o: Oferta) => {
    if (baixando[o.id]) return;
    setBaixando((b) => ({ ...b, [o.id]: true }));
    avisar(`Baixando ${o.titulo} em segundo plano…`);
    try {
      await motor.lojaInstalar(o.id);
      avisar(`${o.titulo} instalado e pronto para jogar`);
      carregar();
      aoInstalar();
    } catch (e) { avisar(String(e instanceof Error ? e.message : e)); }
    finally { setBaixando((b) => ({ ...b, [o.id]: false })); }
  };

  const grupos = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const m = new Map<string, Oferta[]>();
    for (const o of lista ?? []) {
      if (t && !o.titulo.toLowerCase().includes(t) && !o.autor.toLowerCase().includes(t)) continue;
      m.set(o.plataforma, [...(m.get(o.plataforma) ?? []), o]);
    }
    return [...m.entries()];
  }, [lista, busca]);

  const atual = aberta ? (lista?.find((x) => x.id === aberta.id) ?? aberta) : null;
  useEffect(() => {
    if (!aberta) return;
    const voltar = () => setAberta(null);
    window.addEventListener("vortex:voltar", voltar);
    const el = document.querySelector<HTMLElement>("[data-camada] [data-foco]");
    if (el) focar(el);
    return () => window.removeEventListener("vortex:voltar", voltar);
  }, [aberta]);

  return (
    <div className="entrar px-10">
      <div className="mb-6">
        <h2 className="titulo-neon text-3xl font-black">Loja</h2>
        <p className="mt-1 text-slate-400">Jogos gratuitos e liberados pelos próprios autores. Toque em Baixar e continue navegando: o Vortex instala sozinho e deixa o Jogar pronto.</p>
      </div>
      <input data-foco value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na loja…" className="vidro mb-6 w-full max-w-md px-4 py-3 outline-none placeholder:text-slate-500 focus:border-cyan-300" />
      {lista === null && <p className="py-10 text-slate-400">Carregando a loja…</p>}
      {lista && !grupos.length && <p className="py-10 text-slate-400">Nada encontrado.</p>}
      {grupos.map(([plat, itens]) => (
        <section key={plat} className="mb-8">
          <h3 className="mb-3 text-lg font-bold text-cyan-100/90">{NOMES[plat] ?? plat.toUpperCase()}</h3>
          <div className="rolagem flex gap-5 py-5 -my-5">
            {itens.map((o) => (
              <button key={o.id} data-foco className="carta" style={{ width: 170 }} onClick={() => setAberta(o)} title={o.titulo}>
                <Capa j={comoJogo(o)} />
                {o.instalado && <span className="estrela">✔</span>}
                {baixando[o.id] && <span className="pulso absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-cyan-200">baixando…</span>}
                <div className="rodape"><div className="text-sm font-bold leading-tight line-clamp-2">{o.titulo}</div><div className="text-[11px] text-cyan-200/70">{o.autor}</div></div>
              </button>
            ))}
          </div>
        </section>
      ))}

      {atual && (
        <Camada aoFechar={() => setAberta(null)}>
          <div className="vidro entrar flex w-[min(820px,94vw)] max-h-[90vh] gap-8 overflow-hidden p-8 max-sm:flex-col">
            <div className="relative aspect-[3/4] w-48 flex-none overflow-hidden rounded-2xl border border-white/10 max-sm:w-32"><Capa j={comoJogo(atual)} /></div>
            <div className="rolagem flex min-w-0 flex-1 flex-col">
              <h2 className="titulo-neon text-3xl font-extrabold leading-tight">{atual.titulo}</h2>
              <p className="mt-1 text-sm text-slate-400">{atual.autor} · {NOMES[atual.plataforma] ?? atual.plataforma}</p>
              <p className="mt-4 text-slate-300">{atual.descricao}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Licença</dt><dd className="font-semibold">{atual.licenca}</dd></div><div><dt className="text-slate-500">Tamanho</dt><dd className="font-semibold">{tamanho(atual.bytes)}</dd></div></dl>
              <div className="mt-auto flex flex-wrap gap-3 pt-6">
                {atual.instalado && atual.jogo_id ? (
                  <button data-foco className="botao primario" onClick={() => { setAberta(null); aoJogar(atual.jogo_id as string); }}>▶ Jogar</button>
                ) : (
                  <button data-foco className="botao primario" disabled={!!baixando[atual.id]} onClick={() => baixar(atual)}>{baixando[atual.id] ? "Baixando…" : "⬇ Baixar"}</button>
                )}
                <button data-foco className="botao" onClick={() => setAberta(null)}>Voltar</button>
              </div>
              {baixando[atual.id] && <p className="pulso mt-3 text-sm text-cyan-200">Pode fechar esta janela: o download continua em segundo plano.</p>}
            </div>
          </div>
        </Camada>
      )}
    </div>
  );
}
