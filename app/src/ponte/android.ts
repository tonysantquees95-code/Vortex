import { registerPlugin } from "@capacitor/core";
import type { EmuladoresInfo, Estatisticas, Jogo, Motor, ModoJogoConfig, ResumoEscaneamento, ResumoPlataforma, ResultadoLancamento, RelatorioOrganizacao } from "./tipos";

/** Mesmo contrato do Rust, implementado em Java (plugin "Vortex"). */
interface PluginVortex {
  motor(opcoes: { comando: string; args: string }): Promise<{ resultado: string }>;
  escolherPasta(): Promise<{ pasta: string | null }>;
}
const Vortex = registerPlugin<PluginVortex>("Vortex");

export function motorAndroid(): Motor {
  const c = async <T>(comando: string, args: Record<string, unknown> = {}): Promise<T> => JSON.parse((await Vortex.motor({ comando, args: JSON.stringify(args) })).resultado) as T;
  return {
    plataforma: "android",
    pastas: () => c<string[]>("pastas"),
    escolherPasta: async () => (await Vortex.escolherPasta()).pasta,
    adicionarPasta: (pasta) => c<string[]>("adicionar_pasta", { pasta }),
    removerPasta: async (pasta) => { await c("remover_pasta", { pasta }); },
    escanear: () => c<ResumoEscaneamento>("escanear"),
    listar: (filtro = {}) => c<Jogo[]>("listar", { filtro }),
    continuar: (limite = 12) => c<Jogo[]>("continuar", { limite }),
    plataformas: () => c<ResumoPlataforma[]>("plataformas"),
    estatisticas: () => c<Estatisticas>("estatisticas"),
    favoritar: async (id, favorito) => { await c("favoritar", { id, favorito }); },
    emuladores: () => c<EmuladoresInfo>("emuladores"),
    preparar: (id) => c<{ nucleo: string; baixou: boolean }>("preparar_jogo", { id }),
    lancar: (id) => c<ResultadoLancamento>("lancar", { id }),
    modoJogo: (nova) => c<ModoJogoConfig>("modo_jogo_config", nova ? { configuracao: nova } : {}),
    organizar: (simulacao = false) => c<RelatorioOrganizacao>("organizar", { simulacao }),
    desfazerOrganizacao: () => c<{ devolvidos: number; falhas: string[] }>("organizar_desfazer"),
    recuperarModoJogo: async () => {},
  };
}
