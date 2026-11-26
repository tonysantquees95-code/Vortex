import { memo } from "react";

interface Props {
  /** a palavra como foi digitada, quando ela não existe (vira a primeira opção: tocar nela mantém assim) */
  literal: string | null;
  opcoes: string[];
  aoEscolher: (palavra: string, ehLiteral: boolean) => void;
  /** dentro do teclado do Voxix (altura fixa, sempre visível) ou flutuando em cima do campo, no computador */
  flutuante?: boolean;
}

/** Faixa de sugestões do corretor, no mesmo visual das teclas do app. */
export const BarraSugestoes = memo(function BarraSugestoes({ literal, opcoes, aoEscolher, flutuante }: Props) {
  const itens: { texto: string; literal: boolean }[] = [];
  if (literal) itens.push({ texto: literal, literal: true });
  for (const o of opcoes) itens.push({ texto: o, literal: false });
  if (flutuante && itens.length === 0) return null;
  return (
    <div className={flutuante ? "barra-sug barra-sug-flutuante" : "barra-sug"} role="group" aria-label="Sugestões de palavras">
      {itens.slice(0, 3).map((i, n) => (
        <button key={`${i.texto}-${n}`} type="button" className={`sug ${i.literal ? "sug-literal" : n === (literal ? 1 : 0) ? "sug-melhor" : ""}`}
          onPointerDown={(e) => { e.preventDefault(); aoEscolher(i.texto, i.literal); }} onClick={(e) => e.preventDefault()}>
          {i.literal ? `“${i.texto}”` : i.texto}
        </button>
      ))}
    </div>
  );
});
