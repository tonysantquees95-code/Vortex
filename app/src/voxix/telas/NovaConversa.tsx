import { useState, type FormEvent } from "react";
import { ErroApi } from "../api";
import { useVoxix } from "../estado";

export function NovaConversa({ fechar }: { fechar: () => void }) {
  const { novaConversa, abrir, perfil } = useVoxix();
  const [apelido, setApelido] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const procurar = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    const a = apelido.trim().replace(/^@/, "").toLowerCase();
    if (a === perfil?.apelido) { setErro("Esse é o seu próprio apelido."); return; }
    setOcupado(true);
    try { const p = await novaConversa(a); abrir(p.apelido); fechar(); } catch (er) { setErro(er instanceof ErroApi ? er.message : "Não consegui procurar agora."); } finally { setOcupado(false); }
  };

  return (
    <div className="fixed inset-0 z-10 grid place-items-center bg-black/70 p-4" onClick={fechar}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => void procurar(e)} className="w-full max-w-sm space-y-3 rounded-2xl border border-borda bg-painel p-5">
        <h2 className="text-lg font-extrabold">Nova conversa</h2>
        <p className="text-sm text-suave">Digite o apelido exato do seu amigo.</p>
        <div className="flex items-center rounded-xl border border-borda bg-fundo px-4 focus-within:border-neon">
          <span className="text-suave">@</span>
          <input autoFocus value={apelido} onChange={(e) => setApelido(e.target.value.replace(/[^A-Za-z0-9_@]/g, ""))} placeholder="apelido" autoCapitalize="none" autoCorrect="off" className="w-full bg-transparent px-2 py-3 outline-none" />
        </div>
        {erro && <p className="text-sm text-erro" role="alert">{erro}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={fechar} className="flex-1 rounded-xl border border-borda py-2.5">Cancelar</button>
          <button disabled={ocupado || apelido.replace("@", "").length < 3} className="flex-1 rounded-xl bg-neon py-2.5 font-extrabold text-white disabled:opacity-60">{ocupado ? "Procurando…" : "Procurar"}</button>
        </div>
      </form>
    </div>
  );
}
