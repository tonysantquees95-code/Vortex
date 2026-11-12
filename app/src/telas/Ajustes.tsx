import { useCallback, useEffect, useState } from "react";
import type { EmuladoresInfo, EstadoConta, ModoJogoConfig, Motor } from "../ponte";
import { atualizarSozinho, definirAtualizarSozinho, definirOrganizarAutomatico, organizarAutomatico } from "../config";
import { BUILD } from "../atualizacao";
import type { Atualizacao } from "../useAtualizacao";
import { CORES, TEMA_PADRAO, hexValido, type Tema } from "../tema";
import { Interruptor } from "./pecas";
import { Permissoes } from "./Permissoes";

export function ContaVetorial({ motor, avisar }: { motor: Motor; avisar: (t: string) => void }) {
  const conta = motor.conta!;
  const [estado, setEstado] = useState<EstadoConta | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [conflitos, setConflitos] = useState<string[]>([]);
  useEffect(() => { conta.estado().then(setEstado).catch(() => setEstado({ logado: false, vortex: false })); }, [conta]);
  const tente = async (f: () => Promise<void>) => { setOcupado(true); try { await f(); } catch (e) { avisar(String(e instanceof Error ? e.message : e)); } finally { setOcupado(false); } };
  const sincronizar = (c?: "local" | "nuvem") => tente(async () => {
    const r = await conta.sincronizar(c);
    setConflitos(r.conflitos);
    avisar(r.conflitos.length ? `${r.conflitos.length} save(s) mudaram nos dois lugares. Escolha qual manter.` : `Saves em dia · ${r.enviados} enviados · ${r.baixados} baixados`);
    if (r.falhas.length) avisar(r.falhas[0]);
  });
  if (!estado) return <p className="text-slate-400">Carregando…</p>;
  if (!estado.logado) {
    return (
      <div className="vidro grid gap-3 p-4">
        <p className="text-sm text-slate-300">Entre com a sua conta Vetorial ID (a mesma da Vênus) para liberar o Vortex e guardar os saves na nuvem. Até 3 aparelhos vinculados, 2 ao mesmo tempo.</p>
        <input className="campo" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="campo" type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <div><button data-foco className="botao primario" disabled={ocupado || !email || !senha} onClick={() => tente(async () => { setEstado(await conta.entrar(email, senha)); setSenha(""); })}>{ocupado ? "Entrando…" : "Entrar"}</button></div>
      </div>
    );
  }
  return (
    <div className="vidro grid gap-3 p-4">
      <p><span className="font-semibold">{estado.email}</span>{estado.offline && <span className="text-sm text-slate-400"> · sem internet agora</span>}</p>
      <div className="flex flex-wrap gap-3">
        <button data-foco className="botao primario" disabled={ocupado || !estado.vortex} onClick={() => sincronizar()}>{ocupado ? "Sincronizando…" : "☁ Sincronizar saves agora"}</button>
        <button data-foco className="botao" disabled={ocupado} onClick={() => tente(async () => { await conta.sair(); setEstado({ logado: false, vortex: false }); })}>Sair da conta</button>
      </div>
      {conflitos.length > 0 && (
        <div className="grid gap-2 text-sm">
          <p className="text-amber-300">Mudaram nos dois lugares: {conflitos.join(", ")}</p>
          <div className="flex flex-wrap gap-3">
            <button data-foco className="botao" disabled={ocupado} onClick={() => sincronizar("nuvem")}>Manter o da nuvem (o daqui fica guardado ao lado)</button>
            <button data-foco className="botao" disabled={ocupado} onClick={() => sincronizar("local")}>Manter o deste aparelho</button>
          </div>
        </div>
      )}
    </div>
  );
}

const OPCOES: [keyof ModoJogoConfig, string, string][] = [
  ["ligado", "Modo Jogo", "Liga sozinho ao abrir um jogo e desfaz tudo quando você sai."],
  ["prioridade_do_jogo", "Prioridade para o jogo", "O emulador ganha prioridade alta no processador."],
  ["rebaixar_apps", "Apps em segundo plano mais calmos", "Navegador e programas pesados ficam com prioridade baixa."],
  ["pausar_atualizadores", "Pausar atualizadores", "Launchers e atualizações esperam você terminar."],
  ["liberar_ram", "Liberar memória", "Libera memória que os outros programas não estão usando."],
  ["bloquear_notificacoes", "Sem notificações", "Silencia avisos do Windows durante o jogo."],
  ["energia_maxima", "Energia no máximo", "Usa o plano de energia de alto desempenho."],
  ["gpu_dedicada", "Placa de vídeo dedicada", "Pede ao Windows para usar a GPU forte no emulador."],
  ["manter_acordado", "Tela sempre ligada", "O computador não apaga a tela nem dorme jogando."],
];

type Avisar = (t: string) => void;

export function TelaModoJogo({ motor, avisar }: { motor: Motor; avisar: Avisar }) {
  const [modo, setModo] = useState<ModoJogoConfig | null>(null);
  useEffect(() => { motor.modoJogo().then(setModo).catch(() => {}); }, [motor]);
  const mudar = async (campo: keyof ModoJogoConfig, v: boolean) => {
    if (!modo) return;
    try { setModo(await motor.modoJogo({ ...modo, [campo]: v })); } catch (e) { avisar(String(e)); }
  };
  return (
    <div className="grid gap-3">
      {motor.plataforma === "android" && <p className="text-sm text-slate-400">No Android o Modo Jogo ainda não mexe no aparelho; as opções ficam guardadas para quando o recurso chegar.</p>}
      {modo ? OPCOES.map(([k, r, d]) => <Interruptor key={k} ligado={Boolean(modo[k])} rotulo={r} detalhe={d} aoMudar={(v) => mudar(k, v)} />) : <p className="text-slate-400">Carregando…</p>}
    </div>
  );
}

export function TelaEmuladores({ motor }: { motor: Motor }) {
  const [emu, setEmu] = useState<EmuladoresInfo | null>(null);
  useEffect(() => { motor.emuladores().then(setEmu).catch(() => {}); }, [motor]);
  return (
    <div className="vidro grid gap-2 p-4">
      {emu?.instalados.length ? emu.instalados.map((e) => <div key={e.id}><span className="font-semibold">{e.nome}</span> <span className="text-sm text-slate-400">· {e.plataformas.length} plataformas</span></div>) : <p className="text-slate-400">Nenhum emulador encontrado ainda. O Vortex baixa o motor de cada console sozinho na primeira vez que você abre um jogo.</p>}
    </div>
  );
}

export function TelaJogos({ motor, avisar, aoMudarBiblioteca }: { motor: Motor; avisar: Avisar; aoMudarBiblioteca: () => void }) {
  const [pastas, setPastas] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [auto, setAuto] = useState(organizarAutomatico);
  const [resultado, setResultado] = useState<string[] | null>(null);
  useEffect(() => { motor.pastas().then(setPastas).catch(() => {}); }, [motor]);

  const escanear = async () => {
    setOcupado(true);
    try {
      const r = await motor.escanear();
      setResultado([`${r.encontrados} jogos na biblioteca · ${r.novos} novos${r.removidos ? ` · ${r.removidos} removidos` : ""}.`, ...(r.pastas_ausentes.length ? [`Pastas que não existem mais: ${r.pastas_ausentes.join(", ")}`] : [])]);
      aoMudarBiblioteca();
    } catch (e) { avisar(String(e instanceof Error ? e.message : e)); } finally { setOcupado(false); }
  };
  const adicionar = async () => {
    try {
      const p = await motor.escolherPasta();
      if (!p) return;
      setPastas(await motor.adicionarPasta(p));
      await escanear();
    } catch (e) { avisar(String(e instanceof Error ? e.message : e)); }
  };
  const remover = async (p: string) => {
    try { await motor.removerPasta(p); setPastas(await motor.pastas()); aoMudarBiblioteca(); } catch (e) { avisar(String(e instanceof Error ? e.message : e)); }
  };
  const organizarAgora = async () => {
    setOcupado(true); setResultado(null);
    try {
      const r = await motor.organizar();
      const linhas = [r.organizados.length ? `${r.organizados.length} jogos achados e guardados em ${r.pasta_vortex}.` : "Nenhum jogo solto encontrado nas pastas de sempre."];
      if (r.origens?.length) linhas.push(`Procurei em: ${r.origens.join(" · ")}`);
      else linhas.push("Não achei nenhuma pasta de jogos (Roms, Download, Games…). Use “Adicionar pasta” e escolha onde estão as suas ROMs.");
      if (r.falhas.length) linhas.push(`${r.falhas.length} arquivo(s) com problema: ${r.falhas.slice(0, 3).join("; ")}`);
      setResultado(linhas);
      setPastas(await motor.pastas());
      aoMudarBiblioteca();
    } catch (e) { avisar(String(e instanceof Error ? e.message : e)); } finally { setOcupado(false); }
  };
  const desfazer = async () => {
    setOcupado(true);
    try {
      const r = await motor.desfazerOrganizacao();
      avisar(`${r.devolvidos} arquivos devolvidos ao lugar de origem`);
      aoMudarBiblioteca();
    } catch (e) { avisar(String(e instanceof Error ? e.message : e)); } finally { setOcupado(false); }
  };
  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h3 className="text-lg font-bold text-cyan-100/90">Buscar jogos</h3>
        <Interruptor ligado={auto} rotulo="Achar e organizar jogos sozinho" detalhe="Ao abrir, o Vortex procura jogos retrô soltos (Download, Roms, Games, pastas com nome de console), descompacta e guarda cada um na pasta do console." aoMudar={(v) => { setAuto(v); definirOrganizarAutomatico(v); }} />
        <div className="flex flex-wrap gap-3">
          <button data-foco className="botao primario" disabled={ocupado} onClick={organizarAgora}>{ocupado ? "Procurando…" : "⚡ Buscar e organizar agora"}</button>
          <button data-foco className="botao" disabled={ocupado} onClick={desfazer}>↶ Desfazer a organização</button>
        </div>
        {resultado && <div className="vidro grid gap-1 p-4 text-sm text-slate-200">{resultado.map((l, i) => <p key={i}>{l}</p>)}</div>}
      </section>
      <section className="grid gap-3">
        <h3 className="text-lg font-bold text-cyan-100/90">Pastas de jogos</h3>
        {pastas.map((p) => (
          <button key={p} data-foco className="linha" onClick={() => remover(p)} title="Tirar esta pasta">
            <span className="truncate">{p}</span><span className="text-sm text-rose-300">Remover</span>
          </button>
        ))}
        {!pastas.length && <p className="text-sm text-slate-400">Nenhuma pasta ainda. Adicione a pasta onde ficam as suas ROMs.</p>}
        <div className="flex flex-wrap gap-3">
          <button data-foco className="botao primario" onClick={adicionar}>＋ Adicionar pasta</button>
          <button data-foco className="botao" disabled={ocupado} onClick={escanear}>{ocupado ? "Procurando…" : "↻ Procurar jogos de novo"}</button>
        </div>
      </section>
    </div>
  );
}

export function TelaAtualizacoes({ motor, avisar, atualizacao }: { motor: Motor; avisar: Avisar; atualizacao: Atualizacao }) {
  const [autoAtualizar, setAutoAtualizar] = useState(atualizarSozinho);
  if (motor.plataforma === "demo") return <p className="text-slate-400">No modo demonstração não há atualizações.</p>;
  return (
    <div className="grid gap-3">
      <div className="vidro grid gap-3 p-4">
        <div className="text-sm text-slate-300">{BUILD > 0 ? `Você está na versão 1.${BUILD}.` : "Versão de desenvolvimento."}{atualizacao.nova ? ` Tem a 1.${atualizacao.nova.numero} esperando.` : ""}</div>
        <div className="flex flex-wrap gap-3">
          <button data-foco className="botao" disabled={atualizacao.conferindo || BUILD === 0} onClick={() => { atualizacao.conferir().then((v) => avisar(v ? `Versão nova: 1.${v.numero}` : "O Vortex já está na versão mais recente.")).catch((e) => avisar(String(e instanceof Error ? e.message : e))); }}>{atualizacao.conferindo ? "Verificando…" : "Verificar atualizações"}</button>
          {atualizacao.nova && <button data-foco className="botao primario" disabled={atualizacao.instalando} onClick={() => { void atualizacao.atualizar(); }}>{atualizacao.instalando ? "Atualizando…" : `Atualizar para a 1.${atualizacao.nova.numero}`}</button>}
        </div>
      </div>
      <Interruptor ligado={autoAtualizar} rotulo="Atualizar sozinho" detalhe="Quando sai versão nova, o Vortex baixa e instala (nunca com um jogo abrindo)." aoMudar={(v) => { setAutoAtualizar(v); definirAtualizarSozinho(v); }} />
    </div>
  );
}

const FUNDOS: [Tema["fundo"], string][] = [["vortex", "Vórtex"], ["grade", "Grade"], ["liso", "Liso"]];
const FORMATOS: [Tema["formato"], string][] = [["futurista", "Futurista"], ["redondo", "Arredondado"]];
const CARTAS: [Tema["cartas"], string][] = [["pequeno", "Pequenas"], ["medio", "Médias"], ["grande", "Grandes"]];

/** Personalização completa: cor, brilho, fundo, formato, tamanho das cartas, animações e a abertura. */
export function TelaAparencia({ tema, aoMudar }: { tema: Tema; aoMudar: (t: Tema) => void }) {
  const m = (parte: Partial<Tema>) => aoMudar({ ...tema, ...parte });
  const personalizada = hexValido(tema.cor);
  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h3 className="text-lg font-bold text-cyan-100/90">Cor do Vortex</h3>
        <div className="flex flex-wrap gap-4">
          {CORES.map((c) => (
            <button key={c.id} data-foco className="amostra" data-ativa={tema.cor === c.id} aria-label={c.nome} title={c.nome} onClick={() => m({ cor: c.id })} style={{ background: `linear-gradient(135deg, ${c.principal}, ${c.segunda})` }} />
          ))}
          <label className="amostra relative grid cursor-pointer place-items-center overflow-hidden text-xs font-bold" data-ativa={personalizada} title="Escolher outra cor" style={{ background: personalizada ? tema.cor : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}>
            <input type="color" className="absolute inset-0 size-full cursor-pointer opacity-0" value={personalizada ? tema.cor : "#ff2a3d"} onChange={(e) => m({ cor: e.target.value })} aria-label="Cor personalizada" />
          </label>
        </div>
        <p className="text-sm text-slate-400">{CORES.find((c) => c.id === tema.cor)?.nome ?? "Personalizada"} · o último círculo deixa você escolher qualquer cor.</p>
      </section>
      <section className="grid gap-2">
        <h3 className="text-lg font-bold text-cyan-100/90">Brilho neon: {tema.brilho}%</h3>
        <input data-foco type="range" min={0} max={100} step={5} value={tema.brilho} onChange={(e) => m({ brilho: Number(e.target.value) })} className="barra" aria-label="Brilho neon" />
      </section>
      <section className="grid gap-2">
        <h3 className="text-lg font-bold text-cyan-100/90">Fundo</h3>
        <div className="flex flex-wrap gap-2">{FUNDOS.map(([id, nome]) => <button key={id} data-foco className="chip" data-ativa={tema.fundo === id} onClick={() => m({ fundo: id })}>{nome}</button>)}</div>
      </section>
      <section className="grid gap-2">
        <h3 className="text-lg font-bold text-cyan-100/90">Formato dos painéis</h3>
        <div className="flex flex-wrap gap-2">{FORMATOS.map(([id, nome]) => <button key={id} data-foco className="chip" data-ativa={tema.formato === id} onClick={() => m({ formato: id })}>{nome}</button>)}</div>
      </section>
      <section className="grid gap-2">
        <h3 className="text-lg font-bold text-cyan-100/90">Tamanho das capas</h3>
        <div className="flex flex-wrap gap-2">{CARTAS.map(([id, nome]) => <button key={id} data-foco className="chip" data-ativa={tema.cartas === id} onClick={() => m({ cartas: id })}>{nome}</button>)}</div>
      </section>
      <section className="grid gap-3">
        <Interruptor ligado={tema.animacoes} rotulo="Animações" detalhe="Brilhos pulsando, fundo em movimento e transições. Desligue para poupar bateria." aoMudar={(v) => m({ animacoes: v })} />
        <Interruptor ligado={tema.abertura} rotulo="Abertura no vórtex" detalhe="A animação de entrada, como se você fosse puxado para dentro de um vórtex, toda vez que abre o Vortex." aoMudar={(v) => m({ abertura: v })} />
        <div className="flex flex-wrap gap-3">
          <button data-foco className="botao" onClick={() => window.dispatchEvent(new CustomEvent("vortex:abertura"))}>▶ Ver a abertura</button>
          <button data-foco className="botao" onClick={() => aoMudar({ ...TEMA_PADRAO })}>↺ Voltar ao vermelho padrão</button>
        </div>
      </section>
    </div>
  );
}

type Tela = "menu" | "conta" | "jogos" | "aparencia" | "modo" | "permissoes" | "atualizacoes" | "emuladores" | "sobre";
interface Item { id: Exclude<Tela, "menu">; icone: string; titulo: string; detalhe: string }

export function Ajustes({ motor, aoMudarBiblioteca, avisar, atualizacao, tema, aoMudarTema }: { motor: Motor; aoMudarBiblioteca: () => void; avisar: Avisar; atualizacao: Atualizacao; tema: Tema; aoMudarTema: (t: Tema) => void }) {
  const [tela, setTela] = useState<Tela>("menu");
  const itens: Item[] = [
    ...(motor.conta ? [{ id: "conta" as const, icone: "☁", titulo: "Conta e saves na nuvem", detalhe: "Vetorial ID, licença e sincronização dos saves." }] : []),
    { id: "jogos", icone: "🎮", titulo: "Jogos e busca", detalhe: "Buscar jogos no aparelho, pastas e organização por console." },
    { id: "aparencia", icone: "🎨", titulo: "Personalização", detalhe: "Cor, brilho neon, fundo, formato, capas e abertura." },
    { id: "permissoes", icone: "🔐", titulo: "Permissões", detalhe: "O que o Vortex precisa liberar no aparelho e por quê." },
    { id: "modo", icone: "⚡", titulo: "Modo Jogo", detalhe: "Desempenho máximo enquanto você joga." },
    { id: "emuladores", icone: "🕹", titulo: "Emuladores", detalhe: "Motores de emulação encontrados." },
    { id: "atualizacoes", icone: "⬆", titulo: "Atualizações", detalhe: atualizacao.nova ? `Versão nova disponível: 1.${atualizacao.nova.numero}` : "Versão instalada e atualização automática." },
    { id: "sobre", icone: "ℹ", titulo: "Sobre e termos", detalhe: "Termos de uso e atalhos do controle." },
  ];
  const voltar = useCallback(() => setTela("menu"), []);
  useEffect(() => {
    if (tela === "menu") return;
    window.addEventListener("vortex:voltar", voltar);
    return () => window.removeEventListener("vortex:voltar", voltar);
  }, [tela, voltar]);
  useEffect(() => { const el = document.querySelector<HTMLElement>("main [data-foco]"); el?.focus({ preventScroll: true }); }, [tela]);

  if (tela === "menu") {
    return (
      <div className="entrar mx-auto grid max-w-4xl gap-3 px-6 pb-16 sm:px-10 sm:grid-cols-2">
        {itens.map((i) => (
          <button key={i.id} data-foco className="linha" onClick={() => setTela(i.id)}>
            <span className="flex items-center gap-4"><span className="text-3xl" aria-hidden>{i.icone}</span><span><span className="block text-lg font-bold">{i.titulo}</span><span className="block text-sm text-slate-400">{i.detalhe}</span></span></span>
            <span className="text-2xl cores-neon">›</span>
          </button>
        ))}
      </div>
    );
  }
  const atual = itens.find((i) => i.id === tela)!;
  return (
    <div className="entrar mx-auto grid max-w-4xl gap-6 px-6 pb-16 sm:px-10">
      <div className="flex items-center gap-4">
        <button data-foco className="botao" onClick={voltar}>‹ Ajustes</button>
        <h2 className="text-2xl font-black">{atual.titulo}</h2>
      </div>
      {tela === "conta" && motor.conta && <ContaVetorial motor={motor} avisar={avisar} />}
      {tela === "jogos" && <TelaJogos motor={motor} avisar={avisar} aoMudarBiblioteca={aoMudarBiblioteca} />}
      {tela === "aparencia" && <TelaAparencia tema={tema} aoMudar={aoMudarTema} />}
      {tela === "permissoes" && <Permissoes motor={motor} avisar={avisar} />}
      {tela === "modo" && <TelaModoJogo motor={motor} avisar={avisar} />}
      {tela === "emuladores" && <TelaEmuladores motor={motor} />}
      {tela === "atualizacoes" && <TelaAtualizacoes motor={motor} avisar={avisar} atualizacao={atualizacao} />}
      {tela === "sobre" && (
        <div className="grid gap-4">
          <div><button data-foco className="botao" onClick={() => window.dispatchEvent(new CustomEvent("vortex:termos"))}>Ler os termos de uso</button></div>
          <p className="text-sm text-slate-400">Controle: direcional ou analógico move · A confirma · B volta · Y favorita · LB/RB trocam de aba. Teclado: setas ou WASD · Enter · Esc · F · Q/E.</p>
          <p className="text-sm text-slate-500">Vortex · Vetorial Tech{BUILD > 0 ? ` · versão 1.${BUILD}` : ""}</p>
        </div>
      )}
    </div>
  );
}
