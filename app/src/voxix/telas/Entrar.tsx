import { useState, type FormEvent } from "react";
import { ErroApi } from "../api";
import { SITE_DA_CONTA } from "../conta";
import { useVoxix } from "../estado";
import { abrirLink } from "../link";
import { Marca } from "../logo";

export function Entrar() {
  const { entrar } = useVoxix();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    try { await entrar(email, senha); } catch (er) { setErro(er instanceof ErroApi ? er.message : "Não consegui entrar agora."); } finally { setOcupado(false); }
  };

  return (
    <div className="grid h-full place-items-center overflow-auto p-6">
      <form onSubmit={(e) => void enviar(e)} className="w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center gap-2 pb-2">
          <h1 className="sr-only">Voxix</h1>
          <Marca tam={96} />
          <p className="pt-2 text-sm text-suave">Entre com o seu Vetorial ID</p>
        </div>
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className="w-full rounded-xl border border-borda bg-painel px-4 py-3 outline-none focus:border-neon" />
        <input type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" className="w-full rounded-xl border border-borda bg-painel px-4 py-3 outline-none focus:border-neon" />
        {erro && <p className="text-sm text-erro" role="alert">{erro}</p>}
        <button disabled={ocupado} className="w-full rounded-xl bg-neon py-3 font-extrabold text-white disabled:opacity-60">{ocupado ? "Entrando…" : "Entrar"}</button>
        <p className="text-center text-sm text-suave">Ainda não tem conta? <button type="button" onClick={() => abrirLink(SITE_DA_CONTA)} className="text-neon underline">Criar o Vetorial ID</button></p>
      </form>
    </div>
  );
}
