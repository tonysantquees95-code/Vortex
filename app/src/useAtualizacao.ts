import { useCallback, useEffect, useRef, useState } from "react";
import type { Motor } from "./ponte";
import { BUILD, SERVIDOR_VENUS, haNovaVersao, precisaConferir, procurarVersao, type InfoVersao } from "./atualizacao";
import { anotarConferencia, atualizarSozinho, ultimaConferencia } from "./config";

export interface Atualizacao {
  nova: InfoVersao | null;
  conferindo: boolean;
  /** nova → baixando (com barra) → pronta (a pessoa escolhe instalar) */
  fase: "nova" | "baixando" | "pronta";
  feitos: number;
  total: number;
  /** Mesmo que `fase === "baixando"`. */
  instalando: boolean;
  /** Pergunta ao servidor; devolve a versão nova (ou null se já está na mais recente). Lança erro se não deu para consultar. */
  conferir: () => Promise<InfoVersao | null>;
  /** Começa a baixar; se já está pronta, instala. */
  atualizar: () => Promise<void>;
  baixar: () => Promise<void>;
  instalar: () => Promise<void>;
}

/** Confere se há versão nova ao abrir e a cada 6 horas; com "atualizar sozinho" ligado, instala quando não há jogo abrindo. */
export function useAtualizacao(motor: Motor, ocupado: boolean, avisar: (t: string) => void, liberado: boolean): Atualizacao {
  const [nova, setNova] = useState<InfoVersao | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [fase, setFase] = useState<"nova" | "baixando" | "pronta">("nova");
  const [feitos, setFeitos] = useState(0);
  const [total, setTotal] = useState(0);
  const instalandoRef = useRef(false);
  const jaTentou = useRef(new Set<number>());
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

  const baixar = useCallback(async () => {
    if (!nova || instalandoRef.current) return;
    instalandoRef.current = true; setFase("baixando"); setFeitos(0); setTotal(nova.tamanho);
    try { await motor.baixarAtualizacao(nova.url, nova.sha256, nova.tamanho); }
    catch (e) { instalandoRef.current = false; setFase("nova"); avisar(String(e instanceof Error ? e.message : typeof e === "string" ? e : "Não consegui baixar agora.")); }
  }, [motor, nova, avisar]);

  // acompanha a barra do download
  useEffect(() => {
    if (fase !== "baixando") return;
    let vivo = true;
    const t = window.setInterval(() => {
      void motor.progressoAtualizacao().then((p) => {
        if (!vivo) return;
        setFeitos(p.feitos); if (p.total > 0) setTotal(p.total);
        if (p.estado === "pronta") { instalandoRef.current = false; setFase("pronta"); }
        else if (p.estado === "erro") { instalandoRef.current = false; setFase("nova"); avisar(p.erro || "Não consegui baixar a atualização."); }
      }).catch(() => undefined);
    }, 500);
    return () => { vivo = false; window.clearInterval(t); };
  }, [fase, motor, avisar]);

  const instalar = useCallback(async () => {
    try {
      avisar(motor.plataforma === "windows" ? "Atualizando… o Vortex fecha, atualiza e abre de novo." : "O Android vai pedir a sua confirmação.");
      await motor.instalarBaixada();
    } catch (e) { avisar(String(e instanceof Error ? e.message : typeof e === "string" ? e : "Não consegui instalar agora.")); }
  }, [motor, avisar]);

  const atualizar = useCallback(async () => { if (fase === "pronta") await instalar(); else await baixar(); }, [fase, instalar, baixar]);

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

  // atualizar sozinho: baixa quando não há jogo abrindo; instalar continua sendo escolha da pessoa
  useEffect(() => {
    if (nova && fase === "nova" && atualizarSozinho() && !ocupado && liberado && !jaTentou.current.has(nova.numero)) { jaTentou.current.add(nova.numero); void baixar(); }
  }, [nova, fase, ocupado, liberado, baixar]);

  return { nova, conferindo, fase, feitos, total, instalando: fase === "baixando", conferir, atualizar, baixar, instalar };
}
