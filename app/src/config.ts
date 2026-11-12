// Preferências simples guardadas no próprio aparelho (nunca quebra se o armazenamento do navegador estiver bloqueado).
const CHAVE = "vortex:organizar-auto";

export function organizarAutomatico(): boolean {
  try { return localStorage.getItem(CHAVE) !== "0"; } catch { return true; }
}

export function definirOrganizarAutomatico(v: boolean) {
  try { localStorage.setItem(CHAVE, v ? "1" : "0"); } catch { /* sem armazenamento: vale só nesta sessão */ }
}
