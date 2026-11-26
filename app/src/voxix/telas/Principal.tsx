import { useCallback, useEffect, useState } from "react";
import { lista, totalNaoLidas } from "../armazem";
import { BUILD, haNovaVersao, procurarVersao } from "../atualizacao";
import { useVoxix } from "../estado";
import { Icone } from "../icones";
import { Logo } from "../logo";
import { Avatar, useAvatarDe } from "../avatares";
import { PapelDeParede } from "../papel";
import { Ajustes } from "./Ajustes";
import { Conversa } from "./Conversa";
import { NovaConversa } from "./NovaConversa";
import { Comunidade } from "./Comunidade";
import { ListaComunidades } from "./Comunidades";
import { avisosLigados, pedirAvisos, permissaoDeAvisos } from "../avisos";

const hora = (t: number): string => {
  const d = new Date(t);
  const hoje = new Date();
  return d.toDateString() === hoje.toDateString() ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

export function Principal() {
  const { armazem, aberta, abrir, conexao, perfil } = useVoxix();
  const [painel, setPainel] = useState<"nova" | "ajustes" | null>(null);
  const [aba, setAba] = useState<"conversas" | "comunidades">("conversas");
  const [comAberta, setComAberta] = useState<string | null>(null);
  const [versaoCom, setVersaoCom] = useState(0);
  const recarregarCom = useCallback(() => setVersaoCom((n) => n + 1), []);
  const fecharCom = useCallback(() => setComAberta(null), []);
  const algoAberto = !!aberta || !!comAberta;
  useEffect(() => { if (aberta) setComAberta(null); }, [aberta]);
  const abrirConversa = (a: string) => { setComAberta(null); abrir(a); };
  const abrirCom = (id: string) => { abrir(null); setAba("comunidades"); setComAberta(id); };
  const conversas = lista(armazem);
  const naoLidas = totalNaoLidas(armazem);

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)] md:grid-cols-[340px_minmax(0,1fr)]">
      <aside className={`${algoAberto ? "hidden md:flex" : "flex"} relative min-h-0 flex-col overflow-hidden border-r border-borda bg-painel`}>
        <PapelDeParede qual="inicio" />
        <header className="relative z-[1] px-4 pb-1 pt-3">
          <div className="flex items-center gap-3">
            <Logo tam={32} />
            <div className="min-w-0 flex-1 text-lg font-extrabold leading-tight">Voxix{naoLidas > 0 && <span className="ml-2 rounded-full bg-magenta px-2 py-0.5 text-xs text-[#1a0620]">{naoLidas}</span>}</div>
            <button onClick={() => setPainel("nova")} aria-label="Nova conversa" className="botao-redondo grid h-9 w-9 place-items-center bg-neon text-xl font-bold text-white"><Icone nome="adicionar" tam={22} /></button>
          </div>
          <button onClick={() => setPainel("ajustes")} aria-label="Abrir meus ajustes" className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-borda bg-black/20 px-3 py-2 text-left">
            <Avatar valor={perfil?.avatar} nome={perfil?.nome ?? "?"} tam={48} />
            <span className="min-w-0 flex-1">
              <b className="block truncate leading-tight">{perfil?.nome}</b>
              <span className="block truncate text-xs text-suave">@{perfil?.apelido} · <span className={conexao === "conectado" ? "text-ok" : conexao === "conectando" ? "text-aviso" : "text-erro"}>{conexao === "conectado" ? "ao vivo" : conexao === "conectando" ? "conectando…" : "sem conexão"}</span></span>
            </span>
            <Icone nome="config" tam={20} />
          </button>
        </header>
        <div className="relative z-[1]"><Aviso /><AvisoDeNotificacao /></div>
        <div className="relative z-[1] mx-4 mb-2 grid grid-cols-2 gap-2" role="tablist">
          {([["conversas", "Conversas", "enviar"], ["comunidades", "Comunidades", "grupo"]] as const).map(([id, rot, ico]) => (
            <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)} className={`flex items-center justify-center gap-1.5 rounded-xl border py-1.5 text-sm font-bold ${aba === id ? "border-neon bg-neon/15 text-neon" : "border-borda text-suave"}`}><Icone nome={ico} tam={16} />{rot}</button>
          ))}
        </div>
        <div className="rolagem relative z-[1] min-h-0 flex-1 overflow-y-auto">
          {aba === "comunidades" && <ListaComunidades atual={comAberta} aoAbrir={abrirCom} versao={versaoCom} />}
          {aba === "conversas" && conversas.length === 0 && <p className="px-6 py-10 text-center text-sm text-suave">Nenhuma conversa ainda. Toque no <b className="text-neon">+</b> e procure um amigo pelo apelido.</p>}
          {aba === "conversas" && conversas.map((c) => {
            const ult = c.mensagens[c.mensagens.length - 1];
            return (
              <button key={c.apelido} onClick={() => abrirConversa(c.apelido)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5 ${aberta === c.apelido ? "bg-white/10" : ""}`}>
                <span className="flex-none"><AvatarDe apelido={c.apelido} nome={c.nome} tam={44} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2"><b className="truncate">{c.nome}</b><span className="flex-none text-xs text-suave">{ult ? hora(ult.criado) : ""}</span></span>
                  <span className="flex justify-between gap-2"><span className="truncate text-sm text-suave">{ult ? `${ult.minha ? "Você: " : ""}${ult.corpo}` : "Diga oi!"}</span>{c.naoLidas > 0 && <span className="flex-none rounded-full bg-magenta px-2 text-xs font-bold text-[#1a0620]">{c.naoLidas}</span>}</span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>
      <main className={`${algoAberto ? "flex" : "hidden md:flex"} relative min-h-0 flex-col`}>
        {!algoAberto && <PapelDeParede qual="inicio" />}
        {comAberta ? <Comunidade id={comAberta} aoVoltar={fecharCom} aoMudou={recarregarCom} aoSumir={fecharCom} /> : aberta ? <Conversa apelido={aberta} /> : <div className="relative z-[1] m-auto text-center text-suave"><Logo tam={72} className="mx-auto mb-3" /><p>Escolha uma conversa ou uma comunidade</p></div>}
      </main>
      {painel === "nova" && <NovaConversa fechar={() => setPainel(null)} />}
      {painel === "ajustes" && <Ajustes fechar={() => setPainel(null)} />}
    </div>
  );
}

function AvatarDe({ apelido, nome, tam }: { apelido: string; nome: string; tam: number }) {
  return <Avatar valor={useAvatarDe(apelido)} nome={nome} tam={tam} />;
}

/** Aviso de versão nova (confere uma vez ao abrir). */
function Aviso() {
  const [nova, setNova] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    void procurarVersao().then((v) => { if (vivo && v && haNovaVersao(BUILD, v.numero)) setNova(v.numero); }).catch(() => undefined);
    return () => { vivo = false; };
  }, []);
  if (!nova) return null;
  return <div className="mx-4 mb-2 rounded-xl border border-neon/40 bg-neon/10 px-3 py-2 text-xs">Há uma versão nova do Voxix (1.{nova}). Abra os <b>Ajustes</b> para atualizar.</div>;
}

/** Convite para liberar os avisos de mensagem (a permissão só pode ser pedida num toque). Some quando liberada ou recusada. */
function AvisoDeNotificacao() {
  const [pedir, setPedir] = useState(false);
  useEffect(() => { void permissaoDeAvisos().then((p) => setPedir(p === "default" && avisosLigados())); }, []);
  if (!pedir) return null;
  return (
    <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-xl border border-neon/40 bg-neon/10 px-3 py-2 text-xs">
      <span>Quer ser avisado quando chegar mensagem?</span>
      <button onClick={() => { void pedirAvisos().then(() => permissaoDeAvisos().then((p) => setPedir(p === "default"))); }} className="flex-none rounded-lg bg-neon px-3 py-1 font-bold text-white">Ativar avisos</button>
    </div>
  );
}
