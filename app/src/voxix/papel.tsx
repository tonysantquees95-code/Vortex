import { useSyncExternalStore } from "react";
import type { Papel as PapelCfg } from "./personalizar";
import { useVisual } from "./useVisual";

export type Qual = "inicio" | "conversa";
const chave = (q: Qual) => `voxix.papel.foto.${q}`;
const ouvintes = new Set<() => void>();
const cache: Record<Qual, string | null> = { inicio: null, conversa: null };
let lido = false;

const fotoValida = (s: unknown): s is string => typeof s === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 1_800_000;
function carregar() {
  if (lido) return;
  lido = true;
  for (const q of ["inicio", "conversa"] as const) {
    try { const v = localStorage.getItem(chave(q)); cache[q] = fotoValida(v) ? v : null; } catch { cache[q] = null; }
  }
}
export const fotoDo = (q: Qual): string | null => { carregar(); return cache[q]; };
function avisar() { ouvintes.forEach((f) => f()); }
export function guardarFoto(q: Qual, dados: string | null): boolean {
  carregar();
  if (dados !== null && !fotoValida(dados)) return false;
  try {
    if (dados === null) localStorage.removeItem(chave(q)); else localStorage.setItem(chave(q), dados);
  } catch { return false; } // sem espaço no aparelho
  cache[q] = dados;
  avisar();
  return true;
}
export function useFoto(q: Qual): string | null {
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, () => fotoDo(q), () => null);
}

/** Lê uma imagem escolhida pela pessoa e devolve uma versão reduzida (JPEG até ~1280 px) pronta para guardar no aparelho. */
export function reduzirImagem(arquivo: File, maximo = 1280): Promise<string> {
  return new Promise((ok, erro) => {
    if (!arquivo.type.startsWith("image/")) { erro(new Error("Escolha uma imagem.")); return; }
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, maximo / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      const x = c.getContext("2d");
      if (!x) { erro(new Error("Não consegui preparar a imagem.")); return; }
      x.drawImage(img, 0, 0, c.width, c.height);
      let q = 0.78, d = c.toDataURL("image/jpeg", q);
      while (d.length > 1_700_000 && q > 0.3) { q -= 0.12; d = c.toDataURL("image/jpeg", q); }
      d.length > 1_800_000 ? erro(new Error("A imagem é grande demais.")) : ok(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error("Não consegui abrir essa imagem.")); };
    img.src = url;
  });
}

/** Camada do papel de parede, para ficar atrás do conteúdo (o pai precisa ser `relative`). */
export function PapelDeParede({ qual, cfg, fotoUrl }: { qual: Qual; cfg?: PapelCfg; fotoUrl?: string | null }) {
  const v = useVisual();
  const fotoGeral = useFoto(qual);
  const foto = fotoUrl !== undefined ? fotoUrl : fotoGeral;
  const p = cfg ?? (qual === "inicio" ? v.papelInicio : v.papelConversa);
  if (p.modelo === "nenhum") return null;
  const comFoto = p.modelo === "foto";
  if (comFoto && !foto) return null;
  return (
    <>
      <div className={comFoto ? "papel" : `papel papel-${p.modelo}`} style={comFoto ? { backgroundImage: `url(${foto})` } : undefined} aria-hidden="true" />
      <div className="papel-sombra" style={{ opacity: p.escurecer / 100 }} aria-hidden="true" />
    </>
  );
}
