import { useEffect, useMemo, useState } from "react";
import type { ConfigGameBar, EmuladoresInfo, CentralEmuladores, EstadoConta, Jogo, ModoDesempenho, ModoJogoConfig, Motor, PosicaoGameBar, RelatorioLimpeza, ResumoPlataforma, CandidataSistema, SugestaoIA, RevisaoFaxina, SugestaoFaxina } from "../ponte";
import type { Ocultos } from "../ocultos";
import { analogicoRola, definirAnalogicoRola, atualizarSozinho, definirAtualizarSozinho, definirLimparSozinho, definirOrganizarAutomatico, limparSozinho, organizarAutomatico } from "../config";
import { faxinaAutomatica, resumoDaFaxina } from "../faxina";
import { capaConhecida } from "../capas";
import { BUILD } from "../atualizacao";
import type { Atualizacao } from "../useAtualizacao";
import { CORES, TEMA_PADRAO, coresDoTema, hexValido, type Fundo, type ModeloBotoes, type Tema } from "../tema";
import { Interruptor } from "./pecas";
import { SeletorDeCor } from "./SeletorDeCor";
import { Dock } from "./Dock";
import { Icone3D } from "./Icones";
import { Permissoes } from "./Permissoes";
import { TelaDrive } from "./Drive";

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

const POSICOES: [PosicaoGameBar, string][] = [["oculta", "Escondida"], ["topo", "Em cima"], ["base", "Embaixo"], ["esquerda", "Esquerda"], ["direita", "Direita"]];
const MODOS: [ModoDesempenho, string, string][] = [["economico", "🔋 Econômico", "Tela em 60 Hz e brilho menor: dura mais."], ["normal", "⚖ Normal", "Do jeito que o aparelho já faz."], ["turbo", "⚡ Turbo", "Taxa de atualização máxima e prioridade alta."]];
const ITENS_GB: [keyof ConfigGameBar, string, string][] = [
  ["fps", "FPS", "Quadros por segundo reais do jogo (e o da tela entre parênteses)."],
  ["cpu", "CPU", "Uso de processador só do Vortex."],
  ["gpu", "GPU", "Aparece só nos aparelhos que deixam ler o uso da GPU."],
  ["ram", "Memória", "Memória livre do aparelho."],
  ["temp", "Temperatura", "Temperatura da bateria."],
  ["bateria", "Bateria", "Carga restante."],
  ["ping", "Conexão", "Tempo de resposta da internet (ping)."],
];

/** Game Bar: barra de status por cima do jogo (só nos jogos abertos dentro do Vortex), com troca rápida de modo. */
export function TelaGameBar({ motor, avisar }: { motor: Motor; avisar: Avisar }) {
  const [cfg, setCfg] = useState<ConfigGameBar | null>(null);
  useEffect(() => { motor.gameBar?.().then(setCfg).catch(() => {}); }, [motor]);
  const mudar = async (parte: Partial<ConfigGameBar>) => {
    try { setCfg(await motor.gameBar!(parte)); } catch (e) { avisar(String(e)); }
  };
  if (!cfg) return <p className="text-slate-400">Carregando…</p>;
  return (
    <div className="grid gap-5">
      <Interruptor ligado={cfg.ligada} rotulo="Game Bar" detalhe="Mostra a barra de status quando você joga. Dá para trocar o modo sem sair do jogo." aoMudar={(v) => mudar({ ligada: v })} />
      <section className="grid gap-2">
        <h3 className="font-bold text-cyan-100">Onde ela fica</h3>
        <div className="flex flex-wrap gap-2">{POSICOES.map(([id, nome]) => <button key={id} data-foco className="chip" data-ativa={cfg.posicao === id} onClick={() => mudar({ posicao: id })}>{nome}</button>)}</div>
        <p className="text-sm text-slate-400">Escondida: sobra só uma bolinha que abre a barra por alguns segundos.</p>
      </section>
      <section className="grid gap-2">
        <h3 className="font-bold text-cyan-100">Modo de desempenho ao abrir o jogo</h3>
        <div className="flex flex-wrap gap-2">{MODOS.map(([id, nome]) => <button key={id} data-foco className="chip" data-ativa={cfg.modo === id} onClick={() => mudar({ modo: id })}>{nome}</button>)}</div>
        <p className="text-sm text-slate-400">{MODOS.find(([id]) => id === cfg.modo)?.[2]}</p>
      </section>
      <section className="grid gap-3">
        <h3 className="font-bold text-cyan-100">O que mostrar</h3>
        {ITENS_GB.map(([k, r, d]) => <Interruptor key={k} ligado={Boolean(cfg[k])} rotulo={r} detalhe={d} aoMudar={(v) => mudar({ [k]: v })} />)}
      </section>
    </div>
  );
}

export function TelaEmuladores({ motor }: { motor: Motor }) {
  const [emu, setEmu] = useState<EmuladoresInfo | null>(null);
  const [cen, setCen] = useState<CentralEmuladores | null>(null);
  useEffect(() => { motor.emuladores().then(setEmu).catch(() => {}); motor.central?.().then(setCen).catch(() => {}); }, [motor]);
  const ROTULO = { pronto: "Pronto", baixa: "Baixa sozinho", instalar: "Instale um emulador" } as const;
  return (
    <div className="grid gap-4">
    {cen && cen.consoles.length > 0 && (
      <div className="vidro grid gap-2 p-4 text-sm">
        <p className="text-slate-300">{cen.aparelho.so === "android" ? "Seu aparelho" : "Seu computador"}: {cen.aparelho.cpu || "processador"} · {cen.aparelho.nucleos} núcleos · {cen.aparelho.ram_gb} GB de RAM</p>
        {cen.consoles.map((l) => (
          <div key={l.id} className="grid gap-0.5">
            <div className="flex flex-wrap items-baseline gap-2"><span className="font-semibold">{l.nome}</span><span className="text-slate-400">{l.jogos} jogo(s)</span><span className={l.estado === "instalar" ? "text-amber-300" : "text-cyan-200"}>{ROTULO[l.estado]}{l.emulador ? ` · ${l.emulador}` : ""}</span></div>
            {l.aviso && <p className="text-slate-400">{l.aviso}</p>}
          </div>
        ))}
      </div>
    )}
    <div className="vidro grid gap-2 p-4">
      {emu?.instalados.length ? emu.instalados.map((e) => <div key={e.id}><span className="font-semibold">{e.nome}</span> <span className="text-sm text-slate-400">· {e.plataformas.length} plataformas</span></div>) : <p className="text-slate-400">Nenhum emulador encontrado ainda. O Vortex baixa o motor de cada console sozinho na primeira vez que você abre um jogo.</p>}
    </div>
    </div>
  );
}

export function TelaJogos({ motor, avisar, aoMudarBiblioteca, plats = [], ocultos = { esconder: [], fora: [], jogosEsconder: [], jogosFora: [] }, aoMostrarConsole, jogos = [], aoMostrarJogo }: { motor: Motor; avisar: Avisar; aoMudarBiblioteca: () => void; plats?: ResumoPlataforma[]; ocultos?: Ocultos; aoMostrarConsole?: (id: string) => void; jogos?: Jogo[]; aoMostrarJogo?: (id: string) => void }) {
  const [pastas, setPastas] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [auto, setAuto] = useState(organizarAutomatico);
  const [resultado, setResultado] = useState<string[] | null>(null);
  const [limpezaAuto, setLimpezaAuto] = useState(limparSozinho);
  const [previa, setPrevia] = useState<RelatorioLimpeza | null>(null);
  useEffect(() => { motor.pastas().then(setPastas).catch(() => {}); }, [motor]);

  const escanear = async () => {
    setOcupado(true);
    try {
      const r = await motor.escanear();
      setResultado([`${r.encontrados} jogos na biblioteca · ${r.novos} novos${r.removidos ? ` · ${r.removidos} removidos` : ""}.`, ...(r.pastas_ausentes.length ? [`Pastas que não existem mais: ${r.pastas_ausentes.join(", ")}`] : [])]);
      const f = await faxinaAutomatica(motor);
      if (f) avisar(`Faxina: ${resumoDaFaxina(f)}`);
      aoMudarBiblioteca();
    } catch (e) { avisar(String(e instanceof Error ? e.message : e)); } finally { setOcupado(false); }
  };
  const verFaxina = async () => {
    setOcupado(true);
    try { const r = await motor.limpar(true); if (r.duplicados.length || r.corrompidos.length) setPrevia(r); else { setPrevia(null); avisar("Tudo em ordem: nenhum jogo repetido nem arquivo quebrado."); } }
    catch (e) { avisar(String(e instanceof Error ? e.message : e)); } finally { setOcupado(false); }
  };
  const [revIA, setRevIA] = useState<{ rev: RevisaoFaxina; sug: SugestaoFaxina; dup: Record<string, boolean>; cor: Record<string, boolean> } | null>(null);
  const revisarComIA = async () => {
    if (!motor.faxinaIA) return;
    setOcupado(true); setRevIA(null);
    try {
      const rev = await motor.faxinaIA.revisar();
      if (!rev.parecidos.length && !rev.suspeitos.length) { avisar("Nada duvidoso para a IA olhar: sem nomes parecidos nem arquivos pequenos demais."); return; }
      const sug = await motor.faxinaIA.sugerir(rev);
      if (!sug.duplicados.length && !sug.corrompidos.length) { avisar("A IA olhou e não achou nada para separar."); return; }
      const dup: Record<string, boolean> = {}; sug.duplicados.forEach((d) => d.remover.forEach((id) => { dup[id] = true; }));
      const cor: Record<string, boolean> = {}; sug.corrompidos.forEach((c) => { cor[c.id] = true; });
      setRevIA({ rev, sug, dup, cor });
    } catch (e) { avisar(String(e instanceof Error ? e.message : e)); } finally { setOcupado(false); }
  };
  const nomeDe = (id: string) => { const todos = revIA ? [...revIA.rev.parecidos.flat(), ...revIA.rev.suspeitos] : []; const i = todos.find((x) => x.id === id); return i ? `${i.arquivo} (${(i.bytes / 1048576).toFixed(1)} MB)` : id; };
  const aplicarIA = async () => {
    if (!revIA || !motor.faxinaIA) return;
    setOcupado(true);
    try {
      const r = await motor.faxinaIA.aplicar(Object.keys(revIA.dup).filter((k) => revIA.dup[k]), Object.keys(revIA.cor).filter((k) => revIA.cor[k]));
      avisar(`${r.separados} arquivo(s) separados${r.falhas.length ? ` · ${r.falhas.length} com problema` : ""}. Nada foi apagado.`);
      setRevIA(null); aoMudarBiblioteca();
    } catch (e) { avisar(String(e instanceof Error ? e.message : e)); } finally { setOcupado(false); }
  };
  const fazerFaxina = async () => {
    setOcupado(true);
    try {
      const r = await motor.limpar();
      setPrevia(null);
      avisar(`Pronto: ${resumoDaFaxina(r) || "nada para mover"}${r.falhas.length ? ` · ${r.falhas.length} com problema` : ""}`);
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
      const zerados = (r.descartados?.length ?? 0) + (r.corrompidos?.length ?? 0);
      if (zerados) linhas.push(`${zerados} arquivo(s) zerado(s), quebrado(s) ou com erro foram descartados da biblioteca (guardados na pasta Corrompidos).`);
      if (r.duplicados?.length) linhas.push(`${r.duplicados.length} repetido(s) descartado(s) (guardados na pasta Duplicados).`);
      if (r.falhas.length) linhas.push(`${r.falhas.length} arquivo(s) com problema: ${r.falhas.slice(0, 3).join("; ")}`);
      setResultado(linhas);
      setPastas(await motor.pastas());
      aoMudarBiblioteca();
    } catch (e) { avisar(String(e instanceof Error ? e.message : e)); } finally { setOcupado(false); }
  };
  const [achadas, setAchadas] = useState<{ c: CandidataSistema; plataforma: string | null; motivo: string; marcada: boolean }[] | null>(null);
  const [nota, setNota] = useState("");
  const varrerSistema = async () => {
    if (!motor.sistema) return;
    setOcupado(true); setAchadas(null); setNota("Varrendo todos os discos… pode levar um minuto.");
    try {
      const v = await motor.sistema.varrer();
      let sug: SugestaoIA | null = null;
      if (v.varredura.candidatas.length) {
        setNota("Pedindo ajuda à IA para entender as pastas…");
        try { sug = await motor.sistema.ia(v); } catch { sug = null; }
      }
      const lista = v.varredura.candidatas.map((c) => {
        const s = sug?.pastas.find((x) => x.pasta === c.pasta);
        return { c, plataforma: s?.plataforma ?? null, motivo: s?.motivo ?? "", marcada: c.total >= 2 || !!s?.plataforma };
      });
      setAchadas(lista);
      setNota(`${v.varredura.arquivos_vistos.toLocaleString("pt-BR")} arquivos olhados em ${v.varredura.discos.join(" ")}${v.varredura.completa ? "" : " (parou no limite de tempo)"}. ${lista.length ? `${lista.length} pasta(s) com jogos.` : "Não achei pastas novas com jogos."}${sug?.observacoes ? ` ${sug.observacoes}` : ""}${sug ? "" : " (sem a ajuda da IA agora)"}`);
    } catch (e) { setNota(""); avisar(String(e instanceof Error ? e.message : e)); } finally { setOcupado(false); }
  };
  const adicionarAchadas = async () => {
    if (!motor.sistema || !achadas) return;
    setOcupado(true);
    try {
      for (const a of achadas.filter((x) => x.marcada)) {
        if (a.plataforma && a.c.ambiguos > 0) await motor.sistema.decidirPlataforma(a.c.pasta, a.plataforma);
        await motor.adicionarPasta(a.c.pasta);
      }
      setPastas(await motor.pastas());
      setAchadas(null);
      await escanear();
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
      {motor.sistema && (
        <section className="grid gap-3">
          <h3 className="text-lg font-bold text-cyan-100/90">Varredura completa do computador</h3>
          <p className="text-sm text-slate-400">Olha todos os discos (inclusive o C:), acha as pastas com jogos e usa a IA para entender as que não têm o nome do console. Nada é movido nem apagado.</p>
          <div className="flex flex-wrap gap-3"><button data-foco className={`botao ${pastas.length ? "" : "primario"}`} disabled={ocupado} onClick={varrerSistema}>{ocupado ? "Varrendo…" : "🔎 Varrer o computador inteiro"}</button></div>
          {nota && <p className="text-sm text-slate-300">{nota}</p>}
          {achadas && achadas.length > 0 && (
            <div className="vidro grid gap-2 p-4 text-sm text-slate-200">
              {achadas.map((a, i) => (
                <label key={a.c.pasta} className="flex items-start gap-3">
                  <input type="checkbox" checked={a.marcada} onChange={(e) => setAchadas(achadas.map((x, j) => j === i ? { ...x, marcada: e.target.checked } : x))} />
                  <span className="min-w-0"><span className="block truncate">{a.c.pasta}</span><span className="block text-slate-400">{a.c.total ? `${a.c.total} jogo(s): ${Object.entries(a.c.plataformas).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""}{a.c.ambiguos ? ` · ${a.c.ambiguos} arquivo(s) a identificar${a.plataforma ? ` → IA acha que é ${a.plataforma}${a.motivo ? ` (${a.motivo})` : ""}` : ""}` : ""}</span></span>
                </label>
              ))}
              <div className="flex flex-wrap gap-3"><button data-foco className="botao primario" disabled={ocupado} onClick={adicionarAchadas}>Adicionar as marcadas</button><button data-foco className="botao" onClick={() => setAchadas(null)}>Cancelar</button></div>
            </div>
          )}
        </section>
      )}
      <section className="grid gap-3">
        <h3 className="text-lg font-bold text-cyan-100/90">Jogos repetidos e arquivos quebrados</h3>
        <Interruptor ligado={limpezaAuto} rotulo="Deixar um jogo só por título" detalhe="Depois de buscar, fica a melhor versão de cada jogo (Brasil, EUA, sem beta). As cópias vão para a pasta Duplicados e os arquivos quebrados para a pasta Corrompidos, dentro da sua pasta de jogos. Nada é apagado." aoMudar={(v) => { setLimpezaAuto(v); definirLimparSozinho(v); }} />
        <div className="flex flex-wrap gap-3"><button data-foco className="botao" disabled={ocupado} onClick={verFaxina}>🧹 Ver o que dá para limpar</button>{motor.faxinaIA && <button data-foco className="botao" disabled={ocupado} onClick={revisarComIA}>🤖 Revisar com IA</button>}</div>
        {revIA && (
          <div className="vidro grid gap-2 p-4 text-sm text-slate-200">
            <p>A IA sugere separar estes arquivos (você decide; nada é apagado):</p>
            {revIA.sug.duplicados.map((d) => (
              <div key={d.manter} className="grid gap-1">
                <p className="text-slate-400">Repetido de “{nomeDe(d.manter)}”{d.motivo ? ` — ${d.motivo}` : ""}</p>
                {d.remover.map((id) => <label key={id} className="flex gap-3"><input type="checkbox" checked={!!revIA.dup[id]} onChange={(e) => setRevIA({ ...revIA, dup: { ...revIA.dup, [id]: e.target.checked } })} /><span className="truncate">{nomeDe(id)}</span></label>)}
              </div>
            ))}
            {revIA.sug.corrompidos.map((c) => <label key={c.id} className="flex gap-3"><input type="checkbox" checked={!!revIA.cor[c.id]} onChange={(e) => setRevIA({ ...revIA, cor: { ...revIA.cor, [c.id]: e.target.checked } })} /><span className="truncate">Parece quebrado: {nomeDe(c.id)}{c.motivo ? ` — ${c.motivo}` : ""}</span></label>)}
            <div className="flex flex-wrap gap-3"><button data-foco className="botao primario" disabled={ocupado} onClick={aplicarIA}>Separar as marcadas</button><button data-foco className="botao" onClick={() => setRevIA(null)}>Deixar como está</button></div>
          </div>
        )}
        {previa && (
          <div className="vidro grid gap-3 p-4 text-sm text-slate-200">
            <p>{previa.duplicados.length} repetido(s) e {previa.corrompidos.length} quebrado(s) seriam separados.</p>
            {[...previa.corrompidos, ...previa.duplicados].slice(0, 4).map((c) => <p key={c} className="truncate text-slate-400">{c}</p>)}
            <div className="flex flex-wrap gap-3"><button data-foco className="botao primario" disabled={ocupado} onClick={fazerFaxina}>Separar agora</button><button data-foco className="botao" onClick={() => setPrevia(null)}>Deixar como está</button></div>
          </div>
        )}
      </section>
      {(ocultos.esconder.length > 0 || ocultos.fora.length > 0 || ocultos.jogosEsconder.length > 0 || ocultos.jogosFora.length > 0) && (
        <section className="grid gap-3">
          <h3 className="text-lg font-bold text-cyan-100/90">Consoles escondidos</h3>
          <p className="text-sm text-slate-400">Escondidos somem do Início; os tirados da biblioteca somem de tudo. Seus arquivos continuam nas pastas.</p>
          {[...ocultos.esconder.map((id) => [id, "escondido do Início"] as const), ...ocultos.fora.map((id) => [id, "fora da biblioteca"] as const)].map(([id, estado]) => (
            <button key={id} data-foco className="linha" onClick={() => aoMostrarConsole?.(id)}>
              <span className="truncate">{plats.find((p) => p.id === id)?.nome.replace(/\s*\(.*\)\s*$/, "") ?? id.toUpperCase()} · <span className="text-slate-400">{estado}</span></span><span className="text-sm text-cyan-200">Mostrar de novo</span>
            </button>
          ))}
          {[...ocultos.jogosEsconder.map((id) => [id, "escondido do Início"] as const), ...ocultos.jogosFora.map((id) => [id, "fora da biblioteca"] as const)].map(([id, estado]) => (
            <button key={id} data-foco className="linha" onClick={() => aoMostrarJogo?.(id)}>
              <span className="truncate">{jogos.find((j) => j.id === id)?.titulo ?? "Jogo que não está mais na pasta"} · <span className="text-slate-400">{estado}</span></span><span className="text-sm text-cyan-200">Mostrar de novo</span>
            </button>
          ))}
        </section>
      )}
      {motor.pc && (
        <section className="grid gap-3">
          <h3 className="text-lg font-bold text-cyan-100/90">Jogos de PC</h3>
          <p className="text-sm text-slate-300">O Vortex acha sozinho os jogos já instalados na Steam e na Epic Games e abre cada um pelo lançador oficial (sem pedir senha). Jogos de outros lugares (Softonic, Microsoft Store…) você adiciona escolhendo o arquivo ou o atalho.</p>
          <div className="flex flex-wrap gap-2">
            <button data-foco className="botao primario" disabled={ocupado} onClick={async () => {
              setOcupado(true);
              try {
                const r = await motor.pc!.importar();
                await motor.escanear(); aoMudarBiblioteca();
                avisar(r.steam + r.epic ? `Achei ${r.steam} da Steam e ${r.epic} da Epic${r.novos ? ` (${r.novos} novos na biblioteca)` : ""}.` : "Não achei jogos da Steam nem da Epic instalados neste computador.");
              } catch (e) { avisar(String(e instanceof Error ? e.message : e)); } finally { setOcupado(false); }
            }}>Buscar jogos da Steam e Epic</button>
            <button data-foco className="botao" disabled={ocupado} onClick={async () => {
              try { if (await motor.pc!.adicionar()) { await motor.escanear(); aoMudarBiblioteca(); avisar("Jogo adicionado à biblioteca."); } } catch (e) { avisar(String(e instanceof Error ? e.message : e)); }
            }}>Adicionar jogo (.exe ou atalho)</button>
            <button data-foco className="botao" onClick={() => { motor.abrirUrl("https://apps.microsoft.com/games").catch(() => avisar("Não consegui abrir a Microsoft Store.")); }}>Abrir a Microsoft Store</button>
          </div>
        </section>
      )}
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

const FUNDOS: [Fundo, string, string][] = [
  ["console", "Segue o console", "O fundo troca para a capa do console ou jogo em foco."],
  ["aurora", "Aurora", "Luzes suaves na cor do tema."], ["grade", "Grade", "Linhas de neon, estilo futurista."],
  ["circuito", "Circuito", "Trilhas de placa de circuito."], ["pontos", "Pontos", "Pontinhos de luz."], ["liso", "Liso", "Só a cor, sem desenho."],
];

/** Reduz a foto escolhida (até 1280 px) para caber no armazenamento do aparelho. */
async function reduzirFoto(arq: File): Promise<string> {
  const url = URL.createObjectURL(arq);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error("Não consegui abrir essa imagem.")); i.src = url; });
    const e = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * e)); c.height = Math.max(1, Math.round(img.naturalHeight * e));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  } finally { URL.revokeObjectURL(url); }
}
const FORMATOS: [Tema["formato"], string][] = [["futurista", "Futurista"], ["redondo", "Arredondado"]];
const CARTAS: [Tema["cartas"], string][] = [["pequeno", "Pequenas"], ["medio", "Médias"], ["grande", "Grandes"]];

const MODELOS: [ModeloBotoes, string][] = [["circulo", "Redondo"], ["quadrado", "Quadrado"], ["neon", "Neon"], ["vidro", "Vidro"]];

/** Estilo de um botão de exemplo (igual ao que o jogo desenha), na cor do sistema. */
function estiloExemplo(modelo: ModeloBotoes, cor: string, opac: number, apertado = false): React.CSSProperties {
  const a = opac / 100;
  const base: React.CSSProperties = { width: 52, height: 52, display: "grid", placeItems: "center", fontWeight: 700, color: modelo === "neon" ? cor : "#fff", borderRadius: modelo === "circulo" ? "50%" : modelo === "quadrado" ? 12 : modelo === "neon" ? 10 : 18, opacity: a };
  if (apertado) return { ...base, background: cor, border: "2px solid #fff", opacity: 1 };
  if (modelo === "neon") return { ...base, background: `${cor}2e`, border: `3px solid ${cor}`, boxShadow: `0 0 10px ${cor}` };
  if (modelo === "vidro") return { ...base, background: "rgba(255,255,255,.27)", border: "1px solid rgba(255,255,255,.6)" };
  return { ...base, background: "rgba(14,18,40,.7)", border: `2px solid ${cor}` };
}

/** Modelos, tamanho e transparência dos botões virtuais da tela do jogo (a cor vem da cor do sistema). */
function BotoesVirtuais({ tema, m }: { tema: Tema; m: (p: Partial<Tema>) => void }) {
  const cor = coresDoTema(tema).principal;
  const esc = tema.tamanhoBotoes === "pequeno" ? 0.85 : tema.tamanhoBotoes === "grande" ? 1.2 : 1;
  return (
    <section className="grid gap-3">
      <h3 className="text-lg font-bold text-cyan-100/90">Botões na tela do jogo</h3>
      <p className="text-sm text-slate-400">Aparecem quando não há controle conectado e seguem a cor do sistema.</p>
      <div className="flex flex-wrap gap-2">{MODELOS.map(([id, nome]) => <button key={id} data-foco className="chip" data-ativa={tema.botoes === id} onClick={() => m({ botoes: id })}>{nome}</button>)}</div>
      <div className="flex flex-wrap gap-2">{([["pequeno", "Pequeno"], ["medio", "Médio"], ["grande", "Grande"]] as const).map(([id, nome]) => <button key={id} data-foco className="chip" data-ativa={tema.tamanhoBotoes === id} onClick={() => m({ tamanhoBotoes: id })}>{nome}</button>)}</div>
      <label className="grid gap-1 text-sm text-slate-300">Transparência: {tema.opacidadeBotoes}%
        <input data-foco type="range" min={30} max={100} step={5} value={tema.opacidadeBotoes} onChange={(e) => m({ opacidadeBotoes: Number(e.target.value) })} className="barra" aria-label="Opacidade dos botões" />
      </label>
      <div className="vidro flex items-center justify-center gap-4 bg-black p-4" style={{ background: "#05060d" }} aria-hidden>
        {["A", "B", "X", "Y"].map((t, i) => <div key={t} style={{ ...estiloExemplo(tema.botoes, cor, tema.opacidadeBotoes, i === 1), transform: `scale(${esc})` }}>{t}</div>)}
      </div>
    </section>
  );
}

/** Personalização completa: cor, brilho, fundo, formato, tamanho das cartas, animações e a abertura. */
export function TelaAparencia({ tema, aoMudar, jogos = [], avisar, botoesVirtuais = false }: { tema: Tema; aoMudar: (t: Tema) => void; jogos?: Jogo[]; avisar?: (t: string) => void; botoesVirtuais?: boolean }) {
  const m = (parte: Partial<Tema>) => aoMudar({ ...tema, ...parte });
  const [escolhendoCapa, setEscolhendoCapa] = useState(false);
  const capas = useMemo(() => jogos.map((j) => capaConhecida(j.id)).filter((u): u is string => Boolean(u)).slice(0, 36), [jogos, escolhendoCapa]); // eslint-disable-line react-hooks/exhaustive-deps
  const escolherFoto = async (arq: File | undefined) => {
    if (!arq) return;
    try { m({ fundo: "foto", foto: await reduzirFoto(arq) }); } catch (e) { avisar?.(String(e instanceof Error ? e.message : e)); }
  };
  const personalizada = hexValido(tema.cor);
  const [escolhendoCor, setEscolhendoCor] = useState(false);
  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h3 className="text-lg font-bold text-cyan-100/90">Cor do Vortex</h3>
        <div className="flex flex-wrap gap-4">
          {CORES.map((c) => (
            <button key={c.id} data-foco className="amostra" data-ativa={tema.cor === c.id} aria-label={c.nome} title={c.nome} onClick={() => m({ cor: c.id })} style={{ background: `linear-gradient(135deg, ${c.principal}, ${c.segunda})` }} />
          ))}
          <button data-foco className="amostra" data-ativa={personalizada} title="Escolher outra cor" aria-label="Escolher outra cor" onClick={() => setEscolhendoCor(true)} style={{ background: personalizada ? tema.cor : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }} />
        </div>
        {escolhendoCor && <SeletorDeCor inicial={personalizada ? tema.cor : "#ff2a3d"} aoCancelar={() => setEscolhendoCor(false)} aoDefinir={(hex) => { m({ cor: hex }); setEscolhendoCor(false); }} />}
        <p className="text-sm text-slate-400">{CORES.find((c) => c.id === tema.cor)?.nome ?? "Personalizada"} · o último círculo deixa você escolher qualquer cor.</p>
      </section>
      <section className="grid gap-2">
        <h3 className="text-lg font-bold text-cyan-100/90">Brilho neon: {tema.brilho}%</h3>
        <input data-foco type="range" min={0} max={100} step={5} value={tema.brilho} onChange={(e) => m({ brilho: Number(e.target.value) })} className="barra" aria-label="Brilho neon" />
      </section>
      <section className="grid gap-2">
        <h3 className="text-lg font-bold text-cyan-100/90">Fundo</h3>
        <div className="flex flex-wrap gap-2">
          {FUNDOS.map(([id, nome]) => <button key={id} data-foco className="chip" data-ativa={tema.fundo === id} onClick={() => m({ fundo: id })}>{nome}</button>)}
          <label className="chip cursor-pointer" data-ativa={tema.fundo === "foto"} data-foco tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.click(); }}>📷 Minha foto
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { void escolherFoto(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <button data-foco className="chip" data-ativa={tema.fundo === "capa"} onClick={() => setEscolhendoCapa((v) => !v)}>🖼 Capa de um jogo</button>
        </div>
        <p className="text-sm text-slate-400">{FUNDOS.find(([id]) => id === tema.fundo)?.[2] ?? (tema.fundo === "foto" ? "Sua foto de fundo." : "A capa de jogo que você escolheu.")}</p>
        {escolhendoCapa && (capas.length ? (
          <div className="rolagem flex max-h-56 flex-wrap gap-2">{capas.map((u) => <button key={u} data-foco className="mini-escolha" data-ativa={tema.capaFundo === u} onClick={() => m({ fundo: "capa", capaFundo: u })}><img src={u} alt="" loading="lazy" /></button>)}</div>
        ) : <p className="text-sm text-slate-400">As capas aparecem aqui depois que o Vortex as encontrar (abra a Biblioteca e volte).</p>)}
      </section>
      <section className="grid gap-2">
        <h3 className="text-lg font-bold text-cyan-100/90">Formato dos painéis</h3>
        <div className="flex flex-wrap gap-2">{FORMATOS.map(([id, nome]) => <button key={id} data-foco className="chip" data-ativa={tema.formato === id} onClick={() => m({ formato: id })}>{nome}</button>)}</div>
      </section>
      <section className="grid gap-2">
        <h3 className="text-lg font-bold text-cyan-100/90">Ícones</h3>
        <div className="flex flex-wrap gap-2">{([["fino", "Finos"], ["medio", "Médios"], ["grosso", "Grossos"]] as const).map(([id, nome]) => <button key={id} data-foco className="chip" data-ativa={tema.icones === id} onClick={() => m({ icones: id })}>{nome}</button>)}</div>
        <p className="text-sm text-slate-400">Vale para todos os ícones, inclusive hora, bateria e internet no topo.</p>
      </section>
      <section className="grid gap-2">
        <h3 className="text-lg font-bold text-cyan-100/90">Tamanho das capas</h3>
        <div className="flex flex-wrap gap-2">{CARTAS.map(([id, nome]) => <button key={id} data-foco className="chip" data-ativa={tema.cartas === id} onClick={() => m({ cartas: id })}>{nome}</button>)}</div>
      </section>
      {botoesVirtuais && <BotoesVirtuais tema={tema} m={m} />}
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

type Tela = "conta" | "drive" | "gamebar" | "jogos" | "aparencia" | "modo" | "permissoes" | "atualizacoes" | "emuladores" | "sobre";
interface Item { id: Tela; icone: string; nome: string; titulo: string; detalhe: string }

/** Ajustes em seções: ícone grande + título no alto, dock para trocar de seção (o foco já troca) e o conteúdo logo abaixo. */
/** Controle: o analógico esquerdo rola a página e o direcional escolhe os itens. */
function OpcaoAnalogico() {
  const [ligado, setLigado] = useState(analogicoRola);
  return <Interruptor ligado={ligado} rotulo="Analógico esquerdo rola a página" detalhe="Com o controle, o analógico esquerdo sobe e desce a tela e só o direcional escolhe os itens. Desligado, os dois escolhem itens." aoMudar={(v) => { setLigado(v); definirAnalogicoRola(v); }} />;
}

export function Ajustes({ motor, aoMudarBiblioteca, avisar, atualizacao, tema, aoMudarTema, jogos, plats = [], ocultos, aoMostrarConsole, aoMostrarJogo }: { motor: Motor; aoMudarBiblioteca: () => void; avisar: Avisar; atualizacao: Atualizacao; tema: Tema; aoMudarTema: (t: Tema) => void; jogos: Jogo[]; plats?: ResumoPlataforma[]; ocultos?: Ocultos; aoMostrarConsole?: (id: string) => void; aoMostrarJogo?: (id: string) => void }) {
  const itens: Item[] = [
    ...(motor.conta ? [{ id: "conta" as const, icone: "conta", nome: "Conta", titulo: "Conta e saves na nuvem", detalhe: "Vetorial ID, licença e sincronização dos saves." }] : []),
    ...(motor.conta && motor.drive ? [{ id: "drive" as const, icone: "drive", nome: "Drive", titulo: "Vetorial Drive", detalhe: "Seu espaço na nuvem para documentos e ROMs, disponível em todos os apps da Vetorial." }] : []),
    { id: "jogos", icone: "jogos", nome: "Jogos", titulo: "Jogos e busca", detalhe: "Buscar jogos no aparelho, pastas, organização por console e faxina de repetidos." },
    { id: "aparencia", icone: "aparencia", nome: "Visual", titulo: "Personalização", detalhe: "Cor, brilho neon, fundo (foto, capa ou modelos), formato, botões do jogo e abertura." },
    { id: "permissoes", icone: "permissoes", nome: "Permissões", titulo: "Permissões", detalhe: "O que o Vortex precisa liberar no aparelho e por quê." },
    { id: "modo", icone: "modo", nome: "Modo Jogo", titulo: "Modo Jogo", detalhe: "Desempenho máximo enquanto você joga." },
    ...(motor.gameBar ? [{ id: "gamebar" as const, icone: "controles", nome: "Game Bar", titulo: "Game Bar", detalhe: "Barra com FPS, CPU, GPU e temperatura por cima do jogo, e modos Turbo, Normal e Econômico." }] : []),
    { id: "emuladores", icone: "emuladores", nome: "Emuladores", titulo: "Emuladores", detalhe: "Motores de emulação encontrados." },
    { id: "atualizacoes", icone: "atualizacoes", nome: "Atualizar", titulo: "Atualizações", detalhe: atualizacao.nova ? `Versão nova disponível: 1.${atualizacao.nova.numero}` : "Versão instalada e atualização automática." },
    { id: "sobre", icone: "sobre", nome: "Sobre", titulo: "Sobre e termos", detalhe: "Termos de uso e atalhos do controle." },
  ];
  const [tela, setTela] = useState<Tela>(itens[0].id);
  const atual = itens.find((i) => i.id === tela) ?? itens[0];
  useEffect(() => { document.documentElement.dataset.secao = "aj-" + atual.id; }, [atual.id]);
  return (
    <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-5 px-6 pb-16 sm:px-10">
      <div key={atual.id} className="ajustes-cab entrar grid justify-items-center gap-2 text-center">
        <Icone3D nome={atual.icone} tamanho={104} />
        <h2 className="titulo-neon text-3xl font-black">{atual.titulo}</h2>
        <p className="max-w-xl text-sm text-slate-300">{atual.detalhe}</p>
      </div>
      <Dock rotulo="Seções dos ajustes" itens={itens.map((i) => ({ id: i.id, nome: i.nome, icone: i.icone }))} ativo={atual.id} aoEscolher={(id) => setTela(id as Tela)} selecionarAoFocar />
      <div key={"c" + atual.id} className="entrar grid gap-6">
        {atual.id === "conta" && motor.conta && <ContaVetorial motor={motor} avisar={avisar} />}
        {atual.id === "drive" && motor.drive && <TelaDrive motor={motor} avisar={avisar} aoMudarBiblioteca={aoMudarBiblioteca} />}
        {atual.id === "jogos" && <TelaJogos motor={motor} avisar={avisar} aoMudarBiblioteca={aoMudarBiblioteca} plats={plats} ocultos={ocultos} aoMostrarConsole={aoMostrarConsole} jogos={jogos} aoMostrarJogo={aoMostrarJogo} />}
        {atual.id === "aparencia" && <TelaAparencia tema={tema} aoMudar={aoMudarTema} jogos={jogos} avisar={avisar} botoesVirtuais={Boolean(motor.visualControles)} />}
        {atual.id === "permissoes" && <Permissoes motor={motor} avisar={avisar} />}
        {atual.id === "modo" && <TelaModoJogo motor={motor} avisar={avisar} />}
        {atual.id === "gamebar" && <TelaGameBar motor={motor} avisar={avisar} />}
        {atual.id === "emuladores" && <TelaEmuladores motor={motor} />}
        {atual.id === "atualizacoes" && <TelaAtualizacoes motor={motor} avisar={avisar} atualizacao={atualizacao} />}
        {atual.id === "sobre" && (
          <div className="grid gap-4">
            <div><button data-foco className="botao" onClick={() => window.dispatchEvent(new CustomEvent("vortex:termos"))}>Ler os termos de uso</button></div>
            <OpcaoAnalogico />
            <p className="text-sm text-slate-400">Controle: direcional ou analógico move · A confirma · B volta · Y favorita · X atualiza a biblioteca · Start confere a versão do Vortex · LB/RB trocam de aba (a barra de baixo só responde a LB/RB). Teclado: setas ou WASD · Enter · Esc · F · Q/E.</p>
            <p className="text-sm text-slate-500">Vortex · Vetorial Tech{BUILD > 0 ? ` · versão 1.${BUILD}` : ""}</p>
          </div>
        )}
      </div>
    </div>
  );
}
