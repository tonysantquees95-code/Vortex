import { useRef, useState } from "react";
import { Avatar, PRONTOS, reduzirFotoDePerfil } from "../avatares";
import { useVoxix } from "../estado";

/** Foto do perfil: escolhe um avatarzinho pronto ou carrega uma foto. Aparece nos Ajustes. */
export function EscolherAvatar() {
  const { perfil, mudarAvatar } = useVoxix();
  const arquivo = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  if (!perfil) return null;
  const atual = perfil.avatar ?? null;

  const salvar = async (v: string | null) => {
    setOcupado(true); setAviso("");
    try { await mudarAvatar(v); } catch { setAviso("Não deu para salvar agora. Confira a internet e tente de novo."); } finally { setOcupado(false); }
  };
  const foto = async (f: File | undefined) => {
    if (!f) return;
    setOcupado(true); setAviso("");
    try { await mudarAvatar(await reduzirFotoDePerfil(f)); } catch (e) { setAviso(e instanceof Error ? e.message : "Não consegui usar essa foto."); } finally { setOcupado(false); }
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-suave">Sua foto</h3>
      <div className="flex items-center gap-3">
        <Avatar valor={atual} nome={perfil.nome} tam={72} />
        <div className="grid gap-2">
          <button onClick={() => arquivo.current?.click()} disabled={ocupado} className="rounded-xl border border-borda px-4 py-2 text-sm font-bold">Carregar uma foto</button>
          {atual && <button onClick={() => void salvar(null)} disabled={ocupado} className="rounded-xl px-4 py-1 text-xs text-suave underline">Tirar a foto</button>}
        </div>
      </div>
      <input ref={arquivo} type="file" accept="image/*" className="hidden" onChange={(e) => { void foto(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Avatares prontos">
        {PRONTOS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={atual === `p:${p.id}`} aria-label={p.nome} disabled={ocupado} onClick={() => void salvar(`p:${p.id}`)}
            className={`grid place-items-center rounded-full p-0.5 ${atual === `p:${p.id}` ? "ring-2 ring-neon" : ""}`}>
            <Avatar valor={`p:${p.id}`} nome={p.nome} tam={40} />
          </button>
        ))}
      </div>
      {aviso && <p className="text-xs text-aviso" role="status">{aviso}</p>}
    </section>
  );
}
