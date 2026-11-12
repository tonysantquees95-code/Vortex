import { useEffect, useRef, useState } from "react";
import type { Tema } from "../tema";

/** Imagem de fundo com troca suave: a anterior fica por baixo enquanto a nova aparece. */
function Imagem({ src, desfocar }: { src: string | null; desfocar: boolean }) {
  const [anterior, setAnterior] = useState<string | null>(null);
  const [atual, setAtual] = useState<string | null>(src);
  const ultimo = useRef<string | null>(src);
  useEffect(() => {
    if (src === ultimo.current) return;
    setAnterior(ultimo.current); setAtual(src); ultimo.current = src;
    const t = window.setTimeout(() => setAnterior(null), 700);
    return () => window.clearTimeout(t);
  }, [src]);
  const cls = desfocar ? "imagem-fundo desfocada" : "imagem-fundo";
  return <>{anterior && <img key={"a" + anterior} className={cls} src={anterior} alt="" />}{atual && <img key={atual} className={cls + " entrando"} src={atual} alt="" />}</>;
}

/** Fundo do app: degradê na cor do tema + modelo futurista, foto da pessoa, capa de jogo ou a capa do console em foco. O vórtice 3D só aparece na abertura. */
export function FundoDaTela({ tema, imagem }: { tema: Tema; imagem?: string | null }) {
  const src = tema.fundo === "console" ? imagem ?? null : tema.fundo === "foto" ? tema.foto : tema.fundo === "capa" ? tema.capaFundo : null;
  return (
    <div className="fundo-tela" data-modelo={tema.fundo}>
      <div className="tinta" />
      <Imagem src={src} desfocar={tema.fundo !== "foto"} />
      <div className="modelo" />
      <div className="escurecer" data-imagem={Boolean(src)} />
    </div>
  );
}
