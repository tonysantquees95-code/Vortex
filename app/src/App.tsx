import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMotor } from "./estado";
import { focar, primeiroSemCampo, useNavegacao } from "./foco";
import type { Estatisticas, Jogo, ResumoPlataforma } from "./ponte";
import { configurado, marcarConfigurado, organizarAutomatico } from "./config";
import { aplicarTema, coresDoTema, guardarTema, lerTema, type Tema } from "./tema";
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
import { InfoConsole } from "./telas/InfoConsole";
import { aplicarFora, guardarOcultos, lerOcultos, mudarJogo, mudarOculto, paraOInicio, type Ocultos } from "./ocultos";
import { instalarVoltar, registrarVoltar } from "./voltar";
import { useAtualizacao } from "./useAtualizacao";
import { Biblioteca } from "./telas/Biblioteca";
import { Dock } from "./telas/Dock";
import { LogoVortex } from "./telas/LogoVortex";
import { Colecao, colecoesDe, Inicio } from "./telas/Inicio";
import { BarraStatus } from "./telas/BarraStatus";
import { androidParaJogos, favoritarAndroid, ehAndroid, pacoteDe, falhaDeAbertura, limparFalhas } from "./androidApps";
import { capaConhecida, resolverCapa, usarIndiceDeCapas } from "./capas";
import { faxinaAutomatica, resumoDaFaxina } from "./faxina";

type Aba = "inicio" | "biblioteca" | "loja" | "controles" | "favoritos" | "ajustes";
const ABAS: [Aba, string, string][] = [["inicio", "Início", "inicio"], ["biblioteca", "Biblioteca", "biblioteca"], ["loja", "Loja", "loja"], ["controles", "Controles", "controles"], ["favoritos", "Favoritos", "favoritos"], ["ajustes", "Ajustes", "ajustes"]];

export function App() {
  const motor = useMotor();
  usarIndiceDeCapas(motor.indiceCapas?.bind(motor));
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
  // trabalho demorado (descompactar um jogo de mais de 1 GB): fica à vista até acabar, para ninguém achar que travou
  const [ocupado, setOcupado] = useState("");
  const [controle, setControle] = useState(false);
  const [apps, setApps] = useState<Jogo[]>([]);
  const [focadoJogo, setFocadoJogo] = useState<Jogo | null>(null);
  const [ultimaColecao, setUltimaColecao] = useState<string | null>(null);
  const [focada, setFocada] = useState<Colecao | null>(null);
  const [fundoImg, setFundoImg] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [hora, setHora] = useState(() => new Date());
  const [tema, setTema] = useState<Tema>(lerTema);
  const [ocultos, setOcultos] = useState<Ocultos>(lerOcultos);
  const [infoDe, setInfoDe] = useState<Colecao | null>(null);
  const mudarJogos = useCallback((id: string, como: "esconder" | "fora" | "mostrar") => setOcultos((o) => { const n = mudarJogo(o, id, como); guardarOcultos(n); return n; }), []);
  const mudarOcultos = useCallback((id: string, como: "esconder" | "fora" | "mostrar") => setOcultos((o) => { const n = mudarOculto(o, id, como); guardarOcultos(n); return n; }), []);
  const [abertura, setAbertura] = useState(() => lerTema().abertura);
  const [config, setConfig] = useState(configurado);
  useEffect(() => { aplicarTema(tema); guardarTema(tema); }, [tema]);
  // os botões virtuais da tela do jogo (Java) seguem a cor do sistema e o modelo escolhido
  useEffect(() => {
    if (!motor.visualControles) return;
    const c = coresDoTema(tema);
    void motor.visualControles({ cor: c.principal, cor2: c.segunda, modelo: tema.botoes, tamanho: tema.tamanhoBotoes, opacidade: tema.opacidadeBotoes }).catch(() => {});
  }, [motor, tema.cor, tema.botoes, tema.tamanhoBotoes, tema.opacidadeBotoes]);
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
      if (motor.appsAndroid) motor.appsAndroid().then((a) => setApps(androidParaJogos(a))).catch(() => {});
      setJogos(l.filter((j) => j.disponivel)); setContinuar(c.filter((j) => j.disponivel)); setPlats(p); setStats(s); setPasta(ps.length > 0);
    } catch (e) { avisar(String(e)); } finally { setCarregado(true); }
  }, [motor, avisar]);

  // com a abertura na tela, a carga pesada (biblioteca, busca de jogos) espera: assim a animação não engasga no celular
  const jaIniciou = useRef(false);
  useEffect(() => {
    if (abertura || jaIniciou.current) return;
    jaIniciou.current = true;
    motor.recuperarModoJogo().catch(() => {});
    recarregar();
    // organização automática: acha jogos soltos, guarda por console na pasta do Vortex e mostra tudo na biblioteca
    if (organizarAutomatico()) {
      // sem a permissão de arquivos a busca não acharia nada (e abriria a tela do sistema toda vez): a configuração e os Ajustes pedem
      motor.permissoes().then((l) => (l.some((p) => p.id === "arquivos" && !p.concedida) ? null : (setOcupado("1"), motor.organizar()))).then(async (r) => {
        setOcupado("");
        if (!r) return;
        if (r.organizados.length) avisar(`${r.organizados.length} jogos organizados por console`);
        // um jogo só por título e nada de arquivo quebrado
        const f = await faxinaAutomatica(motor);
        if (f) avisar(`Faxina: ${resumoDaFaxina(f)}`);
        if (r.organizados.length || f) recarregar();
      }).catch(() => { setOcupado(""); });
    }
  }, [motor, recarregar, avisar, abertura]);
  // Atualizar a biblioteca: procura tudo de novo; o que foi apagado ou movido sai (e o console some se ficou sem jogos).
  const atualizando = useRef(false);
  const [atualizandoBib, setAtualizandoBib] = useState(false);
  const atualizarBiblioteca = useCallback(async (manual: boolean) => {
    if (atualizando.current) return;
    atualizando.current = true; if (manual) setAtualizandoBib(true);
    try {
      // sem a permissão de arquivos a busca veria pastas vazias e esvaziaria a biblioteca à toa
      if ((await motor.permissoes()).some((p) => p.id === "arquivos" && !p.concedida)) { if (manual) avisar("Libere o acesso a todos os arquivos em Ajustes › Permissões para atualizar."); return; }
      if (manual) setOcupado("1");
      const rOrg = manual && organizarAutomatico() ? await motor.organizar() : null;
      const org = rOrg ? rOrg.organizados.length : 0;
      const falhaOrg = rOrg?.falhas?.[0];
      if (motor.pc) await motor.pc.importar().catch(() => null); // Steam e Epic instaladas entram sozinhas
      const r = await motor.escanear();
      const f = manual ? await faxinaAutomatica(motor) : null;
      if (manual || r.removidos || r.novos || org || f) await recarregar();
      if (manual) avisar(`Biblioteca atualizada: ${r.encontrados} jogos${r.novos ? ` · ${r.novos} novos` : ""}${r.removidos ? ` · ${r.removidos} saíram` : ""}${org ? ` · ${org} organizados` : ""}${f ? ` · ${resumoDaFaxina(f)}` : ""}`);
      if (manual && falhaOrg) window.setTimeout(() => avisar(`Não organizei: ${falhaOrg}`), 4000);
      if (!manual && r.removidos) avisar(`${r.removidos} ${r.removidos === 1 ? "jogo saiu" : "jogos saíram"} da biblioteca (arquivo apagado ou movido)`);
    } catch (e) { if (manual) avisar(String(e instanceof Error ? e.message : e)); }
    finally { atualizando.current = false; setAtualizandoBib(false); setOcupado(""); }
  }, [motor, recarregar, avisar]);
  // sozinho: ao abrir e sempre que o Vortex volta para a frente (por exemplo, depois de apagar uma pasta no Vindex)
  useEffect(() => {
    let ultimo = 0;
    const ver = () => { if (document.visibilityState === "hidden" || Date.now() - ultimo < 15_000 || lancando) return; ultimo = Date.now(); void atualizarBiblioteca(false); };
    const t = window.setTimeout(ver, 2500);
    document.addEventListener("visibilitychange", ver); window.addEventListener("focus", ver);
    return () => { window.clearTimeout(t); document.removeEventListener("visibilitychange", ver); window.removeEventListener("focus", ver); };
  }, [atualizarBiblioteca, lancando]);
  const abrirArquivos = useCallback(async () => {
    try {
      const ps = await motor.pastas();
      const pasta = ps.find((p) => /vortex/i.test(p)) ?? ps[0] ?? (motor.plataforma === "windows" ? "" : "/storage/emulated/0/Vortex/Jogos");
      if (!pasta) { avisar("Escolha uma pasta de jogos nos Ajustes primeiro."); return; }
      if (!(await motor.abrirNoVindex?.(pasta))) avisar("Para ver a pasta, instale o Vindex (gerenciador de arquivos da Vetorial).");
    } catch (e) { avisar(String(e instanceof Error ? e.message : e)); }
  }, [motor, avisar]);
  useEffect(() => { const t = window.setInterval(() => setHora(new Date()), 20000); return () => window.clearInterval(t); }, []);
  const [aceitou, setAceitou] = useState(termosAceitos);
  const atualizacao = useAtualizacao(motor, lancando !== null, avisar, aceitou);
  useEffect(() => {
    const c = (e: Event) => setControle(Boolean((e as CustomEvent).detail));
    const a = (e: Event) => {
      if (aberto || lancando) return;
      const d = Number((e as CustomEvent).detail);
      setAba((x) => ABAS[(ABAS.findIndex(([id]) => id === x) + d + ABAS.length) % ABAS.length][0]);
    };
    // X do controle: procurar jogos de novo (onde o botão "Atualizar biblioteca" aparece). Start: ver se há versão nova do Vortex e instalar.
    const bib = () => { if (aberto || lancando) return; if ((aba === "inicio" || aba === "biblioteca" || aba === "loja") && !atualizandoBib) void atualizarBiblioteca(true); };
    const ver = () => {
      if (lancando) return;
      if (atualizacao.nova) { void atualizacao.atualizar(); return; }
      atualizacao.conferir().then((v) => avisar(v ? `Versão nova: 1.${v.numero}. Aperte Start de novo para atualizar.` : "O Vortex já está na versão mais recente.")).catch(() => avisar("Não consegui conferir agora. Veja a internet."));
    };
    window.addEventListener("vortex:controle", c);
    window.addEventListener("vortex:aba", a);
    window.addEventListener("vortex:atualizar-biblioteca", bib);
    window.addEventListener("vortex:atualizacao", ver);
    return () => { window.removeEventListener("vortex:controle", c); window.removeEventListener("vortex:aba", a); window.removeEventListener("vortex:atualizar-biblioteca", bib); window.removeEventListener("vortex:atualizacao", ver); };
  }, [aberto, lancando, aba, atualizandoBib, atualizacao, atualizarBiblioteca, avisar]);
  // ao trocar de aba, o foco vai para o primeiro item da tela
  useEffect(() => {
    if (aba === "inicio") return; // o Início cuida do próprio foco (volta para o console em que estava)
    const t = window.setTimeout(() => { const el = primeiroSemCampo(Array.from(document.querySelectorAll<HTMLElement>("main [data-foco]"))); if (el && !aberto) focar(el); }, 120);
    return () => window.clearTimeout(t);
  }, [aba, carregado]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (aba !== "ajustes") document.documentElement.dataset.secao = aba; }, [aba]);
  // o fundo acompanha a capa do console em foco (usa a primeira capa que existir entre os primeiros jogos dele)
  useEffect(() => {
    if (!focada || tema.fundo !== "console") return;
    let vivo = true;
    const candidatos = focadoJogo ? [focadoJogo] : focada.jogos.slice(0, 6);
    const pronta = candidatos.map((j) => capaConhecida(j.id)).find(Boolean);
    if (pronta) { setFundoImg(pronta); return; }
    const atraso = window.setTimeout(async () => {
      for (const j of candidatos) { const u = await resolverCapa(j); if (!vivo) return; if (u) { setFundoImg(u); return; } }
      if (vivo) setFundoImg(null);
    }, 250);
    return () => { vivo = false; window.clearTimeout(atraso); };
  }, [focada, focadoJogo, tema.fundo]);

  const favoritar = useCallback(async (j: Jogo) => {
    const novo = !j.favorito;
    try {
      if (ehAndroid(j)) { favoritarAndroid(j.id, novo); setApps((l) => l.map((x) => (x.id === j.id ? { ...x, favorito: novo } : x))); setAberto((a) => (a && a.id === j.id ? { ...a, favorito: novo } : a)); return; }
      await motor.favoritar(j.id, novo);
      setJogos((l) => l.map((x) => (x.id === j.id ? { ...x, favorito: novo } : x)));
      setContinuar((l) => l.map((x) => (x.id === j.id ? { ...x, favorito: novo } : x)));
      setAberto((a) => (a && a.id === j.id ? { ...a, favorito: novo } : a));
    } catch (e) { avisar(String(e)); }
  }, [motor, avisar]);

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
      if (ehAndroid(j) && motor.abrirApp) {
        await Promise.all([motor.abrirApp(pacoteDe(j)), minimo]);
        avisar(`${j.titulo} aberto`);
        return;
      }
      // primeira vez de cada console: o Vortex baixa o motor sozinho (sem a pessoa instalar nada)
      const dica = window.setTimeout(() => setEtapa("Preparando o motor deste console (só na primeira vez)…"), 1500);
      await motor.preparar(j.id).finally(() => window.clearTimeout(dica));
      // GameCube e Wii: na primeira vez, a IA escolhe os ajustes do Dolphin para este computador (some se não houver conta ou rede)
      if (motor.perfilIA && (j.plataforma === "gamecube" || j.plataforma === "wii")) {
        const feito = await motor.perfilIA.ler(j.id).catch(() => null);
        if (!feito) {
          setEtapa("Ajustando o jogo para o seu computador…");
          const p = await Promise.race([motor.perfilIA.gerar(j.id).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 9000))]);
          if (p && p.motivo) avisar(`Ajustado para o seu computador: ${p.motivo}`);
        }
      }
      if (motor.conta) { setEtapa("Conferindo os saves na nuvem…"); await Promise.race([motor.conta.sincronizar().catch(() => null), new Promise((r) => setTimeout(r, 6000))]); }
      setEtapa("Abrindo o jogo…");
      const [r] = await Promise.all([motor.lancar(j.id), minimo]);
      limparFalhas(j.id);
      avisar(`${j.titulo} aberto no ${r.emulador}${r.modo_jogo ? " · Modo Jogo ligado" : ""}`);
      window.setTimeout(recarregar, 1500);
    } catch (e) {
      // jogo que não abre duas vezes seguidas: o arquivo está quebrado (download incompleto etc.) e vai para a pasta Corrompidos
      if (!ehAndroid(j) && falhaDeAbertura(j.id)) {
        try { await motor.isolar(j.id); avisar(`${j.titulo} não abriu duas vezes e foi para a pasta Corrompidos`); recarregar(); }
        catch { avisar(String(e)); }
      } else avisar(String(e));
    } finally { setLancando(null); }
  }, [motor, avisar, recarregar]);
  useEffect(() => { jogarRef.current = jogar; recarregarRef.current = () => { void recarregar(); }; }, [jogar, recarregar]);

  // botão voltar do aparelho: fecha a janela aberta, volta de nível ou de aba; só depois de tudo pede um segundo toque para sair
  useEffect(() => { instalarVoltar(() => avisar("Toque em voltar de novo para sair")); }, [avisar]);
  useEffect(() => registrarVoltar(1, () => { if (aba !== "inicio") { setAba("inicio"); return true; } return false; }), [aba]);
  useEffect(() => {
    if (!infoDe && !aberto && !lendoTermos) return;
    return registrarVoltar(3, () => { if (infoDe) setInfoDe(null); else if (aberto) setAberto(null); else setLendoTermos(false); return true; });
  }, [infoDe, aberto, lendoTermos]);

  const todos = useMemo(() => aplicarFora([...jogos, ...apps], ocultos), [jogos, apps, ocultos]);
  const favoritos = useMemo(() => todos.filter((j) => j.favorito), [todos]);
  const colecoes = useMemo(() => colecoesDe(paraOInicio(todos, ocultos), plats, ocultos.esconder), [todos, plats, ocultos]);

  const vazio = carregado && !todos.length;
  const intro = abertura ? <Abertura aoTerminar={() => setAbertura(false)} /> : null;
  if (!aceitou) return <>{intro}<FundoDaTela tema={abertura ? { ...tema, fundo: "liso" } : tema} imagem={fundoImg} /><Termos aoAceitar={() => { aceitarTermos(); setAceitou(true); }} /></>;
  return (
    <>
      {intro}
      <FundoDaTela tema={abertura ? { ...tema, fundo: "liso" } : tema} imagem={fundoImg} />
      <div className="relative flex h-full flex-col">
        <header className="cabeca grid gap-2 pb-1">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <BarraStatus lado="esquerda" hora={hora} controle={controle} demo={motor.plataforma === "demo"} />
            <div className="text-center"><span className="marca-vx"><LogoVortex /></span></div>
            <BarraStatus lado="direita" hora={hora} controle={controle} demo={motor.plataforma === "demo"} />
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
            <Inicio colecoes={colecoes} inicial={ultimaColecao} aoFocar={setFocada} aoFocarJogo={setFocadoJogo} aoLembrar={setUltimaColecao}
              aoJogar={jogar} aoDetalhes={setAberto} aoFavoritar={favoritar} jogoParaContinuar={continuar.find((j) => !ocultos.fora.includes(j.plataforma)) ?? null} aoContinuar={jogar} aoInfoConsole={setInfoDe} />
          ) : aba === "loja" ? (
            <Loja motor={motor} aoInstalar={recarregar} avisar={avisar} aoJogar={(id) => { const j = jogos.find((x) => x.id === id); if (j) jogar(j); else avisar("O jogo ainda está aparecendo na biblioteca. Tente de novo em instantes."); }} />
          ) : aba === "controles" && motor.controles ? (
            <Controles controles={motor.controles} avisar={avisar} />
          ) : aba === "ajustes" ? (
            <Ajustes motor={motor} aoMudarBiblioteca={recarregar} avisar={avisar} atualizacao={atualizacao} tema={tema} aoMudarTema={setTema} jogos={jogos} plats={plats} ocultos={ocultos} aoMostrarConsole={(id) => mudarOcultos(id, "mostrar")} aoMostrarJogo={(id) => mudarJogos(id, "mostrar")} />
          ) : aba === "biblioteca" ? (
            <Biblioteca jogos={todos} plats={plats} aoAbrir={setAberto} vazio="Nenhum jogo encontrado." conta={motor.conta} aoProcurar={() => { void atualizarBiblioteca(true); }} />
          ) : (
            <Biblioteca key="fav" jogos={favoritos} plats={plats} aoAbrir={setAberto} titulo="Favoritos" vazio="Nenhum favorito ainda. Abra um jogo e aperte Y (ou F) para favoritar." />
          )}
        </main>

        <footer className="rodape-dock">
          <Dock rotulo="Seções" foco={false} ativo={aba}
            itens={[
              ...ABAS.filter(([id]) => id !== "controles" || motor.controles).map(([id, nome, icone]) => ({ id, nome, icone })),
              ...(motor.abrirNoVindex ? [{ id: "arquivos", nome: "Arquivos", icone: "arquivos", acao: true }] : []),
              ...(aba === "inicio" || aba === "biblioteca" || aba === "loja" ? [{ id: "atualizar", nome: atualizandoBib ? "Atualizando…" : "Atualizar biblioteca", icone: "atualizar", acao: true, girando: atualizandoBib, desligado: atualizandoBib }] : []),
            ]}
            aoEscolher={(id) => { if (id === "arquivos") void abrirArquivos(); else if (id === "atualizar") void atualizarBiblioteca(true); else setAba(id as Aba); }} />
          <div className="dicas max-md:hidden" aria-hidden><span><b>A</b> Abrir</span><span><b>B</b> Voltar</span><span><b>LB</b>/<b>RB</b> Abas</span><span><b>X</b> Atualizar biblioteca</span><span><b>Start</b> Atualização</span></div>
        </footer>
      </div>

      {infoDe && <InfoConsole c={infoDe} aoFechar={() => setInfoDe(null)}
        aoEsconder={() => { mudarOcultos(infoDe.id, "esconder"); avisar(`${infoDe.nome} escondido do Início`); setInfoDe(null); }}
        aoTirar={() => { mudarOcultos(infoDe.id, "fora"); avisar(`${infoDe.nome} saiu da biblioteca`); setInfoDe(null); }} />}
      {aberto && <Detalhe jogo={aberto} aoJogar={jogar} aoFavoritar={favoritar} aoFechar={() => setAberto(null)} aoEsconder={(j) => { mudarJogos(j.id, "esconder"); avisar(`${j.titulo} escondido do Início`); setAberto(null); }} aoTirar={(j) => { mudarJogos(j.id, "fora"); avisar(`${j.titulo} saiu da biblioteca`); setAberto(null); }} aoAbrirUrl={(u) => { motor.abrirUrl(u).catch(() => avisar("Não consegui abrir o navegador.")); }} />}
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
      {ocupado && <div className="fixed right-8 top-[4.5rem] z-[60] flex items-center gap-3 rounded-full border border-cyan-300/40 bg-[#0b1226ee] px-5 py-2.5 text-sm shadow-[0_0_24px_rgba(25,227,255,.25)]" role="status" aria-live="polite"><span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" /><span>Atualizando biblioteca… aguarde</span></div>}
      {aviso && <div className="entrar fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-cyan-300/40 bg-[#0b1226ee] px-6 py-3 text-sm shadow-[0_0_30px_rgba(25,227,255,.3)]" role="status">{aviso}</div>}
    </>
  );
}
