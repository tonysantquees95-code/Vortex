// Abre um endereço no navegador do aparelho (no Windows, pelo comando do app; no Android, pelo próprio navegador).
export function abrirLink(url: string): void {
  const t = (window as unknown as { __TAURI_INTERNALS__?: { invoke: (c: string, a: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__;
  if (t) { void t.invoke("abrir_link", { url }).catch(() => undefined); return; }
  window.open(url, "_blank", "noopener");
}
