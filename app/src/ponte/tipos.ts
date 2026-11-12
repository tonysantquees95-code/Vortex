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
export interface PerfilControle {
  id: string; pacote: string; nome: string;
  direcional: { cx: number; cy: number; raio: number };
  botoes: { tecla: string; x: number; y: number }[];
}
export interface ModeloControle { modelo: string; nome: string; descricao: string }
export interface EstadoConta { logado: boolean; email?: string; vortex: boolean; mensagem?: string; offline?: boolean }
export interface PedidoDaVenus { id: string; comando: "abrir_jogo" | "otimizar"; argumento: string }
export interface RelatorioSaves { enviados: number; baixados: number; conflitos: string[]; falhas: string[] }
/** Conta Vetorial ID: licença do Vortex e saves na nuvem. */
export interface ContaVetorial {
  estado(): Promise<EstadoConta>;
  entrar(email: string, senha: string): Promise<EstadoConta>;
  sair(): Promise<void>;
  sincronizar(conflitos?: "local" | "nuvem"): Promise<RelatorioSaves>;
  /** Ponte de voz: pedidos que a Vênus fez para este aparelho (perguntar também avisa que o Vortex está aberto). */
  fila(): Promise<PedidoDaVenus[]>;
  responder(id: string, ok: boolean, resumo: string): Promise<void>;
}
export interface Controles {
  jogos(): Promise<{ pacote: string; nome: string }[]>;
  servicoAtivo(): Promise<boolean>;
  abrirAcessibilidade(): Promise<void>;
  modelos(): Promise<ModeloControle[]>;
  perfis(): Promise<{ perfis: PerfilControle[]; ativos: Record<string, string> }>;
  novo(pacote: string, nome: string, modelo: string): Promise<PerfilControle>;
  apagar(id: string): Promise<void>;
  ativar(pacote: string, id: string): Promise<void>;
  jogar(pacote: string): Promise<void>;
  /** Abre o jogo e mostra os pontos do perfil por cima dele, para arrastar até os botões. */
  posicionar(pacote: string, id: string): Promise<void>;
}
export interface Filtro { texto?: string; plataforma?: string | null; so_favoritos?: boolean; ordem?: Ordem; limite?: number }
export interface ModoJogoConfig {
  ligado: boolean; prioridade_do_jogo: boolean; rebaixar_apps: boolean; pausar_atualizadores: boolean; liberar_ram: boolean;
  bloquear_notificacoes: boolean; energia_maxima: boolean; gpu_dedicada: boolean; manter_acordado: boolean;
  protegidos_extra: string[]; rebaixar_extra: string[];
}
export interface EmuladoresInfo { instalados: { id: string; nome: string; plataformas: string[] }[] }
export interface ResultadoLancamento { pid: number; emulador: string; nucleo: string | null; modo_jogo: boolean }

export interface RelatorioOrganizacao {
  organizados: { origem: string; destino: string; plataforma: string; extraido: boolean }[];
  falhas: string[]; simulacao: boolean; pasta_vortex: string;
}

export interface Oferta {
  id: string; titulo: string; plataforma: string; autor: string; descricao: string; licenca: string; site: string;
  url: string; sha256: string; bytes: number; instalado: boolean; jogo_id: string | null;
}

export interface Motor {
  plataforma: "windows" | "android" | "demo";
  /** Só no Android: controle para jogos que não têm suporte. */
  controles?: Controles;
  /** Windows e Android: entrar com o Vetorial ID e sincronizar saves. */
  conta?: ContaVetorial;
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
  /** Garante o motor do console (baixa só na primeira vez). */
  preparar(id: string): Promise<{ nucleo: string; baixou: boolean }>;
  lojaCatalogo(): Promise<Oferta[]>;
  /** Baixa em segundo plano, confere, descompacta e guarda na pasta do console. */
  lojaInstalar(id: string): Promise<{ instalado: boolean; jogo_id: string | null }>;
  lancar(id: string): Promise<ResultadoLancamento>;
  modoJogo(nova?: ModoJogoConfig): Promise<ModoJogoConfig>;
  recuperarModoJogo(): Promise<void>;
  /** Procura jogos soltos no aparelho, identifica o console, descompacta e guarda na pasta do Vortex (uma pasta por console). */
  organizar(simulacao?: boolean): Promise<RelatorioOrganizacao>;
  desfazerOrganizacao(): Promise<{ devolvidos: number; falhas: string[] }>;
}
