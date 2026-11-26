import { useRef, useState } from "react";
import { PapelDeParede, reduzirImagem } from "../papel";
import { MODELOS_PAPEL, PAPEL_PADRAO, type ModeloPapel } from "../personalizar";
import { definirPapelDaConversa, usePapelDaConversa } from "../papelConversa";

/** Janelinha do menu da conversa: escolhe o papel de parede só desta conversa. */
export function PapelDaConversa({ chave, nome, fechar }: { chave: string; nome: string; fechar: () => void }) {
  const atual = usePapelDaConversa(chave);
  const [aviso, setAviso] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);
  const cfg = atual?.cfg ?? null;
  const foto = atual?.foto ?? null;

  const usar = (modelo: ModeloPapel) => {
    if (modelo === "foto" && !foto) { arquivo.current?.click(); return; }
    definirPapelDaConversa(chave, { modelo, escurecer: cfg?.escurecer ?? PAPEL_PADRAO.escurecer });
  };
  const escolherFoto = async (f: File | undefined) => {
    if (!f) return;
    setAviso("");
    try {
      const dados = await reduzirImagem(f, 1080);
      if (!definirPapelDaConversa(chave, { modelo: "foto", escurecer: cfg?.escurecer ?? PAPEL_PADRAO.escurecer }, dados)) setAviso("Não deu para guardar a foto neste aparelho (pouco espaço).");
    } catch (e) { setAviso(e instanceof Error ? e.message : "Não consegui usar essa imagem."); }
  };

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-4" onClick={fechar}>
      <div onClick={(e) => e.stopPropagation()} className="rolagem max-h-[calc(100vh-2rem)] w-full max-w-sm space-y-3 overflow-y-auto rounded-2xl border border-borda bg-painel p-5">
        <h2 className="text-lg font-extrabold">Papel de parede</h2>
        <p className="text-sm text-suave">Só para a conversa com {nome}. Cada conversa pode ter o seu.</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Modelo do fundo">
          <button type="button" role="radio" aria-checked={!cfg} onClick={() => definirPapelDaConversa(chave, null)}
            className={`relative h-20 overflow-hidden rounded-xl border bg-fundo text-xs font-bold ${!cfg ? "border-neon" : "border-borda"}`}>
            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1">Padrão do app</span>
          </button>
          {MODELOS_PAPEL.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={cfg?.modelo === m.id} onClick={() => usar(m.id)}
              className={`relative h-20 overflow-hidden rounded-xl border bg-fundo text-xs font-bold ${cfg?.modelo === m.id ? "border-neon" : "border-borda"}`}>
              {m.id === "foto" ? (foto && <div className="papel" style={{ backgroundImage: `url(${foto})` }} />) : m.id !== "nenhum" && <div className={`papel papel-${m.id}`} />}
              <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1">{m.id === "foto" && !foto ? "＋ Minha foto" : m.nome}</span>
            </button>
          ))}
        </div>
        <input ref={arquivo} type="file" accept="image/*" className="hidden" onChange={(e) => { void escolherFoto(e.target.files?.[0]); e.target.value = ""; }} />
        {cfg && (
          <label className="grid gap-1 text-sm">Escurecer o fundo: {cfg.escurecer}%
            <input type="range" min={0} max={85} step={5} value={cfg.escurecer} onChange={(e) => definirPapelDaConversa(chave, { ...cfg, escurecer: Number(e.target.value) })} style={{ accentColor: "var(--color-neon)" }} aria-label="Quanto escurecer o fundo" />
          </label>
        )}
        <div className="relative h-24 overflow-hidden rounded-xl border border-borda bg-painel" aria-label="Prévia">
          <PapelDeParede qual="conversa" cfg={cfg ?? undefined} fotoUrl={cfg ? foto : undefined} />
          <div className="relative z-[1] space-y-1.5 p-3 text-xs">
            <div className="balao w-fit border border-borda bg-painel px-3 py-1.5">Oi!</div>
            <div className="balao balao-meu ml-auto w-fit px-3 py-1.5">Ficou bom!</div>
          </div>
        </div>
        {aviso && <p className="text-xs text-aviso" role="status">{aviso}</p>}
        <button onClick={fechar} className="w-full rounded-xl bg-neon py-2.5 font-extrabold text-white">Pronto</button>
      </div>
    </div>
  );
}
