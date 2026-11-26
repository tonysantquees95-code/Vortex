// Avisos de mensagem nova: notificação do sistema (celular, computador, navegador e iPhone instalado).
//  • Android: notificação local do aparelho (Capacitor).
//  • Navegador/Windows/iPhone: Notification API, pelo service worker (necessário no Android Chrome e no iPhone).
// Só avisa quando a conversa não está na tela (aba escondida, app em segundo plano ou outra conversa aberta).
import { Capacitor } from "@capacitor/core";

const CHAVE = "voxix.avisos";
export type PermissaoAvisos = "granted" | "denied" | "default" | "indisponivel";

export const avisosLigados = (): boolean => { try { return localStorage.getItem(CHAVE) !== "0"; } catch { return true; } };
export const ligarAvisos = (v: boolean): void => { try { localStorage.setItem(CHAVE, v ? "1" : "0"); } catch { /* ok */ } };

const nativo = (): boolean => Capacitor.isNativePlatform();

export async function permissaoDeAvisos(): Promise<PermissaoAvisos> {
  try {
    if (nativo()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const p = (await LocalNotifications.checkPermissions()).display;
      return p === "granted" ? "granted" : p === "denied" ? "denied" : "default";
    }
    if (typeof Notification === "undefined") return "indisponivel";
    return Notification.permission as PermissaoAvisos;
  } catch { return "indisponivel"; }
}

/** Pede a permissão (precisa vir de um toque da pessoa). Devolve se foi liberada. */
export async function pedirAvisos(): Promise<boolean> {
  try {
    if (nativo()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      return (await LocalNotifications.requestPermissions()).display === "granted";
    }
    if (typeof Notification === "undefined") return false;
    return (await Notification.requestPermission()) === "granted";
  } catch { return false; }
}

/** A conversa está na tela agora? (então não precisa avisar) */
export const naTela = (conversaAberta: boolean): boolean => conversaAberta && typeof document !== "undefined" && document.visibilityState === "visible";

let contador = 0;
export async function avisar(titulo: string, corpo: string, tag: string): Promise<void> {
  if (!avisosLigados()) return;
  try {
    if (nativo()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      if ((await LocalNotifications.checkPermissions()).display !== "granted") return;
      contador = (contador + 1) % 1_000_000;
      await LocalNotifications.schedule({ notifications: [{ id: 1000 + contador, title: titulo, body: corpo.slice(0, 200), extra: { tag } }] });
      return;
    }
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const opcoes = { body: corpo.slice(0, 200), tag, icon: "./icone-192.png", badge: "./icone-192.png" };
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) await reg.showNotification(titulo, opcoes);
    else { const n = new Notification(titulo, opcoes); n.onclick = () => { window.focus(); n.close(); }; }
  } catch { /* sem aviso: a mensagem continua na conversa */ }
}

/** Service worker só para os avisos funcionarem no navegador e no iPhone (não guarda nada em cache). */
export function registrarServiceWorker(): void {
  if (nativo() || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;
  void navigator.serviceWorker.register("./sw.js").catch(() => undefined);
}
