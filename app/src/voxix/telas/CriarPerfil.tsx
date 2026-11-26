import { useState, type FormEvent } from "react";
import { ErroApi } from "../api";
import { useVoxix } from "../estado";
import { Logo } from "../logo";

export function CriarPerfil({ aoCriar }: { aoCriar: () => void }) {
  const { sessao, criarPerfil, sair } = useVoxix();
  const [apelido, setApelido] = useState("");
  const [nome, setNome] = useState(sessao?.nome ?? "");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    try { await criarPerfil(apelido, nome.trim() || apelido); aoCriar(); } catch (er) { setErro(er instanceof ErroApi ? er.message : "Não consegui salvar agora."); } finally { setOcupado(false); }
  };

  return (
    <div className="grid h-full place-items-center overflow-auto p-6">
      <form onSubmit={(e) => void salvar(e)} className="w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center gap-2 pb-2">
          <Logo tam={64} />
          <h1 className="text-xl font-extrabold">Escolha o seu apelido</h1>
          <p className="text-center text-sm text-suave">É assim que seus amigos vão te achar. <b className="text-texto">Depois de escolhido, o apelido não muda.</b></p>
        </div>
        <div className="flex items-center rounded-xl border border-borda bg-painel px-4 focus-within:border-neon">
          <span className="text-suave">@</span>
          <input required minLength={3} maxLength={20} value={apelido} onChange={(e) => setApelido(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="seu_apelido" autoCapitalize="none" autoCorrect="off" className="w-full bg-transparent px-2 py-3 outline-none" />
        </div>
        <input maxLength={40} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome para mostrar (opcional)" className="w-full rounded-xl border border-borda bg-painel px-4 py-3 outline-none focus:border-neon" />
        <p className="text-xs text-suave">3 a 20 letras minúsculas, números ou _ (sem espaço nem acento).</p>
        {erro && <p className="text-sm text-erro" role="alert">{erro}</p>}
        <button disabled={ocupado || apelido.length < 3} className="w-full rounded-xl bg-neon py-3 font-extrabold text-white disabled:opacity-60">{ocupado ? "Salvando…" : "Continuar"}</button>
        <button type="button" onClick={() => void sair()} className="w-full text-sm text-suave underline">Sair da conta</button>
      </form>
    </div>
  );
}
