// Conversa com o servidor da Vênus (Vetorial ID + rotas /voxix).
export const SERVIDOR = "https://venus-servidor.tonysantquees95.workers.dev";

export class ErroApi extends Error {
  codigo: string;
  status: number;
  constructor(mensagem: string, codigo = "", status = 0) {
    super(mensagem);
    this.codigo = codigo;
    this.status = status;
  }
}

export async function chamar<T>(metodo: string, caminho: string, corpo?: unknown, token?: string, tempoMs = 20000): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${SERVIDOR}${caminho}`, {
      method: metodo,
      headers: { ...(corpo === undefined ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(tempoMs),
    });
  } catch {
    throw new ErroApi("Sem conexão com o servidor. Confira a internet.", "sem_rede");
  }
  const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new ErroApi(String(d.error ?? `Erro ${r.status}`), String(d.codigo ?? ""), r.status);
  return d as T;
}

export type Presenca = "amigos" | "todos" | "invisivel";
export interface Perfil { apelido: string | null; nome?: string; nomeSugerido?: string; avatar?: string | null; presenca?: Presenca; proximaTroca?: number | null }
export interface PerfilPublico { apelido: string; nome: string; avatar?: string | null; conquistas: { id: string; nome: string }[]; maisJogados: { jogo: string; horas: number }[]; jogandoAgora: { jogo: string; plataforma: string; desde: number } | null }
export interface Pessoa { apelido: string; nome: string; avatar?: string | null }
export interface ItemDoHistorico { id: string; minha: boolean; apelido: string; nome: string; corpo: string; tipo: string; criado: number }
export interface MensagemDoServidor { id: string; de: string; deNome: string; conversa: string; corpo: string; tipo: string; criado: number }

export interface Comunidade { id: string; nome: string; descricao: string; icone: string; publica: boolean; membros: number; cargo?: "dono" | "membro" }
export interface SalaInfo { id: string; nome: string }
export interface ComunidadeDetalhe extends Comunidade { salas: SalaInfo[]; codigo?: string }
export interface Membro { apelido: string; nome: string; cargo: string }
/** Link de convite: abre uma página com o código; quem recebe cola o link (ou só o código) em Comunidades › Entrar. */
export const linkDoConvite = (codigo: string): string => `${SERVIDOR}/voxix/entrar/${codigo}`;

export const api = {
  minhasComunidades: (t: string) => chamar<{ comunidades: Comunidade[] }>("GET", "/voxix/comunidades", undefined, t),
  comunidadesPublicas: (t: string, q: string) => chamar<{ comunidades: Comunidade[] }>("GET", `/voxix/comunidades/publicas?q=${encodeURIComponent(q)}`, undefined, t),
  criarComunidade: (t: string, d: { nome: string; descricao: string; publica: boolean; icone: string }) => chamar<ComunidadeDetalhe>("POST", "/voxix/comunidades", d, t),
  comunidade: (t: string, id: string) => chamar<ComunidadeDetalhe>("GET", `/voxix/comunidades/${id}`, undefined, t),
  previaDoConvite: (t: string, convite: string) => chamar<Comunidade>("GET", `/voxix/convites/${encodeURIComponent(convite)}`, undefined, t),
  entrarPorConvite: (t: string, codigo: string) => chamar<ComunidadeDetalhe>("POST", "/voxix/comunidades/entrar", { codigo }, t),
  entrarNaPublica: (t: string, id: string) => chamar<ComunidadeDetalhe>("POST", `/voxix/comunidades/${id}/entrar`, {}, t),
  sairDaComunidade: (t: string, id: string) => chamar("POST", `/voxix/comunidades/${id}/sair`, {}, t),
  apagarComunidade: (t: string, id: string) => chamar("DELETE", `/voxix/comunidades/${id}`, undefined, t),
  trocarCodigo: (t: string, id: string) => chamar<{ codigo: string }>("POST", `/voxix/comunidades/${id}/codigo`, {}, t),
  membros: (t: string, id: string) => chamar<{ membros: Membro[] }>("GET", `/voxix/comunidades/${id}/membros`, undefined, t),
  expulsar: (t: string, id: string, apelido: string) => chamar("DELETE", `/voxix/comunidades/${id}/membros/${encodeURIComponent(apelido)}`, undefined, t),
  criarSala: (t: string, id: string, nome: string) => chamar<SalaInfo>("POST", `/voxix/comunidades/${id}/salas`, { nome }, t),
  apagarSala: (t: string, id: string, sala: string) => chamar("DELETE", `/voxix/comunidades/${id}/salas/${sala}`, undefined, t),
  perfil: (t: string) => chamar<Perfil>("GET", "/voxix/perfil", undefined, t),
  criarPerfil: (t: string, apelido: string, nome: string) => chamar<Pessoa>("PUT", "/voxix/perfil", { apelido, nome }, t),
  buscar: (t: string, apelido: string) => chamar<Pessoa>("GET", `/voxix/buscar?apelido=${encodeURIComponent(apelido)}`, undefined, t),
  enviar: (t: string, para: string, corpo: string, idLocal: string) => chamar<{ ok: boolean; id: string; criado: number }>("POST", "/voxix/mensagens", { para, corpo, idLocal }, t),
  historico: (t: string, desde: number, limite = 300) => chamar<{ mensagens: ItemDoHistorico[]; mais: boolean }>("GET", `/voxix/historico?desde=${desde}&limite=${limite}`, undefined, t, 30000),
  limparConversa: (t: string, apelido: string) => chamar("DELETE", `/voxix/conversas/${encodeURIComponent(apelido)}`, undefined, t),
  pontuar: (t: string, texto: string) => chamar<{ texto: string; ajustado: boolean }>("POST", "/voxix/pontuar", { texto }, t),
  definirAvatar: (t: string, avatar: string | null) => chamar<{ avatar: string | null }>("PUT", "/voxix/perfil/avatar", { avatar }, t),
  avatares: (t: string, apelidos: string[]) => chamar<{ avatares: Record<string, string | null> }>("GET", `/voxix/avatares?apelidos=${encodeURIComponent(apelidos.join(","))}`, undefined, t),
  trocarApelido: (t: string, apelido: string) => chamar<{ apelido: string; proximaTroca: number | null }>("PUT", "/voxix/perfil/apelido", { apelido }, t),
  definirPresenca: (t: string, presenca: Presenca) => chamar<{ presenca: Presenca }>("PUT", "/voxix/privacidade", { presenca }, t),
  pessoa: (t: string, apelido: string) => chamar<PerfilPublico>("GET", `/voxix/pessoas/${encodeURIComponent(apelido)}`, undefined, t),
  bloqueios: (t: string) => chamar<{ bloqueios: Pessoa[] }>("GET", "/voxix/bloqueios", undefined, t),
  bloquear: (t: string, apelido: string) => chamar("POST", "/voxix/bloqueios", { apelido }, t),
  desbloquear: (t: string, apelido: string) => chamar("DELETE", `/voxix/bloqueios/${encodeURIComponent(apelido)}`, undefined, t),
  denunciar: (t: string, apelido: string, motivo: string, trecho?: string) => chamar("POST", "/voxix/denuncias", { apelido, motivo, trecho }, t),
};

/** Endereço do WebSocket. Pede um código de uso único (vale 60 s) para o token de login não ir na URL; se o servidor for antigo, usa o token. */
async function enderecoSeguro(token: string, caminho: string): Promise<string> {
  const base = `${SERVIDOR.replace(/^http/, "ws")}${caminho}`;
  try {
    const r = await chamar<{ ticket?: string }>("POST", "/voxix/ticket", {}, token, 8000);
    if (r.ticket) return `${base}?ticket=${encodeURIComponent(r.ticket)}`;
  } catch { /* servidor sem código de uso único ou sem rede: segue com o jeito antigo */ }
  return `${base}?token=${encodeURIComponent(token)}`;
}

/** Endereço do chat ao vivo. */
export const enderecoWs = (token: string): Promise<string> => enderecoSeguro(token, "/voxix/ws");

/** Endereço da sala ao vivo. */
export const enderecoDaSala = (token: string, sala: string): Promise<string> => enderecoSeguro(token, `/voxix/salas/${sala}/ws`);
