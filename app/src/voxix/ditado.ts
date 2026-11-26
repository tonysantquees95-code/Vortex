// Ditado: a pessoa fala e a fala vira texto, sem mandar áudio para ninguém.
//  • Android: reconhecimento de voz do próprio aparelho (de graça, sem usar o servidor).
//  • Windows/navegador: grava uma frase curta (até 30 s) e o servidor transcreve; o áudio não é guardado.
import { Capacitor } from "@capacitor/core";
import { SERVIDOR } from "./api";

export interface Ditado { parar: () => Promise<void> }

let nativoPronto = false;
/** Deixa o reconhecimento de voz carregado antes do toque, para as palavras aparecerem logo. */
export function aquecerDitado(): void {
  if (Capacitor.isNativePlatform()) void import("@capacitor-community/speech-recognition").catch(() => undefined);
}
export interface Ganchos { aoTexto: (texto: string) => void; aoFim: () => void; aoErro: (mensagem: string) => void; aoPronto?: () => void }

export const LIMITE_GRAVACAO_MS = 30_000;

/** Pede o microfone antes de usar o ditado (na apresentação). Devolve se foi liberado. */
export async function pedirMicrofone(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
      return (await SpeechRecognition.requestPermissions()).speechRecognition === "granted";
    }
    const f = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const t of f.getTracks()) t.stop();
    return true;
  } catch {
    return false;
  }
}

export async function iniciarDitado(g: Ganchos, token: string): Promise<Ditado> {
  if (Capacitor.isNativePlatform()) return ditadoNativo(g);
  return ditadoDoNavegador(g, () => ditadoPeloServidor(g, token));
}

interface ReconhecedorWeb {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void; onaudiostart: (() => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

/** Navegador/Windows: as palavras aparecem enquanto a pessoa fala (reconhecimento do próprio navegador). Se não houver, grava e o servidor transcreve. */
async function ditadoDoNavegador(g: Ganchos, reserva: () => Promise<Ditado>): Promise<Ditado> {
  const W = window as unknown as { SpeechRecognition?: new () => ReconhecedorWeb; webkitSpeechRecognition?: new () => ReconhecedorWeb };
  const Reconhecedor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  if (!Reconhecedor) return reserva();
  const r = new Reconhecedor();
  r.lang = "pt-BR"; r.continuous = true; r.interimResults = true;
  let pediuParar = false, terminou = false, recebeu = false, trocou: Ditado | null = null;
  let fechado = "";
  const juntar = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b);
  r.onresult = (e) => {
    recebeu = true;
    let parcial = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript.trim();
      if (e.results[i].isFinal) fechado = juntar(fechado, t); else parcial = juntar(parcial, t);
    }
    g.aoTexto(juntar(fechado, parcial));
  };
  r.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    // sem serviço de voz neste navegador: usa a gravação com transcrição pelo servidor
    if (!recebeu && !pediuParar && !trocou && ["network", "service-not-allowed", "language-not-supported"].includes(e.error)) {
      terminou = true;
      void reserva().then((d) => { trocou = d; }).catch((x) => { g.aoErro(x instanceof Error ? x.message : "Não consegui usar o microfone."); g.aoFim(); });
      return;
    }
    if (e.error === "not-allowed") g.aoErro("Libere o microfone para ditar.");
    else g.aoErro("O ditado parou. Toque no microfone para tentar de novo.");
  };
  r.onend = () => {
    if (terminou) return;
    if (!pediuParar) { try { r.start(); return; } catch { /* segue para o fim */ } }
    terminou = true;
    g.aoFim();
  };
  r.onaudiostart = () => g.aoPronto?.();
  try { r.start(); } catch { return reserva(); }
  return { parar: async () => { pediuParar = true; if (trocou) { await trocou.parar(); return; } try { r.stop(); } catch { /* já parou */ } } };
}

async function ditadoNativo(g: Ganchos): Promise<Ditado> {
  const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
  if (!nativoPronto) {
    const { available } = await SpeechRecognition.available();
    if (!available) throw new Error("Este aparelho não tem reconhecimento de voz.");
    const permissao = await SpeechRecognition.requestPermissions();
    if (permissao.speechRecognition !== "granted") throw new Error("Libere o microfone para ditar.");
    nativoPronto = true;
  }
  const ouvintes: { remove: () => Promise<void> }[] = [];
  let encerrado = false, pediuParar = false, fechado = "", parcial = "";
  const juntar = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b);
  const finalizar = () => {
    if (encerrado) return;
    encerrado = true;
    for (const o of ouvintes) void o.remove();
    g.aoFim();
  };
  // o Android encerra sozinho quando a pessoa faz uma pausa; seguimos ouvindo até ela tocar no quadradinho
  const comecar = () => SpeechRecognition.start({ language: "pt-BR", maxResults: 1, partialResults: true, popup: false });
  ouvintes.push(await SpeechRecognition.addListener("partialResults", (d: { matches?: string[] }) => {
    const t = d.matches?.[0];
    if (!t) return;
    parcial = t;
    g.aoTexto(juntar(fechado, parcial));
  }));
  ouvintes.push(await SpeechRecognition.addListener("listeningState", (d: { status: "started" | "stopped" }) => {
    if (d.status !== "stopped" || encerrado) return;
    if (pediuParar) { finalizar(); return; }
    fechado = juntar(fechado, parcial);
    parcial = "";
    comecar().catch(() => finalizar());
  }));
  await comecar();
  g.aoPronto?.();
  return { parar: async () => { pediuParar = true; try { await SpeechRecognition.stop(); } catch { /* já parou */ } finalizar(); } };
}

async function ditadoPeloServidor(g: Ganchos, token: string): Promise<Ditado> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Este aparelho não consegue gravar para ditar.");
  let fluxo: MediaStream;
  try { fluxo = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { throw new Error("Libere o microfone para ditar."); }
  const tipo = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  const gravador = new MediaRecorder(fluxo, tipo ? { mimeType: tipo, audioBitsPerSecond: 24000 } : undefined);
  const partes: Blob[] = [];
  gravador.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
  const limite = setTimeout(() => { if (gravador.state !== "inactive") gravador.stop(); }, LIMITE_GRAVACAO_MS);
  gravador.onstop = () => {
    clearTimeout(limite);
    for (const t of fluxo.getTracks()) t.stop();
    void (async () => {
      try {
        const audio = new Blob(partes, { type: gravador.mimeType || "audio/webm" });
        if (!audio.size) return;
        const r = await fetch(`${SERVIDOR}/voxix/transcrever`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": audio.type }, body: audio, signal: AbortSignal.timeout(30000) });
        const d = (await r.json().catch(() => ({}))) as { texto?: string; error?: string };
        if (!r.ok) throw new Error(d.error ?? "Não consegui transcrever agora.");
        if (d.texto) g.aoTexto(d.texto);
      } catch (e) {
        g.aoErro(e instanceof Error ? e.message : "Não consegui transcrever agora.");
      } finally {
        g.aoFim();
      }
    })();
  };
  gravador.start();
  g.aoPronto?.();
  return { parar: async () => { if (gravador.state !== "inactive") gravador.stop(); } };
}
