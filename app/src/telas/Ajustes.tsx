import { useEffect, useState } from "react";
import type { EmuladoresInfo, EstadoConta, ModoJogoConfig, Motor } from "../ponte";
import { atualizarSozinho, definirAtualizarSozinho, definirOrganizarAutomatico, organizarAutomatico } from "../config";
import { BUILD } from "../atualizacao";
import type { Atualizacao } from "../useAtualizacao";
import { Interruptor } from "./pecas";

function ContaVetorial({ motor, avisar }: { motor: Motor; avisar: (t: string) => void }) {
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

export function Ajustes({ motor, aoMudarBiblioteca, avisar, atualizacao }: { motor: Motor; aoMudarBiblioteca: () => void; avisar: (t: string) => void; atualizacao: Atualizacao }) {
  const [autoAtualizar, setAutoAtualizar] = useState(atualizarSozinho);
  const [pastas, setPastas] = useState<string[]>([]);
  const [modo, setModo] = useState<ModoJogoConfig | null>(null);
  const [emu, setEmu] = useState<EmuladoresInfo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [auto, setAuto] = useState(organizarAutomatico);

  useEffect(() => {
    motor.pastas().then(setPastas).catch(() => {});
    motor.modoJogo().then(setModo).catch(() => {});
    motor.emuladores().then(setEmu).catch(() => {});
  }, [motor]);

  const escanear = async () => {
    setOcupado(true);
    try {
      const r = await motor.escanear();
      avisar(`${r.encontrados} jogos encontrados · ${r.novos} novos${r.removidos ? ` · ${r.removidos} removidos` : ""}`);
      aoMudarBiblioteca();
    } catch (e) { avisar(String(e)); } finally { setOcupado(false); }
  };
  const adicionar = async () => {
    const p = await motor.escolherPasta();
    if (!p) return;
    try { setPastas(await motor.adicionarPasta(p)); await escanear(); } catch (e) { avisar(String(e)); }
  };
  const remover = async (p: string) => {
    try { await motor.removerPasta(p); setPastas(await motor.pastas()); aoMudarBiblioteca(); } catch (e) { avisar(String(e)); }
  };
  const organizarAgora = async () => {
    setOcupado(true);
    try {
      const r = await motor.organizar();
      avisar(r.organizados.length ? `${r.organizados.length} jogos organizados em ${r.pasta_vortex}` : "Nenhum jogo solto encontrado.");
      if (r.falhas.length) avisar(`${r.organizados.length} organizados · ${r.falhas.length} com problema`);
      setPastas(await motor.pastas());
      aoMudarBiblioteca();
    } catch (e) { avisar(String(e)); } finally { setOcupado(false); }
  };
  const desfazer = async () => {
    setOcupado(true);
    try {
      const r = await motor.desfazerOrganizacao();
      avisar(`${r.devolvidos} arquivos devolvidos ao lugar de origem`);
      aoMudarBiblioteca();
    } catch (e) { avisar(String(e)); } finally { setOcupado(false); }
  };
  const mudar = async (campo: keyof ModoJogoConfig, v: boolean) => {
    if (!modo) return;
    try { setModo(await motor.modoJogo({ ...modo, [campo]: v })); } catch (e) { avisar(String(e)); }
  };

  return (
    <div className="entrar mx-auto grid max-w-4xl gap-8 px-10 pb-16">
      {motor.conta && (
        <section>
          <h3 className="mb-3 text-lg font-bold text-cyan-100/90">Conta Vetorial ID e saves na nuvem</h3>
          <ContaVetorial motor={motor} avisar={avisar} />
        </section>
      )}
      <section>
        <h3 className="mb-3 text-lg font-bold text-cyan-100/90">Organização automática</h3>
        <div className="grid gap-3">
          <Interruptor ligado={auto} rotulo="Achar e organizar jogos sozinho" detalhe="Ao abrir, o Vortex procura jogos retrô soltos (Downloads, Documentos, pastas de ROMs), descompacta e guarda cada um na pasta do console." aoMudar={(v) => { setAuto(v); definirOrganizarAutomatico(v); }} />
          <div className="flex flex-wrap gap-3">
            <button data-foco className="botao primario" disabled={ocupado} onClick={organizarAgora}>⚡ Organizar agora</button>
            <button data-foco className="botao" disabled={ocupado} onClick={desfazer}>↶ Desfazer a organização</button>
          </div>
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-lg font-bold text-cyan-100/90">Pastas de jogos</h3>
        <div className="grid gap-3">
          {pastas.map((p) => (
            <button key={p} data-foco className="linha" onClick={() => remover(p)} title="Tirar esta pasta">
              <span className="truncate">{p}</span><span className="text-sm text-rose-300">Remover</span>
            </button>
          ))}
          <div className="flex flex-wrap gap-3">
            <button data-foco className="botao primario" onClick={adicionar}>＋ Adicionar pasta</button>
            <button data-foco className="botao" disabled={ocupado} onClick={escanear}>{ocupado ? "Procurando…" : "↻ Procurar jogos de novo"}</button>
          </div>
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-lg font-bold text-cyan-100/90">Modo Jogo</h3>
        {motor.plataforma === "android" && <p className="mb-3 text-sm text-slate-400">No Android o Modo Jogo ainda não mexe no aparelho; as opções ficam guardadas para quando o recurso chegar.</p>}
        <div className="grid gap-3">{modo ? OPCOES.map(([k, r, d]) => <Interruptor key={k} ligado={Boolean(modo[k])} rotulo={r} detalhe={d} aoMudar={(v) => mudar(k, v)} />) : <p className="text-slate-400">Carregando…</p>}</div>
      </section>
      <section>
        <h3 className="mb-3 text-lg font-bold text-cyan-100/90">Emuladores encontrados</h3>
        <div className="vidro grid gap-2 p-4">
          {emu?.instalados.length ? emu.instalados.map((e) => <div key={e.id}><span className="font-semibold">{e.nome}</span> <span className="text-sm text-slate-400">· {e.plataformas.length} plataformas</span></div>) : <p className="text-slate-400">Nenhum emulador encontrado ainda. Instale o RetroArch e o Vortex acha sozinho.</p>}
        </div>
      </section>
      {motor.plataforma !== "demo" && (
        <section>
          <h3 className="mb-3 text-lg font-bold text-cyan-100/90">Atualizações</h3>
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
        </section>
      )}
      <section>
        <button data-foco className="botao" onClick={() => window.dispatchEvent(new CustomEvent("vortex:termos"))}>Ler os termos de uso</button>
      </section>
      <section className="text-sm text-slate-500">Controle: direcional ou analógico move · A confirma · B volta · Y favorita · LB/RB trocam de aba. Teclado: setas ou WASD · Enter · Esc · F · Q/E.</section>
    </div>
  );
}
