import { useId } from "react";

/** Letras VORTEX no mesmo estilo chanfrado da marca VX do Velox: corpo escuro, borda acesa e neons correndo em volta de cada letra. */
const LETRAS: { x: number; d: string[]; furos?: string[] }[] = [
  { x: 0, d: ["M0 0 L64 0 L110 124 L156 0 L220 0 L142 190 L78 190 Z"] },
  { x: 244, d: ["M40 0 H180 L220 40 V150 L180 190 H40 L0 150 V40 Z"], furos: ["M84 52 H136 L156 72 V118 L136 138 H84 L64 118 V72 Z"] },
  { x: 488, d: ["M0 0 H150 L200 40 V85 L165 120 L215 190 H145 L105 128 H64 V190 H0 Z"], furos: ["M64 50 H128 L140 62 V76 L128 88 H64 Z"] },
  { x: 727, d: ["M0 0 H230 V56 H146 V190 H84 V56 H0 Z"] },
  { x: 981, d: ["M0 0 H200 V52 H64 V78 H180 V120 H64 V138 H200 V190 H0 Z"] },
  { x: 1205, d: ["M0 0 L64 0 L210 190 L146 190 Z", "M146 0 L210 0 L64 190 L0 190 Z"] },
];

export function LogoVortex({ className = "", brilho = true }: { className?: string; brilho?: boolean }) {
  const id = useId().replace(/:/g, "");
  // cada letra vira um único traçado (furos incluídos, preenchimento par-ímpar)
  const paths = LETRAS.map((l) => ({ x: l.x, d: [...l.d, ...(l.furos ?? [])].join(" ") }));
  const todas = (att: Record<string, string | number> = {}) => paths.map((p, i) => <path key={i} d={p.d} transform={`translate(${p.x} 0)`} fillRule="evenodd" {...att} />);
  return (
    <svg className={`vx-logo ${className}`} viewBox="-14 -14 1443 218" role="img" aria-label="VORTEX">
      <defs>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a1f26" /><stop offset=".55" stopColor="#1a0d12" /><stop offset="1" stopColor="#0a0508" /></linearGradient>
        <clipPath id={`${id}k`}>{todas()}</clipPath>
        <filter id={`${id}g`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="m" /><feMerge><feMergeNode in="m" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id={`${id}b`} x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="12" /></filter>
      </defs>
      {brilho && <g filter={`url(#${id}b)`} opacity=".62" style={{ fill: "var(--neon)" }}>{todas()}</g>}
      <g transform="translate(-8 8)" style={{ fill: "var(--neon2)", stroke: "var(--neon2)" }} strokeWidth="4" strokeLinejoin="miter" opacity=".95">{todas()}</g>
      <g fill="#03050c" stroke="#03050c" strokeWidth="16" strokeLinejoin="miter">{todas()}</g>
      <g fill={`url(#${id}c)`}>{todas()}</g>
      <g clipPath={`url(#${id}k)`} fill="none" strokeLinejoin="miter">
        <g style={{ stroke: "var(--neon)" }} strokeWidth="9">{todas()}</g>
        <g stroke="#fff" strokeOpacity=".4" strokeWidth="3">{todas()}</g>
      </g>
      <g fill="none" strokeLinejoin="round" strokeLinecap="round" filter={`url(#${id}g)`}>
        {LETRAS.flatMap((l, j) => [...l.d, ...(l.furos ?? [])].map((d, k) => [
          <path key={`a${j}-${k}`} className="vx-corre a" pathLength={100} d={d} transform={`translate(${l.x} 0)`} style={{ animationDelay: `-${((j + k) * 0.7).toFixed(1)}s` }} />,
          <path key={`b${j}-${k}`} className="vx-corre b" pathLength={100} d={d} transform={`translate(${l.x} 0)`} style={{ animationDelay: `-${(1.7 + (j + k) * 0.7).toFixed(1)}s` }} />,
        ]))}
      </g>
    </svg>
  );
}
