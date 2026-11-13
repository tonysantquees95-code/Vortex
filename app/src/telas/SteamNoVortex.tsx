import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Motor } from "../ponte";

interface JogoSteam { appid: number; nome: string; minutos: number }
const capa = (id: number) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`;
const horas = (m: number) => (m >= 60 ? `${Math.round(m / 60)} h jogadas` : m > 0 ? `${m} min jogados` : "nunca jogado");

/** Biblioteca da Steam por dentro do Vortex: entra com a Steam no navegador, lista os jogos e abre/instala pelo app da Steam (Windows). */
export function SteamNoVortex({ motor, avisar }: { motor: Motor; avisar: (t: string) => void }) {
  const conta = motor.conta;
  const [ligada, setLigada] = useState<boolean | null>(null);
  const [jogos, setJogos] = useState<JogoSteam[] | null>(null);
  const [aguardando, setAguardando] = useState(false);
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState(false);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  const erro = useCallback((e: unknown) => avisar(String(e instanceof Error ? e.message : e)), [avisar]);
  const carregar = useCallback(async () => {
    if (!conta) return;
    try { const j = await conta.pedir<{ jogos: JogoSteam[] }>("GET", "/vortex/steam/jogos"); if (vivo.current) setJogos(j.jogos); } catch (e) { if (vivo.current) { setJogos([]); erro(e); } }
  }, [conta, erro]);
  useEffect(() => {
    if (!conta) return;
    conta.estado().then((e) => (e.logado && e.vortex ? conta.pedir<{ ligado: boolean }>("GET", "/vortex/steam") : { ligado: false })).then((s) => { if (vivo.current) setLigada(s.ligado); }).catch(() => setLigada(false));
  }, [conta]);
  useEffect(() => { if (ligada && aberta && jogos === null) void carregar(); }, [ligada, aberta, jogos, carregar]);

  const entrar = async () => {
    if (!conta) return;
    try {
      const { url } = await conta.pedir<{ url: string }>("POST", "/vortex/steam/iniciar");
      await motor.abrirUrl(url);
      setAguardando(true);
      avisar("Entre na Steam no navegador e volte para o Vortex.");
      for (let i = 0; i < 60 && vivo.current; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const s = await conta.pedir<{ ligado: boolean }>("GET", "/vortex/steam").catch(() => ({ ligado: false }));
        if (s.ligado) { setLigada(true); setAberta(true); setJogos(null); avisar("Steam ligada."); break; }
      }
    } catch (e) { erro(e); } finally { setAguardando(false); }
  };
  const sair = async () => { try { await conta?.pedir("DELETE", "/vortex/steam"); setLigada(false); setJogos(null); } catch (e) { erro(e); } };

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (jogos ?? []).filter((j) => !t || j.nome.toLowerCase().includes(t));
  }, [jogos, busca]);

  if (!conta || ligada === null) return null;
  return (
    <section className="vidro mb-8 p-5" aria-label="Biblioteca Steam">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button data-foco className="text-left" onClick={() => ligada && setAberta(!aberta)}>
          <span className="text-lg font-black">Minha biblioteca Steam{jogos ? <span className="ml-2 text-base font-semibold text-slate-400">{jogos.length}</span> : null}</span>
          {!ligada && <div className="text-sm text-slate-300">Entre com a Steam (no navegador, o Vortex nunca vê a sua senha) para ver e abrir seus jogos aqui.</div>}
        </button>
        <div className="flex gap-2">
          {!ligada ? <button data-foco className="botao primario" disabled={aguardando} onClick={entrar}>{aguardando ? "Aguardando a Steam…" : "Entrar com a Steam"}</button> : (
            <>
              <button data-foco className="botao" onClick={() => setAberta(!aberta)}>{aberta ? "Fechar" : "Ver jogos"}</button>
              <button data-foco className="botao" onClick={sair}>Desligar</button>
            </>
          )}
        </div>
      </div>
      {ligada && aberta && (
        <div className="mt-4">
          {jogos === null && <p className="text-slate-400">Carregando seus jogos…</p>}
          {jogos && !jogos.length && <p className="text-sm text-slate-300">Nenhum jogo apareceu. No perfil da Steam, deixe “Detalhes dos jogos” como Público e tente de novo.</p>}
          {jogos && jogos.length > 0 && (
            <>
              <input data-foco value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na Steam…" className="vidro mb-4 w-full max-w-md px-4 py-3 outline-none placeholder:text-slate-500 focus:border-cyan-300" />
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                {filtrados.slice(0, 120).map((j) => (
                  <div key={j.appid} className="carta" style={{ aspectRatio: "3 / 4" }}>
                    <div className="arte">{j.nome.slice(0, 2).toUpperCase()}</div>
                    <img src={capa(j.appid)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    <div className="rodape">
                      <div className="truncate text-sm font-semibold" title={j.nome}>{j.nome}</div>
                      <div className="text-[11px] text-slate-300">{horas(j.minutos)}</div>
                      {motor.abrirSteam && (
                        <div className="mt-1 flex gap-1">
                          <button data-foco className="botao primario !px-2 !py-1 text-xs" onClick={() => { motor.abrirSteam!(j.appid, "jogar").catch(erro); }}>Jogar</button>
                          <button data-foco className="botao !px-2 !py-1 text-xs" onClick={() => { motor.abrirSteam!(j.appid, "instalar").catch(erro); }}>Instalar</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {filtrados.length > 120 && <p className="mt-3 text-xs text-slate-400">Mostrando 120 de {filtrados.length}. Use a busca para achar os outros.</p>}
              {!motor.abrirSteam && <p className="mt-3 text-xs text-slate-400">No celular a lista é só para consultar: os jogos da Steam abrem no computador.</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
