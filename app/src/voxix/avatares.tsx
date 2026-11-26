// Avatares do Voxix: 12 prontos (desenhados aqui, sem baixar nada) e a foto da pessoa (reduzida no aparelho).
// Valor guardado no servidor: "p:<id>" (pronto) ou "f:data:image/jpeg;base64,..." (foto). Sem valor: a inicial do nome.
import { useSyncExternalStore, type ReactNode } from "react";
import { api } from "./api";

interface Pronto { id: string; nome: string; fundo: [string, string]; desenho: ReactNode }
const tr = { fill: "none", stroke: "#fff", strokeWidth: 3.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const cheio = { fill: "#fff", stroke: "none" } as const;

export const PRONTOS: Pronto[] = [
  { id: "robo", nome: "Robô", fundo: ["#19e3ff", "#2a5bff"], desenho: <g><rect x="16" y="22" width="32" height="26" rx="7" {...tr} /><path d="M32 22v-7M29 12h6" {...tr} /><circle cx="25" cy="34" r="3.2" {...cheio} /><circle cx="39" cy="34" r="3.2" {...cheio} /><path d="M26 42h12M10 33v6M54 33v6" {...tr} /></g> },
  { id: "foguete", nome: "Foguete", fundo: ["#ff7a59", "#c026d3"], desenho: <g><path d="M32 10c9 6 12 17 10 28H22c-2-11 1-22 10-28z" {...tr} /><circle cx="32" cy="26" r="4" {...tr} /><path d="M22 38l-7 8 9-2M42 38l7 8-9-2M28 46c0 5 2 8 4 10 2-2 4-5 4-10" {...tr} /></g> },
  { id: "controle", nome: "Controle", fundo: ["#8b5cf6", "#ec4899"], desenho: <g><path d="M20 22h24c7 0 11 8 12 18 .5 5-5 7-8 3l-4-5H20l-4 5c-3 4-8 2-8-3 1-10 5-18 12-18z" {...tr} /><path d="M22 30v6M19 33h6" {...tr} /><circle cx="42" cy="31" r="1.8" {...cheio} /><circle cx="46" cy="35" r="1.8" {...cheio} /></g> },
  { id: "alien", nome: "Alien", fundo: ["#34d399", "#0f766e"], desenho: <g><path d="M32 12c12 0 18 9 16 20-2 9-9 16-16 16S18 41 16 32c-2-11 4-20 16-20z" {...tr} /><path d="M22 28c5 0 7 4 6 7-4 0-8-2-6-7zM42 28c-5 0-7 4-6 7 4 0 8-2 6-7z" {...cheio} /><path d="M28 43h8" {...tr} /></g> },
  { id: "fantasma", nome: "Fantasma", fundo: ["#a78bfa", "#4338ca"], desenho: <g><path d="M16 50V30c0-9 7-16 16-16s16 7 16 16v20l-5.3-4-5.4 4-5.3-4-5.4 4-5.3-4z" {...tr} /><circle cx="26" cy="30" r="3" {...cheio} /><circle cx="38" cy="30" r="3" {...cheio} /></g> },
  { id: "espada", nome: "Espada", fundo: ["#fbbf24", "#dc2626"], desenho: <g><path d="M46 12l6 0 0 6-24 24-6-6 24-24zM22 36l-8 8M18 40l6 6M14 44l-3 7 7-3" {...tr} /></g> },
  { id: "fone", nome: "Headset", fundo: ["#22d3ee", "#7c3aed"], desenho: <g><path d="M14 38V32c0-10 8-18 18-18s18 8 18 18v6" {...tr} /><rect x="11" y="36" width="9" height="14" rx="4" {...tr} /><rect x="44" y="36" width="9" height="14" rx="4" {...tr} /><path d="M48 50c0 5-5 6-12 6" {...tr} /></g> },
  { id: "caveira", nome: "Caveira", fundo: ["#64748b", "#0f172a"], desenho: <g><path d="M32 12c11 0 17 8 17 17 0 6-3 9-6 11v7H21v-7c-3-2-6-5-6-11 0-9 6-17 17-17z" {...tr} /><circle cx="25" cy="30" r="4" {...cheio} /><circle cx="39" cy="30" r="4" {...cheio} /><path d="M32 36l-2 4h4zM27 47v-4M32 47v-4M37 47v-4" {...tr} /></g> },
  { id: "coroa", nome: "Coroa", fundo: ["#facc15", "#ea580c"], desenho: <g><path d="M13 46l-2-24 14 12 7-16 7 16 14-12-2 24z" {...tr} /><path d="M14 52h36" {...tr} /></g> },
  { id: "raio", nome: "Raio", fundo: ["#fde047", "#2563eb"], desenho: <path d="M36 9L16 36h14l-4 19 22-28H34z" {...tr} /> },
  { id: "planeta", nome: "Planeta", fundo: ["#f472b6", "#312e81"], desenho: <g><circle cx="32" cy="32" r="13" {...tr} /><path d="M10 40c-3-5 8-14 24-19 14-4 24-3 21 3M54 24c3 5-8 14-24 19-12 4-20 3-21 0" {...tr} /></g> },
  { id: "diamante", nome: "Diamante", fundo: ["#38bdf8", "#9333ea"], desenho: <g><path d="M20 16h24l10 12-22 26L10 28z" {...tr} /><path d="M10 28h44M26 16l-4 12 10 26 10-26-4-12" {...tr} /></g> },
];

const ID = /^p:[a-z0-9_]{1,24}$/;
export const ehFoto = (v: string | null | undefined): boolean => typeof v === "string" && v.startsWith("f:data:image/");

/** O avatar desenhado: pronto, foto ou a inicial. `className` recebe a forma do app (classe .avatar segue o formato escolhido). */
export function Avatar({ valor, nome, tam = 44 }: { valor?: string | null; nome: string; tam?: number }) {
  const caixa = { width: tam, height: tam };
  if (valor && ehFoto(valor)) return <img src={valor.slice(2)} alt="" className="avatar flex-none object-cover" style={caixa} draggable={false} />;
  const p = valor && ID.test(valor) ? PRONTOS.find((x) => x.id === valor.slice(2)) : undefined;
  if (p) {
    const g = `av-${p.id}`;
    return (
      <svg viewBox="0 0 64 64" className="avatar flex-none" style={caixa} role="img" aria-label={p.nome}>
        <defs><linearGradient id={g} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={p.fundo[0]} /><stop offset="1" stopColor={p.fundo[1]} /></linearGradient></defs>
        <rect width="64" height="64" fill={`url(#${g})`} />
        {p.desenho}
      </svg>
    );
  }
  return <span className="avatar grid flex-none place-items-center bg-gradient-to-br from-neon to-magenta font-extrabold text-white" style={{ ...caixa, fontSize: tam * 0.42 }}>{(nome || "?").slice(0, 1).toUpperCase()}</span>;
}

// ---------- avatares das outras pessoas: guardados no aparelho e conferidos de tempos em tempos ----------
const CHAVE = "voxix.avatares.v1";
const VALE_MS = 10 * 60_000;
interface Item { v: string | null; t: number }
let mapa: Record<string, Item> = {};
let lido = false;
const ouvintes = new Set<() => void>();
function ler() {
  if (lido) return;
  lido = true;
  try { const o = JSON.parse(localStorage.getItem(CHAVE) || "{}"); if (o && typeof o === "object") mapa = o; } catch { mapa = {}; }
}
function guardar() { try { localStorage.setItem(CHAVE, JSON.stringify(mapa)); } catch { /* sem espaço: segue só na memória */ } ouvintes.forEach((f) => f()); }
export const avatarDe = (apelido: string): string | null => { ler(); return mapa[apelido.toLowerCase()]?.v ?? null; };
export function definirAvatarLocal(apelido: string, v: string | null) { ler(); mapa = { ...mapa, [apelido.toLowerCase()]: { v, t: Date.now() } }; guardar(); }
export function useAvatarDe(apelido: string | undefined): string | null {
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, () => (apelido ? avatarDe(apelido) : null), () => null);
}
let buscando = false;
/** Pede ao servidor os avatares que faltam ou estão velhos (em lote). */
export async function atualizarAvatares(token: string, apelidos: string[]): Promise<void> {
  ler();
  const agora = Date.now();
  const falta = apelidos.map((a) => a.toLowerCase()).filter((a) => !mapa[a] || agora - mapa[a]!.t > VALE_MS).slice(0, 60);
  if (!falta.length || buscando) return;
  buscando = true;
  try {
    const r = await api.avatares(token, falta);
    const novo = { ...mapa };
    for (const a of falta) novo[a] = { v: r.avatares[a] ?? null, t: agora };
    mapa = novo;
    guardar();
  } catch { /* sem rede: tenta de novo na próxima */ } finally { buscando = false; }
}

/** Reduz a foto da pessoa para um quadrado pequeno (cabe no servidor e carrega rápido). */
export function reduzirFotoDePerfil(arquivo: File, lado = 160): Promise<string> {
  return new Promise((ok, erro) => {
    if (!arquivo.type.startsWith("image/")) { erro(new Error("Escolha uma imagem.")); return; }
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement("canvas");
      c.width = lado; c.height = lado;
      const x = c.getContext("2d");
      if (!x) { erro(new Error("Não consegui preparar a imagem.")); return; }
      const m = Math.min(img.width, img.height); // recorta o centro, quadrado
      x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
      let q = 0.82, d = c.toDataURL("image/jpeg", q);
      while (d.length > 40_000 && q > 0.35) { q -= 0.1; d = c.toDataURL("image/jpeg", q); }
      d.length > 55_000 ? erro(new Error("A imagem é complexa demais. Tente outra.")) : ok(`f:${d}`);
    };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error("Não consegui abrir essa imagem.")); };
    img.src = url;
  });
}
