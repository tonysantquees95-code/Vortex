import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useMotor } from "../estado";
import type { EstadoConta } from "../ponte";
import { avaliar, type Estado } from "../trava";

const SITE_DA_CONTA = "https://venus-servidor.tonysantquees95.workers.dev/conta.html";
const CHAVE_VISTO = "vortex.visto";
const lerVisto = () => { try { return Number(localStorage.getItem(CHAVE_VISTO) ?? 0) || 0; } catch { return 0; } };
const gravarVisto = (n: number) => { try { if (n > lerVisto()) localStorage.setItem(CHAVE_VISTO, String(n)); } catch { /* ok */ } };

/**
 * Trava de segurança: o Vortex só abre com Vetorial ID e licença válidos. O servidor entrega um recibo assinado
 * (Ed25519) que é conferido aqui, sem internet; teste de 7 dias acabado = tela de plano e pagamento.
 */
export function Portao({ children }: { children: ReactNode }) {
  const motor = useMotor();
  const conta = motor.conta;
  const [estado, setEstado] = useState<EstadoConta | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const conferir = useCallback(async () => {
    if (!conta) return;
    try { setEstado(await conta.estado()); } catch { setEstado((e) => e ?? { logado: false, vortex: false }); }
    setAgora(Date.now());
  }, [conta]);
  useEffect(() => { void conferir(); const t = setInterval(() => void conferir(), 5 * 60_000); return () => clearInterval(t); }, [conferir]);

  const trava: Estado | null = estado?.logado ? avaliar(estado.selo, agora, lerVisto()) : null;
  useEffect(() => { if (trava && trava.tipo !== "validar_online") gravarVisto(agora); }, [trava?.tipo, agora]);

  if (!conta) return <>{children}</>;
  if (!estado) return <div className="fundo-tela" />;
  if (trava?.tipo === "livre") return <>{children}</>;

  const tente = async (f: () => Promise<void>) => { setOcupado(true); setMsg(""); try { await f(); } catch (e) { setMsg(String(e instanceof Error ? e.message : e)); } finally { setOcupado(false); } };
  const aberto = (url: string) => { void (motor.abrirUrl ? motor.abrirUrl(url) : Promise.resolve(window.open(url, "_blank", "noopener"))); };
  const sair = () => tente(async () => { await conta.sair(); setEstado({ logado: false, vortex: false }); });

  let corpo: ReactNode;
  if (!estado.logado) {
    corpo = (
      <>
        <h1 className="text-2xl font-semibold">Entre no Vortex</h1>
        <p className="text-sm text-slate-300">Use o seu Vetorial ID, o mesmo da Vênus. {estado.mensagem}</p>
        <input className="campo" type="email" autoComplete="username" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="campo" type="password" autoComplete="current-password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <button data-foco className="botao primario" disabled={ocupado || !email || !senha} onClick={() => tente(async () => { setEstado(await conta.entrar(email, senha)); setSenha(""); setAgora(Date.now()); })}>{ocupado ? "Entrando…" : "Entrar"}</button>
        <button data-foco className="botao" onClick={() => aberto(SITE_DA_CONTA)}>Criar conta ou recuperar a senha</button>
        <p className="text-xs text-slate-400">O cadastro vale para todos os apps da Vetorial Tech. Esqueceu a senha? Recupere por e-mail ou SMS no site.</p>
      </>
    );
  } else if (trava?.tipo === "teste_acabou") {
    corpo = (
      <>
        <h1 className="text-2xl font-semibold">O seu teste acabou</h1>
        <p className="text-sm text-slate-300">Para continuar com os serviços, adicione uma forma de pagamento e escolha um plano. Os seus jogos e saves continuam guardados.</p>
        <button data-foco className="botao primario" onClick={() => aberto(SITE_DA_CONTA)}>Escolher plano e pagar</button>
        <button data-foco className="botao" disabled={ocupado} onClick={() => tente(conferir)}>Já paguei: verificar de novo</button>
        <button className="text-xs text-slate-400 underline" onClick={() => void sair()}>Sair desta conta</button>
      </>
    );
  } else {
    const motivo = trava?.tipo === "validar_online" ? trava.motivo : "";
    corpo = (
      <>
        <h1 className="text-xl font-semibold">Confirmando a sua conta…</h1>
        <p className="text-sm text-slate-300">{motivo === "relogio" ? "A data e a hora deste aparelho não batem com a do servidor. Ajuste o relógio e conecte-se à internet." : motivo === "vencido" ? "Faz tempo que este aparelho não confirma a licença. Conecte-se à internet para continuar." : "Conecte-se à internet para confirmar o seu Vetorial ID."}</p>
        <button data-foco className="botao primario" disabled={ocupado} onClick={() => tente(conferir)}>Tentar agora</button>
        <button className="text-xs text-slate-400 underline" onClick={() => void sair()}>Sair desta conta</button>
      </>
    );
  }
  return (
    <div className="fundo-tela grid min-h-dvh place-items-center p-4">
      <main className="vidro grid w-[min(440px,94vw)] gap-3 p-6 text-center">
        <span className="marca"><span className="nome text-3xl">VORTEX</span></span>
        {corpo}
        {msg && <p role="alert" className="text-sm text-rose-300">{msg}</p>}
      </main>
    </div>
  );
}
