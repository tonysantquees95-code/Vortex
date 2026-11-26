import { useEffect, useState } from "react";
import { api, ErroApi, type PerfilPublico, type Presenca } from "../api";
import { useVoxix } from "../estado";
import { Avatar } from "../avatares";
import { Icone } from "../icones";

const OPCOES: { id: Presenca; nome: string; texto: string }[] = [
  { id: "amigos", nome: "Só amigos", texto: "Quem já conversou com você ou divide uma comunidade vê o que você está jogando." },
  { id: "todos", nome: "Todos", texto: "Qualquer pessoa do Voxix vê o que você está jogando." },
  { id: "invisivel", nome: "Invisível", texto: "Ninguém vê o que você está jogando agora. Seus jogos mais jogados e conquistas continuam no perfil." },
];

const dia = (t: number) => new Date(t).toLocaleDateString("pt-BR");

/** O perfil de uma pessoa: avatar, jogando agora, 3 mais jogados e conquistas. */
export function CartaoDePerfil({ perfil }: { perfil: PerfilPublico }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar valor={perfil.avatar} nome={perfil.nome} tam={56} />
        <div className="min-w-0"><b className="block truncate text-lg">{perfil.nome}</b><span className="text-sm text-suave">@{perfil.apelido}</span></div>
      </div>
      {perfil.jogandoAgora && (
        <p className="rounded-xl border border-neon px-4 py-2 text-sm" role="status">Jogando agora: <b>{perfil.jogandoAgora.jogo}</b></p>
      )}
      <section>
        <h3 className="text-sm font-bold text-suave">Mais jogados</h3>
        {perfil.maisJogados.length === 0 ? <p className="mt-1 text-sm text-suave">Ainda sem jogos registrados.</p> : (
          <ol className="mt-1 space-y-1.5">
            {perfil.maisJogados.map((j, i) => (
              <li key={j.jogo} className="flex items-center justify-between gap-3 rounded-xl border border-borda px-4 py-2 text-sm"><span className="min-w-0 truncate"><b>{i + 1}.</b> {j.jogo}</span><span className="flex-none text-suave">{j.horas} h</span></li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <h3 className="text-sm font-bold text-suave">Conquistas</h3>
        {perfil.conquistas.length === 0 ? <p className="mt-1 text-sm text-suave">Nenhuma ainda.</p> : (
          <ul className="mt-1 flex flex-wrap gap-2">
            {perfil.conquistas.map((c) => <li key={c.id} className="rounded-full border border-borda px-3 py-1 text-xs">{c.nome}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Ver o perfil de outra pessoa (aberto a partir da conversa). */
export function VerPerfil({ apelido, fechar }: { apelido: string; fechar: () => void }) {
  const { sessao } = useVoxix();
  const [p, setP] = useState<PerfilPublico | null | "erro">(null);
  useEffect(() => { if (sessao) void api.pessoa(sessao.token, apelido).then(setP).catch(() => setP("erro")); }, [sessao, apelido]);
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-4" onClick={fechar}>
      <div onClick={(e) => e.stopPropagation()} className="rolagem max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-borda bg-painel p-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold">Perfil</h2><button onClick={fechar} aria-label="Fechar" className="grid min-h-10 min-w-10 place-items-center text-suave"><Icone nome="fechar" tam={22} /></button></div>
        {p === null ? <p className="text-sm text-suave">Carregando…</p> : p === "erro" ? <p className="text-sm text-erro">Não consegui abrir este perfil agora.</p> : <CartaoDePerfil perfil={p} />}
      </div>
    </div>
  );
}

/** Meu perfil: como os outros me veem, trocar o @ e escolher quem vê o que estou jogando. */
export function MeuPerfil({ fechar }: { fechar: () => void }) {
  const { sessao, perfil, mudarApelido } = useVoxix();
  const [publico, setPublico] = useState<PerfilPublico | null>(null);
  const [presenca, setPresenca] = useState<Presenca>("amigos");
  const [proxima, setProxima] = useState<number | null>(null);
  const [novo, setNovo] = useState("");
  const [msg, setMsg] = useState<{ erro: boolean; texto: string } | null>(null);
  const [trocando, setTrocando] = useState(false);

  useEffect(() => {
    if (!sessao || !perfil) return;
    void api.perfil(sessao.token).then((p) => { if (p.presenca) setPresenca(p.presenca); setProxima(p.proximaTroca ?? null); }).catch(() => undefined);
    void api.pessoa(sessao.token, perfil.apelido).then(setPublico).catch(() => undefined);
  }, [sessao, perfil?.apelido]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolher = async (p: Presenca) => {
    if (!sessao) return;
    const antes = presenca;
    setPresenca(p);
    try { await api.definirPresenca(sessao.token, p); setMsg({ erro: false, texto: "Privacidade atualizada." }); }
    catch { setPresenca(antes); setMsg({ erro: true, texto: "Não consegui salvar agora. Tente de novo." }); }
  };
  const bloqueado = proxima !== null && proxima > Date.now();
  const trocar = async () => {
    const a = novo.trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{3,20}$/.test(a)) { setMsg({ erro: true, texto: "O @ tem de 3 a 20 letras, números ou _ (sem espaço nem acento)." }); return; }
    setTrocando(true); setMsg(null);
    try { setProxima(await mudarApelido(a)); setNovo(""); setMsg({ erro: false, texto: `Pronto! Agora você é @${a}. Suas conversas e mensagens continuam com você.` }); }
    catch (e) { setMsg({ erro: true, texto: e instanceof ErroApi ? e.message : "Não consegui trocar agora." }); }
    finally { setTrocando(false); }
  };

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-4" onClick={fechar}>
      <div onClick={(e) => e.stopPropagation()} className="rolagem max-h-[calc(100vh-2rem)] w-full max-w-sm space-y-5 overflow-y-auto rounded-2xl border border-borda bg-painel p-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">Meu perfil</h2><button onClick={fechar} aria-label="Fechar" className="grid min-h-10 min-w-10 place-items-center text-suave"><Icone nome="fechar" tam={22} /></button></div>
        {publico ? <CartaoDePerfil perfil={publico} /> : <p className="text-sm text-suave">Carregando…</p>}
        <section>
          <h3 className="text-sm font-bold text-suave">Quem vê o que estou jogando</h3>
          <div role="radiogroup" aria-label="Quem vê o que estou jogando" className="mt-2 space-y-2.5">
            {OPCOES.map((o) => {
              const marcado = presenca === o.id;
              return (
                <button key={o.id} role="radio" aria-checked={marcado} onClick={() => void escolher(o.id)} className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left ${marcado ? "border-neon bg-neon/10" : "border-borda"}`}>
                  <span className={`mt-0.5 grid size-5 flex-none place-items-center rounded-full border-2 ${marcado ? "border-neon" : "border-borda"}`} aria-hidden>{marcado && <span className="size-2.5 rounded-full bg-neon" />}</span>
                  <span className="min-w-0"><b className="block">{o.nome}{marcado ? " · escolhido" : ""}</b><span className="block text-xs text-suave">{o.texto}</span></span>
                </button>
              );
            })}
          </div>
        </section>
        <section>
          <h3 className="text-sm font-bold text-suave">Trocar meu @</h3>
          <p className="mt-1 text-sm">Agora: <b>@{perfil?.apelido}</b></p>
          {bloqueado ? <p className="mt-1 text-sm text-suave">Você já trocou o @ há pouco. Dá para trocar de novo em {dia(proxima!)}.</p> : (
            <>
              <p className="mt-1 text-xs text-suave">Dá para trocar uma vez a cada 30 dias. O @ antigo fica guardado só para você por 60 dias, caso queira voltar. Suas conversas não se perdem.</p>
              <div className="mt-2 flex gap-2">
                <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="novo_arroba" autoCapitalize="none" autoCorrect="off" maxLength={21} className="min-w-0 flex-1 rounded-xl border border-borda bg-transparent px-3 py-2" />
                <button disabled={trocando || !novo.trim()} onClick={() => void trocar()} className="flex-none rounded-xl bg-neon px-4 py-2 font-bold text-white disabled:opacity-40">{trocando ? "Trocando…" : "Trocar"}</button>
              </div>
            </>
          )}
        </section>
        {msg && <p role="status" className={`text-sm ${msg.erro ? "text-erro" : "text-neon"}`}>{msg.texto}</p>}
      </div>
    </div>
  );
}
