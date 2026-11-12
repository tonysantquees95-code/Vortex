import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMotor } from "./estado";
import { focar, primeiroSemCampo, useNavegacao } from "./foco";
import type { Estatisticas, Jogo, ResumoPlataforma } from "./ponte";
import { configurado, marcarConfigurado, organizarAutomatico } from "./config";
import { aplicarTema, guardarTema, lerTema, type Tema } from "./tema";
import { Abertura } from "./telas/Abertura";
import { FundoDaTela } from "./telas/FundoDaTela";
import { Configuracao } from "./telas/Configuracao";
import { tempoJogado } from "./navegacao";
import { Ajustes } from "./telas/Ajustes";
import { Loja } from "./telas/Loja";
import { Controles } from "./telas/Controles";
import { Termos } from "./telas/Termos";
import { aceitarTermos, termosAceitos } from "./termos";
import { Detalhe } from "./telas/Detalhe";
import { useAtualizacao } from "./useAtualizacao";
import { Biblioteca } from "./telas/Biblioteca";
import { Dock } from "./telas/Dock";
import { Colecao, colecoesDe, Inicio } from "./telas/Inicio";
import { capaConhecida, resolverCapa } from "./capas";
import { faxinaAutomatica, resumoDaFaxina } from "./faxina";

type Aba = "inicio" | "biblioteca" | "loja" | "controles" | "favoritos" | "ajustes";
const ABAS: [Aba, string, string][] = [["inicio", "Início", "inicio"], ["biblioteca", "Biblioteca", "biblioteca"], ["loja", "Loja", "loja"], ["controles", "Controles", "controles"], ["favoritos", "Favoritos", "favoritos"], ["ajustes", "Ajustes", "ajustes"]];

export function App() {
  const motor = useMotor();
  useNavegacao();
  const [aba, setAba] = useState<Aba>("inicio");
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [continuar, setContinuar] = useState<Jogo[]>([]);
  const [plats, setPlats] = useState<ResumoPlataforma[]>([]);
  const [stats, setStats] = useState<Estatisticas | null>(null);
  const [pasta, setPasta] = useState(true);
  const [aberto, setAberto] = useState<Jogo | null>(null);
  const [lancando, setLancando] = useState<Jogo | null>(null);
  const [etapa, setEtapa] = useState("Preparando o jogo…");
  const [aviso, setAviso] = useState("");
  const [controle, setControle] = useState(false);
  const [colecaoAberta, setColecaoAberta] = useState<string | null>(null);
  const [ultimaColecao, setUltimaColecao] = useState<string | null>(null);
  const [focada, setFocada] = useState<Colecao | null>(null);
  const [fundoImg, setFundoImg] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [hora, setHora] = useState(() => new Date());
  const [tema, setTema] = useState<Tema>(lerTema);
  const [abertura, setAbertura] = useState(() => lerTema().abertura && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const [config, setConfig] = useState(configurado);
  useEffect(() => { aplicarTema(tema); guardarTema(tema); }, [tema]);
  useEffect(() => { const f = () => setAbertura(true); window.addEventListener("vortex:abertura", f); return () => window.removeEventListener("vortex:abertura", f); }, []);
  const temporizador = useRef<number | undefined>(undefined);

  const avisar = useCallback((t: string) => {
    setAviso(t);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setAviso(""), 4200);
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const [l, c, p, s, ps] = await Promise.all([motor.listar({ ordem: "titulo" }), motor.continuar(12), motor.plataformas(), motor.estatisticas(), motor.pastas()]);
      setJogos(l); setContinuar(c); setPlats(p); setStats(s); setPasta(ps.length > 0);
    } catch (e) { avisar(String(e)); } finally { setCarregado(true); }
  }, [motor, avisar]);

  useEffect(() => {
    motor.recuperarModoJogo().catch(() => {});
    recarregar();
    // organização automática: acha jogos soltos, guarda por console na pasta do Vortex e mostra tudo na biblioteca
    if (organizarAutomatico()) {
      // sem a permissão de arquivos a busca não acharia nada (e abriria a tela do sistema toda vez): a configuração e os Ajustes pedem
      motor.permissoes().then((l) => (l.some((p) => p.id === "arquivos" && !p.concedida) ? null : motor.organizar())).then(async (r) => {
        if (!r) return;
        if (r.organizados.length) avisar(`${r.organizados.length} jogos organizados por console`);
        // um jogo só por título e nada de arquivo quebrado
        const f = await faxinaAutomatica(motor);
        if (f) avisar(`Faxina: ${resumoDaFaxina(f)}`);
        if (r.organizados.length || f) recarregar();
      }).catch(() => {});
    }
  }, [motor, recarregar, avisar]);
  useEffect(() => { const t = window.setInterval(() => setHora(new Date()), 20000); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    const c = (e: Event) => setControle(Boolean((e as CustomEvent).detail));
    const a = (e: Event) => {
      if (aberto || lancando) return;
      const d = Number((e as CustomEvent).detail);
      setAba((x) => ABAS[(ABAS.findIndex(([id]) => id === x) + d + ABAS.length) % ABAS.length][0]);
    };
    window.addEventListener("vortex:controle", c);
    window.addEventListener("vortex:aba", a);
    return () => { window.removeEventListener("vortex:controle", c); window.removeEventListener("vortex:aba", a); };
  }, [aberto, lancando]);
  // ao trocar de aba, o foco vai para o primeiro item da tela
  useEffect(() => {
    if (aba === "inicio") return; // o Início cuida do próprio foco (volta para o console em que estava)
    const t = window.setTimeout(() => { const el = primeiroSemCampo(Array.from(document.querySelectorAll<HTMLElement>("main [data-foco]"))); if (el && !aberto) focar(el); }, 120);
    return () => window.clearTimeout(t);
  }, [aba, carregado]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (aba !== "ajustes") document.documentElement.dataset.secao = aba; }, [aba]);
  // B fecha o console aberto e volta para a cascata
  useEffect(() => {
    if (!colecaoAberta || aberto || lancando) return;
    const voltar = () => setColecaoAberta(null);
    window.addEventListener("vortex:voltar", voltar);
    return () => window.removeEventListener("vortex:voltar", voltar);
  }, [colecaoAberta, aberto, lancando]);
  // o fundo acompanha a capa do console em foco (usa a primeira capa que existir entre os primeiros jogos dele)
  useEffect(() => {
    if (!focada || tema.fundo !== "console") return;
    let vivo = true;
    const candidatos = focada.jogos.slice(0, 6);
    const pronta = candidatos.map((j) => capaConhecida(j.id)).find(Boolean);
    if (pronta) { setFundoImg(pronta); return; }
    const atraso = window.setTimeout(async () => {
      for (const j of candidatos) { const u = await resolverCapa(j); if (!vivo) return; if (u) { setFundoImg(u); return; } }
      if (vivo) setFundoImg(null);
    }, 250);
    return () => { vivo = false; window.clearTimeout(atraso); };
  }, [focada, tema.fundo]);

  const favoritar = useCallback(async (j: Jogo) => {
    const novo = !j.favorito;
    try {
      await motor.favoritar(j.id, novo);
      setJogos((l) => l.map((x) => (x.id === j.id ? { ...x, favorito: novo } : x)));
      setContinuar((l) => l.map((x) => (x.id === j.id ? { ...x, favorito: novo } : x)));
      setAberto((a) => (a && a.id === j.id ? { ...a, favorito: novo } : a));
    } catch (e) { avisar(String(e)); }
  }, [motor, avisar]);

  const [aceitou, setAceitou] = useState(termosAceitos);
  const atualizacao = useAtualizacao(motor, lancando !== null, avisar, aceitou);
  const [lendoTermos, setLendoTermos] = useState(false);
  useEffect(() => { const f = () => setLendoTermos(true); window.addEventListener("vortex:termos", f); return () => window.removeEventListener("vortex:termos", f); }, []);

  // ponte de voz: a Vênus pede ("abra o jogo X", "otimize o Vortex") e este aparelho executa
  const jogosRef = useRef<Jogo[]>([]);
  const jogarRef = useRef<(j: Jogo) => Promise<void>>(async () => {});
  const recarregarRef = useRef<() => void>(() => {});
  useEffect(() => { jogosRef.current = jogos; }, [jogos]);
  useEffect(() => {
    const conta = motor.conta;
    if (!conta || !aceitou) return;
    let ocupado = false;
    const sem = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    const achar = (pedido: string) => {
      const q = sem(pedido);
      const palavras = q.split(" ").filter(Boolean);
      const pontos = (j: Jogo) => { const t = sem(j.titulo); return t === q ? 3 : t.includes(q) ? 2 : palavras.length && palavras.every((p) => t.includes(p)) ? 1 : 0; };
      return [...jogosRef.current].map((j) => ({ j, p: pontos(j) })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p || a.j.titulo.length - b.j.titulo.length)[0]?.j;
    };
    const executar = async (p: { id: string; comando: string; argumento: string }) => {
      try {
        if (p.comando === "abrir_jogo") {
          const j = achar(p.argumento);
          if (!j) { await conta.responder(p.id, false, `Não achei "${p.argumento}" na biblioteca do Vortex.`); return; }
          await conta.responder(p.id, true, `Abrindo ${j.titulo}.`);
          void jogarRef.current(j);
        } else if (p.comando === "otimizar") {
          const cfg = await motor.modoJogo();
          await motor.modoJogo({ ...cfg, ligado: true });
          const r = await motor.escanear();
          await conta.responder(p.id, true, `Modo Jogo ligado e biblioteca conferida (${r.encontrados} jogos${r.novos ? `, ${r.novos} novos` : ""}).`);
          recarregarRef.current();
        } else await conta.responder(p.id, false, "Esse pedido eu não sei fazer ainda.");
      } catch (e) { await conta.responder(p.id, false, String(e instanceof Error ? e.message : e)).catch(() => {}); }
    };
    const volta = async () => {
      if (ocupado) return;
      ocupado = true;
      try { for (const p of await conta.fila()) await executar(p); } catch { /* sem conta, sem licença ou sem internet */ } finally { ocupado = false; }
    };
    const id = window.setInterval(volta, 5000);
    return () => window.clearInterval(id);
  }, [motor, aceitou]);

  // saves na nuvem: confere ao abrir e sempre que a janela volta ao foco (por exemplo, ao fechar um jogo)
  useEffect(() => {
    const conta = motor.conta;
    if (!conta || !aceitou) return;
    let ultimo = 0;
    const sinc = async () => {
      if (Date.now() - ultimo < 60_000) return;
      ultimo = Date.now();
      try { const e = await conta.estado(); if (e.logado && e.vortex && !e.offline) await conta.sincronizar(); } catch { /* sem conta ou sem internet: tudo segue local */ }
    };
    void sinc();
    window.addEventListener("focus", sinc);
    return () => window.removeEventListener("focus", sinc);
  }, [motor, aceitou]);

  const jogar = useCallback(async (j: Jogo) => {
    setAberto(null); setLancando(j); setEtapa("Preparando o jogo…");
    const minimo = new Promise((r) => setTimeout(r, 1600));
    try {
      // primeira vez de cada console: o Vortex baixa o motor sozinho (sem a pessoa instalar nada)
      const dica = window.setTimeout(() => setEtapa("Preparando o motor deste console (só na primeira vez)…"), 1500);
      await motor.preparar(j.id).finally(() => window.clearTimeout(dica));
      if (motor.conta) { setEtapa("Conferindo os saves na nuvem…"); await Promise.race([motor.conta.sincronizar().catch(() => null), new Promise((r) => setTimeout(r, 6000))]); }
      setEtapa("Abrindo o jogo…");
      const [r] = await Promise.all([motor.lancar(j.id), minimo]);
      avisar(`${j.titulo} aberto no ${r.emulador}${r.modo_jogo ? " · Modo Jogo ligado" : ""}`);
      window.setTimeout(recarregar, 1500);
    } catch (e) { avisar(String(e)); } finally { setLancando(null); }
  }, [motor, avisar, recarregar]);
  useEffect(() => { jogarRef.current = jogar; recarregarRef.current = () => { void recarregar(); }; }, [jogar, recarregar]);

  const favoritos = useMemo(() => jogos.filter((j) => j.favorito), [jogos]);
  const colecoes = useMemo(() => colecoesDe(jogos, plats), [jogos, plats]);
  const abertaCol = colecaoAberta ? colecoes.find((c) => c.id === colecaoAberta) ?? null : null;

  const vazio = carregado && !jogos.length;
  const intro = abertura ? <Abertura aoTerminar={() => setAbertura(false)} /> : null;
  if (!aceitou) return <>{intro}<FundoDaTela tema={abertura ? { ...tema, fundo: "liso" } : tema} imagem={fundoImg} /><Termos aoAceitar={() => { aceitarTermos(); setAceitou(true); }} /></>;
  return (
    <>
      {intro}
      <FundoDaTela tema={abertura ? { ...tema, fundo: "liso" } : tema} imagem={fundoImg} />
      <div className="relative flex h-full flex-col">
        <header className="grid gap-2 px-6 pb-1 pt-3 sm:px-10">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <span title={controle ? "Controle conectado" : "Nenhum controle"} className={controle ? "text-cyan-300" : "text-slate-600"}>🎮</span>
              <span className="font-semibold tabular-nums">{hora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              {motor.plataforma === "demo" && <span className="chip max-sm:hidden">demonstração</span>}
            </div>
            <div className="text-center"><span className="marca"><span className="nome text-2xl sm:text-4xl">VORTEX</span></span></div>
            <div className="flex justify-end text-sm text-slate-300">{stats && <span className="max-sm:hidden">{stats.jogos} jogos · {tempoJogado(stats.tempo_total_s)}</span>}</div>
          </div>
        </header>

        <main className="rolagem min-h-0 flex-1 pb-10">
          {vazio && aba !== "ajustes" && aba !== "loja" && aba !== "controles" ? (
            <div className="entrar mx-auto mt-20 max-w-xl text-center">
              <div className="titulo-neon text-4xl font-black">Sua biblioteca está vazia</div>
              <p className="mt-3 text-slate-300">{pasta ? "Não achei jogos nas pastas escolhidas. Confira as pastas ou procure de novo." : "Escolha a pasta onde ficam seus jogos e o Vortex organiza tudo sozinho."}</p>
              <button data-foco className="botao primario mt-8" onClick={() => setAba("ajustes")}>Ir para os Ajustes</button>
            </div>
          ) : aba === "inicio" ? (
            abertaCol ? (
              <Biblioteca key={abertaCol.id} jogos={abertaCol.jogos} plats={plats} aoAbrir={setAberto} titulo={abertaCol.nome} consoleFixo={abertaCol.tipo === "console" ? abertaCol.id : null} aoVoltar={() => setColecaoAberta(null)} vazio="Nenhum jogo aqui." />
            ) : (
              <Inicio colecoes={colecoes} inicial={ultimaColecao} aoFocar={setFocada} aoAbrir={(c) => { setUltimaColecao(c.id); setColecaoAberta(c.id); }} jogoParaContinuar={continuar[0] ?? null} aoContinuar={jogar} />
            )
          ) : aba === "loja" ? (
            <Loja motor={motor} aoInstalar={recarregar} avisar={avisar} aoJogar={(id) => { const j = jogos.find((x) => x.id === id); if (j) jogar(j); else avisar("O jogo ainda está aparecendo na biblioteca. Tente de novo em instantes."); }} />
          ) : aba === "controles" && motor.controles ? (
            <Controles controles={motor.controles} avisar={avisar} />
          ) : aba === "ajustes" ? (
            <Ajustes motor={motor} aoMudarBiblioteca={recarregar} avisar={avisar} atualizacao={atualizacao} tema={tema} aoMudarTema={setTema} jogos={jogos} />
          ) : aba === "biblioteca" ? (
            <Biblioteca jogos={jogos} plats={plats} aoAbrir={setAberto} vazio="Nenhum jogo encontrado." />
          ) : (
            <Biblioteca key="fav" jogos={favoritos} plats={plats} aoAbrir={setAberto} titulo="Favoritos" vazio="Nenhum favorito ainda. Abra um jogo e aperte Y (ou F) para favoritar." />
          )}
        </main>

        <footer className="rodape-dock">
          <Dock rotulo="Seções" itens={ABAS.filter(([id]) => id !== "controles" || motor.controles).map(([id, nome, icone]) => ({ id, nome, icone }))} ativo={aba} aoEscolher={(id) => setAba(id as Aba)} />
          <div className="dicas max-md:hidden" aria-hidden><span><b>A</b> Abrir</span><span><b>B</b> Voltar</span><span><b>LB</b>/<b>RB</b> Abas</span></div>
        </footer>
      </div>

      {aberto && <Detalhe jogo={aberto} aoJogar={jogar} aoFavoritar={favoritar} aoFechar={() => setAberto(null)} />}
      {lendoTermos && <Termos aoFechar={() => setLendoTermos(false)} />}
      {!config && !abertura && <Configuracao motor={motor} tema={tema} aoMudarTema={setTema} avisar={avisar} aoMudarBiblioteca={recarregar} aoTerminar={() => { marcarConfigurado(); setConfig(true); recarregar(); }} />}
      {lancando && (
        <div data-camada className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#05060df2] backdrop-blur-xl">
          <div className="relative h-24 w-24">
            <div className="orbita absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-300 border-r-violet-400" />
            <div className="pulso absolute inset-4 rounded-full bg-gradient-to-br from-violet-500 to-cyan-300 blur-sm" />
          </div>
          <div className="text-center"><div className="titulo-neon text-3xl font-black">{lancando.titulo}</div><div className="pulso mt-2 text-slate-300">{etapa}</div></div>
        </div>
      )}
      {atualizacao.nova && !lancando && (
        <div className="entrar fixed right-6 top-6 z-[60] flex items-center gap-4 rounded-2xl border border-cyan-300/40 bg-[#0b1226ee] px-5 py-3 text-sm shadow-[0_0_30px_rgba(25,227,255,.3)]" role="status">
          <span>Tem versão nova do Vortex (1.{atualizacao.nova.numero}).</span>
          <button data-foco className="botao primario" disabled={atualizacao.instalando} onClick={() => { void atualizacao.atualizar(); }}>{atualizacao.instalando ? "Atualizando…" : "Atualizar"}</button>
        </div>
      )}
      {aviso && <div className="entrar fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-cyan-300/40 bg-[#0b1226ee] px-6 py-3 text-sm shadow-[0_0_30px_rgba(25,227,255,.3)]" role="status">{aviso}</div>}
    </>
  );
}
