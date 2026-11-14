import { useCallback, useEffect, useRef, useState } from "react";
import type { Motor } from "../ponte";
import { PASSOS, apagarPerfil, definirEscutando, detectar, lerId, linksDeDriver, perfilAtivoDe, perfisDe, rotuloDaEntrada, salvarPerfil, usarPerfil, type Entrada, type Mapa } from "../controle";

interface Lido { id: string; mapping: string; botoes: boolean[]; eixos: number[] }
const lerPad = (): Lido | null => {
  const g = (navigator.getGamepads?.() ?? []).find((x) => x && x.connected);
  return g ? { id: g.id, mapping: g.mapping, botoes: g.buttons.map((b) => b.pressed), eixos: Array.from(g.axes) } : null;
};

/** Hook: o controle conectado agora (atualiza ao conectar, desconectar e a cada meio segundo). */
function useControle(): Lido | null {
  const [pad, setPad] = useState<Lido | null>(lerPad);
  useEffect(() => {
    const atualizar = () => setPad((antes) => {
      const novo = lerPad();
      if (!novo) return antes ? null : antes;
      return !antes || antes.id !== novo.id || antes.botoes.join() !== novo.botoes.join() ? novo : antes;
    });
    atualizar();
    const t = window.setInterval(atualizar, 400);
    window.addEventListener("gamepadconnected", atualizar); window.addEventListener("gamepaddisconnected", atualizar);
    return () => { window.clearInterval(t); window.removeEventListener("gamepadconnected", atualizar); window.removeEventListener("gamepaddisconnected", atualizar); };
  }, []);
  return pad;
}

/** Configuração guiada: aperta cada botão pedido e o Vortex aprende onde ele está, mesmo num controle que o sistema não identificou direito. */
function Assistente({ aoTerminar, aoCancelar }: { aoTerminar: (mapa: Mapa) => void; aoCancelar: () => void }) {
  const [passo, setPasso] = useState(0);
  const [mapa, setMapa] = useState<Mapa>({});
  const [aviso, setAviso] = useState("");
  const estado = useRef({ passo: 0, mapa: {} as Mapa, repouso: [] as number[], soltar: true });
  const [semControle, setSemControle] = useState(false);

  useEffect(() => {
    definirEscutando(true);
    let quadro = 0;
    const ler = () => {
      const g = (navigator.getGamepads?.() ?? []).find((x) => x && x.connected);
      setSemControle(!g);
      if (g) {
        const s = estado.current;
        const botoes = g.buttons.map((b) => b.pressed), eixos = Array.from(g.axes);
        if (!s.repouso.length) s.repouso = eixos.slice();
        const e = detectar(s.repouso, botoes, eixos);
        if (s.soltar) { if (!e) s.soltar = false; }
        else if (e && s.passo < PASSOS.length) {
          const usado = Object.entries(s.mapa).find(([, v]) => JSON.stringify(v) === JSON.stringify(e));
          if (usado) { setAviso(`Esse botão já foi usado em “${usado[0]}”. Aperte outro.`); s.soltar = true; }
          else {
            setAviso("");
            s.mapa = { ...s.mapa, [PASSOS[s.passo].id]: e };
            s.passo += 1; s.soltar = true;
            setMapa(s.mapa); setPasso(s.passo);
          }
        }
      }
      quadro = requestAnimationFrame(ler);
    };
    quadro = requestAnimationFrame(ler);
    return () => { cancelAnimationFrame(quadro); definirEscutando(false); };
  }, []);

  const pular = () => { const s = estado.current; if (s.passo >= PASSOS.length) return; s.passo += 1; s.soltar = true; setPasso(s.passo); setAviso(""); };
  const fim = passo >= PASSOS.length;
  return (
    <div className="space-y-4 rounded-2xl border border-cyan-300/40 bg-[#0b1226cc] p-5">
      <h3 className="text-xl font-bold">Configurar botões</h3>
      {semControle && <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">O controle desconectou. Conecte de novo e aperte um botão.</p>}
      {!fim ? (
        <>
          <p className="text-slate-300">Passo {passo + 1} de {PASSOS.length}. Solte tudo e aperte no controle:</p>
          <div className="titulo-neon text-center text-3xl font-black">{PASSOS[passo].nome}</div>
          {aviso && <p className="text-center text-sm text-amber-300">{aviso}</p>}
          <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-300 transition-all" style={{ width: `${(passo / PASSOS.length) * 100}%` }} /></div>
          <div className="flex flex-wrap gap-2">
            <button data-foco className="botao" onClick={pular}>Pular este botão</button>
            <button data-foco className="botao" onClick={aoCancelar}>Cancelar</button>
            <button data-foco className="botao" disabled={passo === 0} onClick={() => aoTerminar(mapa)}>Terminar agora</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-slate-300">Pronto! Confira o que ficou:</p>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">{PASSOS.map((p) => <li key={p.id} className="flex justify-between rounded-lg bg-white/5 px-3 py-1"><span>{p.nome}</span><span className="text-slate-400">{rotuloDaEntrada(mapa[p.id])}</span></li>)}</ul>
          <div className="flex gap-2"><button data-foco className="botao primario" onClick={() => aoTerminar(mapa)}>Salvar e usar</button><button data-foco className="botao" onClick={aoCancelar}>Descartar</button></div>
        </>
      )}
    </div>
  );
}

export function MeuControle({ motor, avisar }: { motor: Motor; avisar: (t: string) => void }) {
  const pad = useControle();
  const [assistente, setAssistente] = useState(false);
  const [links, setLinks] = useState(false);
  const [, forcar] = useState(0);
  const recarregar = useCallback(() => forcar((n) => n + 1), []);
  const id = pad ? lerId(pad.id) : null;
  const perfis = id ? perfisDe(id) : [];
  const ativo = id ? perfilAtivoDe(id) : null;
  const windows = motor.plataforma === "windows";

  const abrir = (url: string) => { motor.abrirUrl(url).catch(() => avisar("Não consegui abrir o navegador.")); };
  const terminar = (mapa: Mapa) => {
    if (id) { const p = salvarPerfil(id, mapa); avisar(`${p.nome} salvo e em uso`); }
    setAssistente(false); recarregar();
  };

  if (assistente) return <div className="mx-auto max-w-3xl"><Assistente aoTerminar={terminar} aoCancelar={() => setAssistente(false)} /></div>;

  const apertados = pad ? pad.botoes.flatMap((b, i) => (b ? [`Botão ${i}`] : [])).concat(pad.eixos.flatMap((v, i) => (Math.abs(v) > 0.6 && Math.abs(v) <= 1.05 ? [`Eixo ${i} ${v > 0 ? "+" : "−"}`] : []))) : [];
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {!pad || !id ? (
        <section className="space-y-3 rounded-2xl bg-white/5 p-5">
          <h3 className="text-xl font-bold">Nenhum controle reconhecido</h3>
          <p className="text-slate-300">Conecte o controle (cabo ou Bluetooth) e aperte qualquer botão dele. Se mesmo assim não aparecer, é provável que falte o driver.</p>
          <div className="flex flex-wrap gap-2">
            <button data-foco className="botao primario" onClick={() => { recarregar(); avisar("Procurando… aperte um botão do controle."); }}>Procurar controle</button>
            {windows && <button data-foco className="botao" onClick={() => setLinks((v) => !v)}>Buscar driver</button>}
          </div>
          {windows && links && <ListaDeLinks c={{ nome: "controle de videogame", vid: "", pid: "" }} abrir={abrir} />}
        </section>
      ) : (
        <>
          <section className="space-y-2 rounded-2xl bg-white/5 p-5">
            <h3 className="text-xl font-bold">{id.nome}</h3>
            <dl className="grid gap-1 text-sm text-slate-300 sm:grid-cols-2">
              <div>Código: <b>{id.vid ? `${id.vid}:${id.pid}` : "não informado"}</b></div>
              <div>Reconhecido como padrão: <b>{pad.mapping === "standard" ? "sim" : "não (modo genérico)"}</b></div>
              <div>Botões: <b>{pad.botoes.length}</b> · Eixos: <b>{pad.eixos.length}</b></div>
              <div>Perfil em uso: <b>{ativo ? ativo.nome : "nenhum (padrão do controle)"}</b></div>
            </dl>
            <p className="text-sm text-slate-400">Apertando agora: {apertados.length ? apertados.join(", ") : "nada"}</p>
            {pad.mapping !== "standard" && <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">Esse controle chegou em modo genérico, então os botões podem estar trocados. Use “Configurar botões” para ensinar o Vortex onde cada um fica.</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <button data-foco className="botao primario" onClick={() => setAssistente(true)}>Configurar botões</button>
              {windows && <button data-foco className="botao" onClick={() => setLinks((v) => !v)}>Buscar driver</button>}
            </div>
            {windows && links && <ListaDeLinks c={id} abrir={abrir} />}
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-slate-300">Perfis deste controle</h3>
            {perfis.length === 0 && <p className="text-slate-400">Nenhum perfil ainda. Use “Configurar botões” para criar o primeiro.</p>}
            {perfis.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 p-3">
                <span className="flex-1 font-medium">{p.nome}{ativo?.id === p.id ? " · em uso" : ""}</span>
                {ativo?.id !== p.id && <button data-foco className="botao" onClick={() => { usarPerfil(id, p.id); recarregar(); }}>Usar</button>}
                <button data-foco className="botao" onClick={() => { apagarPerfil(p.id); recarregar(); }}>Apagar</button>
              </div>
            ))}
            {ativo && <button data-foco className="botao" onClick={() => { usarPerfil(id, null); recarregar(); }}>Voltar ao padrão do controle</button>}
          </section>
        </>
      )}
    </div>
  );
}

function ListaDeLinks({ c, abrir }: { c: { nome: string; vid: string; pid: string }; abrir: (u: string) => void }) {
  return (
    <div className="space-y-2 rounded-xl bg-black/20 p-3">
      <p className="text-sm text-slate-300">Escolha onde procurar. O Vortex abre a página no navegador; o driver você baixa e instala por lá.</p>
      {linksDeDriver(c).map((l) => (
        <button key={l.url} data-foco className="block w-full rounded-lg bg-white/5 p-2 text-left" onClick={() => abrir(l.url)}>
          <span className="font-medium">{l.nome}</span><span className="block text-xs text-slate-400">{l.detalhe}</span>
        </button>
      ))}
    </div>
  );
}
