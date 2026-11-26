// Login com o Vetorial ID (a mesma conta da Vênus, Vindex e Vortex).
import { SERVIDOR, chamar, ErroApi } from "./api";

export interface Sessao { token: string; email: string; nome: string }
export interface Aparelho { id: string; nome: string; plataforma: string }
export const SITE_DA_CONTA = `${SERVIDOR}/conta.html`;

const CHAVE_SESSAO = "voxix.sessao";
const CHAVE_APARELHO = "voxix.aparelho";

export const plataforma = (): "android" | "windows" | "web" => {
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean }; __TAURI_INTERNALS__?: unknown };
  if (w.Capacitor?.isNativePlatform?.()) return "android";
  if (w.__TAURI_INTERNALS__) return "windows";
  return "web";
};

export function aparelhoLocal(): Aparelho {
  try {
    const g = JSON.parse(localStorage.getItem(CHAVE_APARELHO) ?? "null") as Aparelho | null;
    if (g?.id) return g;
  } catch { /* sem armazenamento */ }
  const p = plataforma();
  const id = `voxix-${p}-${Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
  const a = { id, nome: p === "android" ? "Celular (Voxix)" : p === "windows" ? "Computador (Voxix)" : "Navegador (Voxix)", plataforma: p };
  try { localStorage.setItem(CHAVE_APARELHO, JSON.stringify(a)); } catch { /* ok */ }
  return a;
}

export function sessaoGuardada(): Sessao | null {
  try { const s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) ?? "null") as Sessao | null; return s?.token ? s : null; } catch { return null; }
}
export function guardarSessao(s: Sessao | null): void {
  try { if (s) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)); else localStorage.removeItem(CHAVE_SESSAO); } catch { /* ok */ }
}

export async function entrar(email: string, senha: string): Promise<Sessao> {
  const r = await chamar<{ token: string; usuario: { email: string; nome?: string } }>("POST", "/id/entrar", { email: email.trim(), senha, dispositivo: aparelhoLocal(), app: "voxix" });
  return { token: r.token, email: r.usuario.email, nome: r.usuario.nome ?? "" };
}

export async function sair(token: string): Promise<void> {
  try { await chamar("POST", "/id/sair", {}, token); } catch { /* já saiu */ }
}

/** O servidor recusou o login guardado (sessão encerrada, token vencido)? */
export const sessaoMorta = (e: unknown): boolean => e instanceof ErroApi && e.status === 401;
