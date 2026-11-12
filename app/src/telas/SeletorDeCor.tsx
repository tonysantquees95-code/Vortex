import { useState } from "react";

const limitar = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function hslParaHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function hexParaHsl(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [350, 100, 58];
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(((h * 60) + 360) % 360), Math.round(s * 100), Math.round(l * 100)];
}

/** Escolha de cor no estilo do Vortex (matiz, intensidade e luz), em vez da janela do sistema. */
export function SeletorDeCor({ inicial, aoDefinir, aoCancelar }: { inicial: string; aoDefinir: (hex: string) => void; aoCancelar: () => void }) {
  const [[h, s, l], setHsl] = useState<[number, number, number]>(() => { const [a, b, c] = hexParaHsl(inicial); return [a, limitar(b, 40, 100), limitar(c, 30, 70)]; });
  const hex = hslParaHex(h, s, l);
  return (
    <div data-camada role="dialog" aria-label="Escolher cor" className="fixed inset-0 z-50 grid place-items-center bg-[#05060dd9] p-4 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) aoCancelar(); }}>
      <div className="vidro entrar grid w-[min(520px,94vw)] gap-4 p-6">
        <h3 className="titulo-neon text-2xl font-black">Escolher cor</h3>
        <div className="flex items-center gap-4">
          <span className="size-20 flex-none rounded-3xl border border-white/20" style={{ background: `linear-gradient(135deg, ${hex}, ${hslParaHex(h, s, limitar(l - 22, 8, 90))})`, boxShadow: `0 0 34px ${hex}99` }} />
          <div><div className="text-lg font-bold tabular-nums">{hex.toUpperCase()}</div><div className="text-sm text-slate-400">É assim que o neon vai ficar.</div></div>
        </div>
        <label className="grid gap-1 text-sm text-slate-300">Cor
          <input data-foco type="range" min={0} max={359} value={h} onChange={(e) => setHsl([Number(e.target.value), s, l])} className="barra" style={{ background: "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }} aria-label="Matiz" />
        </label>
        <label className="grid gap-1 text-sm text-slate-300">Intensidade
          <input data-foco type="range" min={40} max={100} value={s} onChange={(e) => setHsl([h, Number(e.target.value), l])} className="barra" aria-label="Intensidade" />
        </label>
        <label className="grid gap-1 text-sm text-slate-300">Luz
          <input data-foco type="range" min={30} max={70} value={l} onChange={(e) => setHsl([h, s, Number(e.target.value)])} className="barra" aria-label="Luz" />
        </label>
        <div className="flex justify-end gap-3">
          <button data-foco className="botao" onClick={aoCancelar}>Cancelar</button>
          <button data-foco className="botao primario" onClick={() => aoDefinir(hex)}>Definir</button>
        </div>
      </div>
    </div>
  );
}
