/** O emblema do Voxix (V com X) para o botão do dock: desenho próprio, sem depender do tema do Vortex. */
const V = "M-6 -8 L28 26 L60 88 L92 26 L126 -8 L60 128 Z";
const X = "M60 20.8 L67.1 27.9 L74.1 20.8 L81.2 27.9 L74.1 35 L81.2 42.1 L74.1 49.2 L67.1 42.1 L60 49.2 L52.9 42.1 L45.8 49.2 L38.8 42.1 L45.8 35 L38.8 27.9 L45.8 20.8 L52.9 27.9 Z";

export function IconeVoxix({ className }: { className?: string }) {
  return (
    <svg viewBox="-12 -14 144 146" className={className} aria-hidden>
      <defs>
        <linearGradient id="icone-voxix-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9a2ff" />
          <stop offset="1" stopColor="#6a31c4" />
        </linearGradient>
      </defs>
      <path d={V} fill="url(#icone-voxix-v)" />
      <path d={X} fill="#ef2b3d" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}
