import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useMotor } from "../estado";
import type { EstadoConta } from "../ponte";
import { LogoVortex } from "./LogoVortex";

const SITE_DA_CONTA = "https://venus-servidor.tonysantquees95.workers.dev/conta.html";

/**
 * O Vortex é grátis, mas só abre com o Vetorial ID (decisão de 2026-11-26: a Vetorial Tech precisa saber quem baixa e usa
 * os seus produtos). Sem plano e sem pagamento: estar com a conta aberta neste aparelho basta. Depois do primeiro login
 * a sessão fica guardada e o jogo abre mesmo sem internet. Quem já tinha o app instalado cai nesta tela na próxima abertura.
 */
export function Portao({ children }: { children: ReactNode }) {
  const motor = useMotor();
  const conta = motor.conta;
  const [estado, setEstado] = useState<EstadoConta | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const conferir = useCallback(async () => {
    if (!conta) return;
    try { setEstado(await conta.estado()); } catch { setEstado((e) => e ?? { logado: false, vortex: false }); }
  }, [conta]);
  useEffect(() => { void conferir(); }, [conferir]);

  if (!conta) return <>{children}</>;
  if (!estado) return <div className="fundo-tela" />;
  if (estado.logado) return <>{children}</>;

  const tente = async (f: () => Promise<void>) => { setOcupado(true); setMsg(""); try { await f(); } catch (e) { setMsg(String(e instanceof Error ? e.message : e)); } finally { setOcupado(false); } };
  const aberto = (url: string) => { void (motor.abrirUrl ? motor.abrirUrl(url) : Promise.resolve(window.open(url, "_blank", "noopener"))); };

  return (
    <div className="fundo-tela">
      {/* a regra ".fundo-tela > *" desliga o clique dos filhos (é para as camadas de fundo): aqui o conteúdo precisa de clique */}
      <div className="grid place-items-center overflow-y-auto p-4" style={{ pointerEvents: "auto" }}>
        <main className="vidro grid w-[min(440px,94vw)] gap-3 p-6 text-center">
          <span className="marca-vx"><LogoVortex /></span>
          <h1 className="text-2xl font-semibold">Entre no Vortex</h1>
          <p className="text-sm text-slate-300">O Vortex é grátis. Use o seu Vetorial ID, o mesmo da Vênus, ou crie a sua conta (leva um minuto). {estado.mensagem}</p>
          <input className="campo" type="email" autoComplete="username" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="campo" type="password" autoComplete="current-password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <button data-foco className="botao primario" disabled={ocupado || !email || !senha} onClick={() => tente(async () => { setEstado(await conta.entrar(email, senha)); setSenha(""); })}>Entrar</button>
          <button data-foco className="botao" onClick={() => aberto(SITE_DA_CONTA)}>Criar conta ou recuperar a senha</button>
          <p className="text-xs text-slate-400">O cadastro vale para todos os apps da Vetorial Tech. Esqueceu a senha? Recupere por e-mail ou SMS no site.</p>
          {msg && <p role="alert" className="text-sm text-rose-300">{msg}</p>}
        </main>
      </div>
    </div>
  );
}
