// Contrato do motor (vortex-core::api). Windows responde pelo Tauri; o modo demonstração roda no navegador.
export interface Jogo {
  id: string; titulo: string; plataforma: string; caminho: string; bytes: number;
  regioes: string[]; idiomas: string[]; tags: string[];
  capa: string | null; capa_online: string | null;
  descricao: string | null; desenvolvedor: string | null; editora: string | null; ano: number | null; genero: string | null; jogadores: string | null;
  adicionado: number; favorito: boolean; ultimo_jogo: number; tempo_total_s: number; sessoes: number; disponivel: boolean;
}
export interface ResumoPlataforma { id: string; nome: string; tipo: string; total: number }
export interface Estatisticas { jogos: number; plataformas: number; favoritos: number; tempo_total_s: number; sessoes: number }
export interface ResumoEscaneamento { encontrados: number; novos: number; atualizados: number; removidos: number; ignorados: number; pastas_ausentes: string[] }
export type Ordem = "titulo" | "recentes" | "mais_jogados" | "adicionados" | "ano";
export interface Filtro { texto?: string; plataforma?: string | null; so_favoritos?: boolean; ordem?: Ordem; limite?: number }
export interface ModoJogoConfig {
  ligado: boolean; prioridade_do_jogo: boolean; rebaixar_apps: boolean; pausar_atualizadores: boolean; liberar_ram: boolean;
  bloquear_notificacoes: boolean; energia_maxima: boolean; gpu_dedicada: boolean; manter_acordado: boolean;
  protegidos_extra: string[]; rebaixar_extra: string[];
}
export interface EmuladoresInfo { instalados: { id: string; nome: string; plataformas: string[] }[] }
export interface ResultadoLancamento { pid: number; emulador: string; nucleo: string | null; modo_jogo: boolean }

export interface Motor {
  plataforma: "windows" | "android" | "demo";
  pastas(): Promise<string[]>;
  escolherPasta(): Promise<string | null>;
  adicionarPasta(pasta: string): Promise<string[]>;
  removerPasta(pasta: string): Promise<void>;
  escanear(): Promise<ResumoEscaneamento>;
  listar(filtro?: Filtro): Promise<Jogo[]>;
  continuar(limite?: number): Promise<Jogo[]>;
  plataformas(): Promise<ResumoPlataforma[]>;
  estatisticas(): Promise<Estatisticas>;
  favoritar(id: string, favorito: boolean): Promise<void>;
  emuladores(): Promise<EmuladoresInfo>;
  lancar(id: string): Promise<ResultadoLancamento>;
  modoJogo(nova?: ModoJogoConfig): Promise<ModoJogoConfig>;
  recuperarModoJogo(): Promise<void>;
}
