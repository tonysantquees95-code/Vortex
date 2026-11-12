import { useEffect, useState } from "react";
import type { EmuladoresInfo, ModoJogoConfig, Motor } from "../ponte";
import { Interruptor } from "./pecas";

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

export function Ajustes({ motor, aoMudarBiblioteca, avisar }: { motor: Motor; aoMudarBiblioteca: () => void; avisar: (t: string) => void }) {
  const [pastas, setPastas] = useState<string[]>([]);
  const [modo, setModo] = useState<ModoJogoConfig | null>(null);
  const [emu, setEmu] = useState<EmuladoresInfo | null>(null);
  const [ocupado, setOcupado] = useState(false);

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
  const mudar = async (campo: keyof ModoJogoConfig, v: boolean) => {
    if (!modo) return;
    try { setModo(await motor.modoJogo({ ...modo, [campo]: v })); } catch (e) { avisar(String(e)); }
  };

  return (
    <div className="entrar mx-auto grid max-w-4xl gap-8 px-10 pb-16">
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
        <div className="grid gap-3">{modo ? OPCOES.map(([k, r, d]) => <Interruptor key={k} ligado={Boolean(modo[k])} rotulo={r} detalhe={d} aoMudar={(v) => mudar(k, v)} />) : <p className="text-slate-400">Carregando…</p>}</div>
      </section>
      <section>
        <h3 className="mb-3 text-lg font-bold text-cyan-100/90">Emuladores encontrados</h3>
        <div className="vidro grid gap-2 p-4">
          {emu?.instalados.length ? emu.instalados.map((e) => <div key={e.id}><span className="font-semibold">{e.nome}</span> <span className="text-sm text-slate-400">· {e.plataformas.length} plataformas</span></div>) : <p className="text-slate-400">Nenhum emulador encontrado ainda. Instale o RetroArch e o Vortex acha sozinho.</p>}
        </div>
      </section>
      <section className="text-sm text-slate-500">Controle: direcional ou analógico move · A confirma · B volta · Y favorita · LB/RB trocam de aba. Teclado: setas ou WASD · Enter · Esc · F · Q/E.</section>
    </div>
  );
}
