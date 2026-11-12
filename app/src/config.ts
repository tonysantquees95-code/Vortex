// Preferências simples guardadas no próprio aparelho (nunca quebra se o armazenamento do navegador estiver bloqueado).
const CHAVE = "vortex:organizar-auto";

export function organizarAutomatico(): boolean {
  try { return localStorage.getItem(CHAVE) !== "0"; } catch { return true; }
}

export function definirOrganizarAutomatico(v: boolean) {
  try { localStorage.setItem(CHAVE, v ? "1" : "0"); } catch { /* sem armazenamento: vale só nesta sessão */ }
}

const CHAVE_ATUALIZAR = "vortex:atualizar-sozinho";
const CHAVE_CONFERIDO = "vortex:atualizacao-conferida";

/** Atualizar sozinho quando sair versão nova (ligado por padrão). */
export function atualizarSozinho(): boolean {
  try { return localStorage.getItem(CHAVE_ATUALIZAR) !== "0"; } catch { return true; }
}
export function definirAtualizarSozinho(v: boolean) {
  try { localStorage.setItem(CHAVE_ATUALIZAR, v ? "1" : "0"); } catch { /* vale só nesta sessão */ }
}
export function ultimaConferencia(): number {
  try { return Number(localStorage.getItem(CHAVE_CONFERIDO)) || 0; } catch { return 0; }
}
export function anotarConferencia(t: number) {
  try { localStorage.setItem(CHAVE_CONFERIDO, String(t)); } catch { /* sem armazenamento */ }
}

const CHAVE_CONFIGURADO = "vortex:configurado";
/** A configuração inicial (permissões, jogos, aparência, conta) já foi feita? */
export function configurado(): boolean {
  try { return localStorage.getItem(CHAVE_CONFIGURADO) === "1"; } catch { return false; }
}
export function marcarConfigurado() {
  try { localStorage.setItem(CHAVE_CONFIGURADO, "1"); } catch { /* vale só nesta sessão */ }
}
