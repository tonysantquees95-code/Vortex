import { useCallback, useEffect, useRef, useState } from "react";
import type { Motor } from "./ponte";
import { BUILD, SERVIDOR_VENUS, haNovaVersao, precisaConferir, procurarVersao, type InfoVersao } from "./atualizacao";
import { anotarConferencia, atualizarSozinho, ultimaConferencia } from "./config";

export interface Atualizacao {
  nova: InfoVersao | null;
  conferindo: boolean;
  instalando: boolean;
  /** Pergunta ao servidor; devolve a versão nova (ou null se já está na mais recente). Lança erro se não deu para consultar. */
  conferir: () => Promise<InfoVersao | null>;
  atualizar: () => Promise<void>;
}

/** Confere se há versão nova ao abrir e a cada 6 horas; com "atualizar sozinho" ligado, instala quando não há jogo abrindo. */
export function useAtualizacao(motor: Motor, ocupado: boolean, avisar: (t: string) => void, liberado: boolean): Atualizacao {
  const [nova, setNova] = useState<InfoVersao | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [instalando, setInstalando] = useState(false);
  const instalandoRef = useRef(false);
  const ocupadoRef = useRef(ocupado);
  useEffect(() => { ocupadoRef.current = ocupado; }, [ocupado]);

  const app = motor.plataforma === "android" ? "vortex-android" : motor.plataforma === "windows" ? "vortex-windows" : null;

  const conferir = useCallback(async () => {
    if (!app) return null;
    setConferindo(true);
    try {
      const v = await procurarVersao(SERVIDOR_VENUS, app);
      anotarConferencia(Date.now());
      const achou = v && haNovaVersao(BUILD, v.numero) ? v : null;
      setNova(achou);
      return achou;
    } finally { setConferindo(false); }
  }, [app]);

  const atualizar = useCallback(async () => {
    if (!nova || instalandoRef.current) return;
    instalandoRef.current = true; setInstalando(true);
    try {
      avisar(motor.plataforma === "windows" ? "Baixando a atualização… o Vortex fecha, atualiza e abre de novo." : "Baixando a atualização…");
      await motor.instalarAtualizacao(nova.url, nova.sha256);
    } catch (e) { avisar(String(e instanceof Error ? e.message : e)); }
    finally { instalandoRef.current = false; setInstalando(false); }
  }, [motor, nova, avisar]);

  // confere ao abrir e a cada 30 min (só vai ao servidor se passaram 6 h desde a última conferência)
  useEffect(() => {
    if (!app || !liberado || BUILD === 0) return;
    const rodar = () => {
      if (!precisaConferir(ultimaConferencia(), Date.now(), 6)) return;
      conferir().catch(() => { /* sem internet: tenta de novo mais tarde */ });
    };
    rodar();
    const id = window.setInterval(rodar, 30 * 60_000);
    return () => window.clearInterval(id);
  }, [app, liberado, conferir]);

  // atualizar sozinho: só quando não há jogo abrindo
  useEffect(() => {
    if (nova && atualizarSozinho() && !ocupado && liberado) void atualizar();
  }, [nova, ocupado, liberado, atualizar]);

  return { nova, conferindo, instalando, conferir, atualizar };
}
