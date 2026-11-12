import type { PedidoDaVenus, ContaVetorial, EstadoConta, RelatorioSaves, EmuladoresInfo, Estatisticas, Jogo, Motor, ModoJogoConfig, ResumoEscaneamento, ResumoPlataforma, ResultadoLancamento, RelatorioOrganizacao, RelatorioLimpeza, Oferta } from "./tipos";

/** Windows: fala com o motor em Rust pelo comando "motor" do Tauri (o Rust acrescenta o caminho da biblioteca). */
export async function motorTauri(): Promise<Motor> {
  const { invoke } = await import("@tauri-apps/api/core");
  const { open } = await import("@tauri-apps/plugin-dialog");
  const c = <T>(comando: string, args: Record<string, unknown> = {}) => invoke<T>("motor", { comando, args });
  const conta: ContaVetorial = {
    estado: () => c<EstadoConta>("conta_estado"),
    entrar: async (email, senha) => { await c("conta_entrar", { email, senha, aparelho: "Computador Windows" }); return c<EstadoConta>("conta_estado"); },
    sair: async () => { await c("conta_sair"); },
    sincronizar: (conflitos) => c<RelatorioSaves>("saves_sincronizar", conflitos ? { conflitos } : {}),
    fila: async () => (await c<{ pedidos: PedidoDaVenus[] }>("ponte_fila")).pedidos ?? [],
    responder: async (id, ok, resumo) => { await c("ponte_responder", { id, ok, resumo }); },
  };
  return {
    plataforma: "windows",
    conta,
    permissoes: async () => [],
    pedirPermissao: async () => {},
    instalarAtualizacao: async (url, sha256) => { await invoke("instalar_atualizacao", { url, sha256 }); },
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
    preparar: (id) => c<{ nucleo: string; baixou: boolean }>("preparar_jogo", { id }),
    lojaCatalogo: () => c<Oferta[]>("loja_catalogo"),
    lojaInstalar: (id) => c<{ instalado: boolean; jogo_id: string | null }>("loja_instalar", { id }),
    lancar: (id) => c<ResultadoLancamento>("lancar", { id }),
    modoJogo: (nova) => c<ModoJogoConfig>("modo_jogo_config", nova ? { configuracao: nova } : {}),
    limpar: (simulacao = false) => c<RelatorioLimpeza>("limpar", { simulacao }),
    organizar: (simulacao = false) => c<RelatorioOrganizacao>("organizar", { simulacao }),
    desfazerOrganizacao: () => c<{ devolvidos: number; falhas: string[] }>("organizar_desfazer"),
    recuperarModoJogo: async () => { await c("modo_jogo_recuperar"); },
  };
}
