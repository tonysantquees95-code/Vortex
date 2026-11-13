// Contrato do motor (vortex-core::api). Windows responde pelo Tauri; o modo demonstração roda no navegador.
export interface Jogo {
  id: string; titulo: string; plataforma: string; caminho: string; bytes: number;
  regioes: string[]; idiomas: string[]; tags: string[];
  capa: string | null; capa_online: string | null; nome_interno?: string; id_jogo?: string;
  descricao: string | null; desenvolvedor: string | null; editora: string | null; ano: number | null; genero: string | null; jogadores: string | null;
  adicionado: number; favorito: boolean; ultimo_jogo: number; tempo_total_s: number; sessoes: number; disponivel: boolean;
}
/** Faxina: cópias repetidas vão para a pasta "Duplicados" e arquivos quebrados para "Corrompidos" (nada é apagado). */
export interface RelatorioLimpeza { duplicados: string[]; corrompidos: string[]; falhas: string[]; simulacao: boolean }
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
export interface SaveNaNuvem { jogo: string; arquivo: string; bytes: number; atualizado: number; dispositivo: string }
export interface RelatorioSaves { enviados: number; baixados: number; conflitos: string[]; falhas: string[] }
/** Conta Vetorial ID: licença do Vortex e saves na nuvem. */
export interface ContaVetorial {
  estado(): Promise<EstadoConta>;
  entrar(email: string, senha: string): Promise<EstadoConta>;
  sair(): Promise<void>;
  sincronizar(conflitos?: "local" | "nuvem"): Promise<RelatorioSaves>;
  /** Jogos que têm save na conta (de qualquer aparelho). */
  nuvem(): Promise<SaveNaNuvem[]>;
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
export interface AppAndroid { pacote: string; nome: string; icone: string }
/** Game Bar (só Android): barra de status por cima do jogo. */
export type PosicaoGameBar = "oculta" | "topo" | "base" | "esquerda" | "direita";
export type ModoDesempenho = "economico" | "normal" | "turbo";
export interface ConfigGameBar {
  ligada: boolean; posicao: PosicaoGameBar; modo: ModoDesempenho; /** taxa de atualização da tela em Hz (0 = automática) */ taxa?: number;
  fps: boolean; cpu: boolean; gpu: boolean; ram: boolean; temp: boolean; bateria: boolean;
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
  falhas: string[]; simulacao: boolean; pasta_vortex: string; origens?: string[];
}

export interface Oferta {
  id: string; titulo: string; plataforma: string; autor: string; descricao: string; licenca: string; site: string;
  url: string; sha256: string; bytes: number; instalado: boolean; jogo_id: string | null;
}

export interface VisualControles { cor: string; cor2: string; modelo: string; tamanho: string; opacidade: number }

export interface Motor {
  plataforma: "windows" | "android" | "demo";
  /** Só no Android: nomes de capas que existem na Libretro para um sistema (para achar a capa mesmo com o nome do arquivo diferente). */
  indiceCapas?(sistema: string): Promise<string[]>;
  /** Só no Android: jogos instalados no aparelho (biblioteca "Android"). */
  appsAndroid?(): Promise<AppAndroid[]>;
  /** Só no Android: abre um app/jogo instalado. */
  abrirApp?(pacote: string): Promise<void>;
  /** Só no Android: abre o Vindex direto numa pasta. false = o Vindex não está instalado. */
  abrirNoVindex?(pasta: string): Promise<boolean>;
  /** Abre um endereço https no navegador do sistema. */
  abrirUrl(url: string): Promise<void>;
  /** Só no Android: aparência dos botões virtuais da tela do jogo (cor do sistema, modelo, tamanho). */
  visualControles?(v: VisualControles): Promise<void>;
  /** Só no Android: Game Bar. */
  gameBar?(definir?: Partial<ConfigGameBar>): Promise<ConfigGameBar>;
  /** Só no Android: controle para jogos que não têm suporte. */
  controles?: Controles;
  /** Só no Windows: jogos de PC (Steam e Epic já instaladas, programas escolhidos à mão). */
  pc?: { importar(): Promise<{ steam: number; epic: number; novos: number }>; adicionar(): Promise<boolean> };
  /** Windows e Android: entrar com o Vetorial ID e sincronizar saves. */
  conta?: ContaVetorial;
  /** Permissões do aparelho (no Windows não há nenhuma a pedir). */
  permissoes(): Promise<Permissao[]>;
  /** Abre a tela do sistema onde a pessoa libera a permissão. */
  pedirPermissao(id: string): Promise<void>;
  /** Baixa o instalador da versão nova (só do GitHub, com SHA-256) e instala. */
  instalarAtualizacao(url: string, sha256: string): Promise<void>;
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
  /** Deixa um jogo só por título e tira os arquivos quebrados da biblioteca. Com simulação só conta. */
  limpar(simulacao?: boolean): Promise<RelatorioLimpeza>;
  /** Tira da biblioteca um jogo que não abriu e guarda o arquivo na pasta Corrompidos. */
  isolar(id: string): Promise<void>;
  organizar(simulacao?: boolean): Promise<RelatorioOrganizacao>;
  desfazerOrganizacao(): Promise<{ devolvidos: number; falhas: string[] }>;
}

/** Permissão do aparelho que o Vortex precisa (ou pode usar). */
export interface Permissao { id: string; titulo: string; motivo: string; obrigatoria: boolean; concedida: boolean }
