import { registerPlugin } from "@capacitor/core";
import type { PedidoDaVenus, ContaVetorial, EstadoConta, RelatorioSaves, SaveNaNuvem, Controles, EmuladoresInfo, Estatisticas, Jogo, Motor, ModoJogoConfig, ResumoEscaneamento, ResumoPlataforma, ResultadoLancamento, RelatorioOrganizacao, VarreduraSistema, SugestaoIA, RevisaoFaxina, CentralEmuladores, SugestaoFaxina, RelatorioLimpeza, AppAndroid, ConfigGameBar, Oferta, Permissao, DriveVetorial, ListaDoDrive, ProgressoDoDrive } from "./tipos";

/** Mesmo contrato do Rust, implementado em Java (plugin "Vortex"). */
interface PluginVortex {
  motor(opcoes: { comando: string; args: string }): Promise<{ resultado: string }>;
  escolherPasta(): Promise<{ pasta: string | null }>;
  permissoes(): Promise<{ lista: Permissao[] }>;
  pedirPermissao(opcoes: { id: string }): Promise<void>;
  instalarAtualizacao(opcoes: { url: string; sha256: string }): Promise<void>;
  driveEscolher(): Promise<{ uri: string | null; nome?: string; bytes?: number }>;
  driveEnviar(opcoes: { uri: string; pasta: string; nome: string }): Promise<{ bytes: number }>;
  driveBaixar(opcoes: { pasta: string; nome: string }): Promise<{ caminho: string; pasta: string }>;
  driveCancelar(): Promise<void>;
  addListener(evento: "driveProgresso", f: (d: ProgressoDoDrive) => void): Promise<{ remove(): Promise<void> }>;
}
const Vortex = registerPlugin<PluginVortex>("Vortex");

export function motorAndroid(): Motor {
  const c = async <T>(comando: string, args: Record<string, unknown> = {}): Promise<T> => JSON.parse((await Vortex.motor({ comando, args: JSON.stringify(args) })).resultado) as T;
  const controles: Controles = {
    jogos: () => c("controle_jogos"),
    servicoAtivo: async () => (await c<{ servico: boolean }>("controle_estado")).servico,
    abrirAcessibilidade: async () => { await c("controle_abrir_acessibilidade"); },
    modelos: () => c("controle_modelos"),
    perfis: () => c("controle_perfis"),
    novo: (pacote, nome, modelo) => c("controle_novo", { pacote, nome, modelo }),
    apagar: async (id) => { await c("controle_apagar", { id }); },
    ativar: async (pacote, id) => { await c("controle_ativar", { pacote, id }); },
    jogar: async (pacote) => { await c("controle_jogar", { pacote }); },
    posicionar: async (pacote, id) => { await c("controle_editar", { pacote, id }); },
  };
  const conta: ContaVetorial = {
    estado: () => c<EstadoConta>("conta_estado"),
    entrar: async (email, senha) => { await c("conta_entrar", { email, senha, aparelho: "Celular Android" }); return c<EstadoConta>("conta_estado"); },
    sair: async () => { await c("conta_sair"); },
    sincronizar: (conflitos) => c<RelatorioSaves>("saves_sincronizar", conflitos ? { conflitos } : {}),
    pedir: <T>(metodo: "GET" | "POST" | "DELETE", caminho: string) => c<T>("conta_pedir", { metodo, caminho }),
    nuvem: async () => (await c<{ saves: SaveNaNuvem[] }>("saves_lista")).saves ?? [],
    fila: async () => (await c<{ pedidos: PedidoDaVenus[] }>("ponte_fila")).pedidos ?? [],
    responder: async (id, ok, resumo) => { await c("ponte_responder", { id, ok, resumo }); },
  };
  const drive: DriveVetorial = {
    lista: () => c<ListaDoDrive>("drive_lista"),
    escolher: async () => { const r = await Vortex.driveEscolher(); return r.uri ? { uri: r.uri, nome: r.nome ?? "arquivo", bytes: r.bytes ?? -1 } : null; },
    enviar: (uri, pasta, nome) => Vortex.driveEnviar({ uri, pasta, nome }),
    baixar: (pasta, nome) => Vortex.driveBaixar({ pasta, nome }),
    apagar: async (pasta, nome) => { await c("drive_apagar", { pasta, nome }); },
    cancelar: async () => { await Vortex.driveCancelar(); },
    aoProgredir: (f) => { const h = Vortex.addListener("driveProgresso", f); return () => { void h.then((x) => x.remove()); }; },
  };
  return {
    plataforma: "android",
    conta,
    drive,
    controles,
    permissoes: async () => (await Vortex.permissoes()).lista,
    pedirPermissao: async (id) => { await Vortex.pedirPermissao({ id }); },
    instalarAtualizacao: async (url, sha256) => { await Vortex.instalarAtualizacao({ url, sha256 }); },
    pastas: () => c<string[]>("pastas"),
    escolherPasta: async () => (await Vortex.escolherPasta()).pasta,
    adicionarPasta: (pasta) => c<string[]>("adicionar_pasta", { pasta }),
    removerPasta: async (pasta) => { await c("remover_pasta", { pasta }); },
    escanear: () => c<ResumoEscaneamento>("escanear"),
    central: () => c<CentralEmuladores>("central_emuladores"),
    faxinaIA: {
      revisar: () => c<RevisaoFaxina>("faxina_revisao"),
      sugerir: (r) => c<SugestaoFaxina>("faxina_ia", { parecidos: r.parecidos, suspeitos: r.suspeitos }),
      aplicar: (duplicados, corrompidos) => c<{ separados: number; falhas: string[] }>("faxina_ia_aplicar", { duplicados, corrompidos }),
    },
    sistema: {
      varrer: () => c<VarreduraSistema>("escanear_sistema"),
      ia: (v) => c<SugestaoIA>("sistema_ia", {
        pastas: v.varredura.candidatas.slice(0, 40).map((x) => ({ pasta: x.pasta, plataformas: x.plataformas, ambiguos: x.ambiguos, amostras: x.amostras })),
        aparelho: v.aparelho,
      }),
      decidirPlataforma: async (pasta, plataforma) => { await c("decidir_plataforma", { pasta, plataforma }); },
    },
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
    isolar: async (id) => { await c("isolar", { id }); },
    indiceCapas: (sistema) => c<string[]>("indice_capas", { sistema }),
    appsAndroid: () => c<AppAndroid[]>("apps_android"),
    abrirApp: async (pacote) => { await c("controle_jogar", { pacote }); },
    abrirNoVindex: async (pasta) => (await c<{ vindex: boolean }>("abrir_pasta", { pasta })).vindex,
    abrirUrl: async (url) => { await c("abrir_url", { url }); },
    visualControles: async (v) => { await c("visual_controles", { ...v }); },
    gameBar: (definir) => c<ConfigGameBar>("gamebar", definir ? { definir } : {}),
    limpar: (simulacao = false) => c<RelatorioLimpeza>("limpar", { simulacao }),
    organizar: (simulacao = false) => c<RelatorioOrganizacao>("organizar", { simulacao }),
    desfazerOrganizacao: () => c<{ devolvidos: number; falhas: string[] }>("organizar_desfazer"),
    recuperarModoJogo: async () => {},
  };
}
