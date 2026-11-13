import nacl from "./vendor/nacl.js";

/**
 * Trava de segurança: o servidor entrega um "selo" assinado (Ed25519) com o estado da licença. Aqui ele é
 * conferido SEM internet, com a chave pública embutida: editar o selo, trocar o tempo de teste ou inventar um
 * selo derruba a assinatura. Sem selo válido o aplicativo não abre.
 */
export const CHAVE_PUBLICA_DO_SELO: string = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SELO_CHAVE ?? "";
const TOLERANCIA_RELOGIO_MS = 10 * 60_000;

export interface Selo { v: number; u: string; em: string; d: string; ac: boolean; teste: boolean; fim: number; iat: number; exp: number }
export type Estado =
  | { tipo: "livre"; teste: boolean; fim: number; diasRestantes: number }
  | { tipo: "teste_acabou"; fim: number }
  | { tipo: "validar_online"; motivo: "sem_selo" | "vencido" | "relogio" | "invalido" };

const deB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const utf8 = (s: string) => new TextEncoder().encode(s);

/** Confere assinatura e devolve o conteúdo (ou null se for falso/ilegível). Não olha datas. */
export function lerSelo(texto: string | null | undefined, chave: string = CHAVE_PUBLICA_DO_SELO): Selo | null {
  const [p, a] = String(texto ?? "").split(".");
  if (!p || !a) return null;
  try {
    if (!nacl.sign.detached.verify(utf8(p), deB64u(a), deB64u(chave))) return null;
    const c = JSON.parse(new TextDecoder().decode(deB64u(p))) as Selo;
    return c && c.v === 1 && typeof c.exp === "number" ? c : null;
  } catch {
    return null;
  }
}

/**
 * Decide se o aplicativo pode abrir. `visto` é o maior horário já observado neste aparelho: se o relógio
 * voltou além da tolerância (tentativa de esticar o teste), exige falar com o servidor.
 */
export function avaliar(texto: string | null | undefined, agora: number, visto: number, usuarioId?: string, chave?: string): Estado {
  if (!texto) return { tipo: "validar_online", motivo: "sem_selo" };
  const s = lerSelo(texto, chave);
  if (!s || (usuarioId && s.u !== usuarioId)) return { tipo: "validar_online", motivo: "invalido" };
  if (agora < visto - TOLERANCIA_RELOGIO_MS || agora < s.iat - TOLERANCIA_RELOGIO_MS) return { tipo: "validar_online", motivo: "relogio" };
  if (!s.ac || (s.fim > 0 && agora >= s.fim)) return { tipo: "teste_acabou", fim: s.fim };
  if (agora >= s.exp) return { tipo: "validar_online", motivo: "vencido" };
  return { tipo: "livre", teste: s.teste, fim: s.fim, diasRestantes: Math.max(0, Math.ceil((s.fim - agora) / 86_400_000)) };
}
