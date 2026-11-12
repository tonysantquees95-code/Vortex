import type { EmuladoresInfo, Estatisticas, Jogo, Motor, ModoJogoConfig, ResumoEscaneamento, ResumoPlataforma, ResultadoLancamento } from "./tipos";

/** Windows: fala com o motor em Rust pelo comando "motor" do Tauri (o Rust acrescenta o caminho da biblioteca). */
export async function motorTauri(): Promise<Motor> {
  const { invoke } = await import("@tauri-apps/api/core");
  const { open } = await import("@tauri-apps/plugin-dialog");
  const c = <T>(comando: string, args: Record<string, unknown> = {}) => invoke<T>("motor", { comando, args });
  return {
    plataforma: "windows",
    pastas: () => c<string[]>("pastas"),
    escolherPasta: async () => {
      const r = await open({ directory: true, multiple: false });
      return typeof r === "string" ? r : null;
    },
    adicionarPasta: (pasta) => c<string[]>("adicionar_pasta", { pasta }),
    removerPasta: async (pasta) => { await c("remover_pasta", { pasta }); },
    escanear: () => c<ResumoEscaneamento>("escanear"),
    listar: (filtro = {}) => c<Jogo[]>("listar", { filtro }),
    continuar: (limite = 12) => c<Jogo[]>("continuar", { limite }),
    plataformas: () => c<ResumoPlataforma[]>("plataformas"),
    estatisticas: () => c<Estatisticas>("estatisticas"),
    favoritar: async (id, favorito) => { await c("favoritar", { id, favorito }); },
    emuladores: () => c<EmuladoresInfo>("emuladores"),
    lancar: (id) => c<ResultadoLancamento>("lancar", { id }),
    modoJogo: (nova) => c<ModoJogoConfig>("modo_jogo_config", nova ? { configuracao: nova } : {}),
    recuperarModoJogo: async () => { await c("modo_jogo_recuperar"); },
  };
}
