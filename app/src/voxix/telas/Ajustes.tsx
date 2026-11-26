import { useEffect, useState } from "react";
import { api, type Pessoa } from "../api";
import { BUILD, enderecoDoDownload, haNovaVersao, procurarVersao } from "../atualizacao";
import { useVoxix } from "../estado";
import { plataforma } from "../conta";
import { avisosLigados, ligarAvisos, permissaoDeAvisos, pedirAvisos, type PermissaoAvisos } from "../avisos";
import { abrirLink } from "../link";
import { Logo } from "../logo";
import { Icone } from "../icones";
import { Personalizar } from "./Personalizar";
import { NOVIDADES } from "../novidades";
import { Novidades } from "./Novidades";
import { FeedbackDoApp } from "./FeedbackDoApp";
import { Termos, Tour } from "./Apresentacao";
import { EscolherAvatar } from "./EscolherAvatar";
import { MeuPerfil } from "./PerfilEPrivacidade";

export function Ajustes({ fechar }: { fechar: () => void }) {
  const { sessao, perfil, sair } = useVoxix();
  const [bloqueados, setBloqueados] = useState<Pessoa[] | null>(null);
  const [versao, setVersao] = useState("");
  const [novaVersao, setNovaVersao] = useState(false);
  const [ver, setVer] = useState<"tour" | "termos" | "novidades" | "feedback" | null>(null);
  const [personalizando, setPersonalizando] = useState(false);
  const [meuPerfil, setMeuPerfil] = useState(false);
  const [avisos, setAvisos] = useState(avisosLigados());
  const [permissao, setPermissao] = useState<PermissaoAvisos>("default");
  useEffect(() => { void permissaoDeAvisos().then(setPermissao); }, []);
  const mudarAvisos = async (v: boolean) => {
    setAvisos(v);
    ligarAvisos(v);
    if (v && permissao !== "granted") setPermissao((await pedirAvisos()) ? "granted" : await permissaoDeAvisos());
  };

  useEffect(() => { if (sessao) void api.bloqueios(sessao.token).then((r) => setBloqueados(r.bloqueios)).catch(() => setBloqueados([])); }, [sessao]);

  const desbloquear = async (a: string) => {
    if (!sessao) return;
    await api.desbloquear(sessao.token, a).catch(() => undefined);
    setBloqueados((l) => (l ?? []).filter((p) => p.apelido !== a));
  };
  const procurar = async () => {
    setVersao("Procurando…");
    let falha: "rede" | "servidor" | null = null;
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        const v = await procurarVersao();
        if (!v) { falha = "servidor"; continue; }
        if (haNovaVersao(BUILD, v.numero)) { setNovaVersao(true); setVersao(`Versão nova disponível: 1.${v.numero}. Toque em Baixar.`); }
        else { setNovaVersao(false); setVersao("Você já está na versão mais nova."); }
        return;
      } catch { falha = "rede"; }
    }
    setVersao(falha === "rede" ? "Sem conexão com a internet agora. Confira o Wi-Fi ou os dados e tente de novo." : "O servidor não respondeu agora. Tente de novo em instantes.");
  };

  return (
    <div className="fixed inset-0 z-10 grid place-items-center bg-black/70 p-4" onClick={fechar}>
      <div onClick={(e) => e.stopPropagation()} className="rolagem max-h-[calc(100vh-2rem)] w-full max-w-sm space-y-4 overflow-y-auto rounded-2xl border border-borda bg-painel p-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">Ajustes</h2><button onClick={fechar} aria-label="Fechar" className="grid min-h-10 min-w-10 place-items-center text-xl text-suave"><Icone nome="fechar" tam={22} /></button></div>
        <EscolherAvatar />
        <section><h3 className="text-sm font-bold text-suave">Conta</h3><p className="mt-1">@{perfil?.apelido} · {perfil?.nome}</p><p className="text-xs text-suave">{sessao?.email}</p>
          <button onClick={() => setMeuPerfil(true)} className="mt-2 flex w-full items-center gap-3 rounded-xl border border-borda px-4 py-3 text-left"><span className="min-w-0 flex-1"><b className="block">Meu perfil, @ e privacidade</b><span className="block text-xs text-suave">Jogos mais jogados, conquistas, trocar o @ e escolher quem vê o que você está jogando.</span></span><span className="text-suave"><Icone nome="seta" tam={18} /></span></button>
        </section>
        <section>
          <h3 className="text-sm font-bold text-suave">Personalizar</h3>
          <button onClick={() => setPersonalizando(true)} className="mt-2 flex w-full items-center gap-3 rounded-xl border border-borda px-4 py-3 text-left">
            <Logo tam={40} />
            <span className="min-w-0 flex-1"><b className="block">Cores, formato, fundo e teclado</b><span className="block text-xs text-suave">Cor com RGB, formato dos ícones, papel de parede, emojis e o teclado do Voxix.</span></span>
            <span className="text-suave"><Icone nome="seta" tam={18} /></span>
          </button>
        </section>
        <section>
          <h3 className="text-sm font-bold text-suave">Avisos</h3>
          <label className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-borda px-4 py-3 text-sm">
            <span className="min-w-0"><b className="block">Avisar quando chegar mensagem</b><span className="block text-xs text-suave">Uma notificação no celular, no computador ou no navegador, quando a conversa não está na tela.</span></span>
            <input type="checkbox" checked={avisos} onChange={(e) => void mudarAvisos(e.target.checked)} className="h-5 w-5 flex-none accent-[var(--color-neon)]" />
          </label>
          {avisos && permissao === "denied" && <p className="mt-1 text-xs text-erro">Os avisos estão bloqueados neste aparelho. Libere a notificação do Voxix nas configurações do navegador ou do sistema.</p>}
          {avisos && permissao === "indisponivel" && <p className="mt-1 text-xs text-suave">Este navegador não mostra avisos. No iPhone, instale o Voxix na tela de início (Compartilhar › Adicionar à Tela de Início) e abra por lá.</p>}
          {avisos && permissao === "default" && <button onClick={() => void mudarAvisos(true)} className="mt-2 rounded-xl border border-borda px-4 py-2 text-sm">Permitir avisos neste aparelho</button>}
        </section>
        <section>
          <h3 className="text-sm font-bold text-suave">Bloqueados</h3>
          {bloqueados === null ? <p className="mt-1 text-sm text-suave">Carregando…</p> : bloqueados.length === 0 ? <p className="mt-1 text-sm text-suave">Ninguém bloqueado.</p> : bloqueados.map((p) => (
            <div key={p.apelido} className="mt-1 flex items-center justify-between text-sm"><span>@{p.apelido}</span><button onClick={() => void desbloquear(p.apelido)} className="text-neon underline">Desbloquear</button></div>
          ))}
        </section>
        {plataforma() === "web" ? (
          <section>
            <h3 className="text-sm font-bold text-suave">Instalar no celular</h3>
            <p className="mt-1 text-sm">Esta versão no navegador sempre está atualizada. Para ter o ícone do Voxix na tela de início:</p>
            <p className="mt-1 text-xs text-suave">iPhone (Safari): toque em Compartilhar e em “Adicionar à Tela de Início”.<br />Android (Chrome): menu ⋮ e “Instalar app”.</p>
          </section>
        ) : (
        <section>
          <h3 className="text-sm font-bold text-suave">Atualização</h3>
          <p className="mt-1 text-sm">Versão instalada: {BUILD > 0 ? `1.${BUILD}` : "desenvolvimento"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button onClick={() => void procurar()} className="rounded-xl border border-borda px-4 py-2 text-sm">Procurar atualizações</button>
            {novaVersao && <button onClick={() => abrirLink(enderecoDoDownload())} className="rounded-xl bg-neon px-4 py-2 text-sm font-bold text-white">Baixar</button>}
          </div>
          {versao && <p className="mt-1 text-xs text-suave" role="status">{versao}</p>}
        </section>
        )}
        <section>
          <h3 className="text-sm font-bold text-suave">Sobre o Voxix</h3>
          <div className="mt-2 flex flex-col gap-2 text-sm">
            <button onClick={() => setVer("tour")} className="rounded-xl border border-borda px-4 py-2 text-left">Como o Voxix funciona</button>
            <button onClick={() => setVer("novidades")} className="rounded-xl border border-borda px-4 py-2 text-left">O que há de novo</button>
            <button onClick={() => setVer("feedback")} className="rounded-xl border border-borda px-4 py-2 text-left">Enviar feedback</button>
            <button onClick={() => setVer("feedback")} className="rounded-xl border border-borda px-4 py-2 text-left">Reportar um erro</button>
            <button onClick={() => setVer("termos")} className="rounded-xl border border-borda px-4 py-2 text-left">Termos de uso</button>
          </div>
        </section>
        <p className="text-xs text-suave">As conversas ficam guardadas na sua conta e aparecem em todos os aparelhos em que você entrar. Apagar uma conversa a remove só para você.</p>
        <button onClick={() => void sair()} className="w-full rounded-xl border border-erro py-2.5 font-bold text-erro">Sair da conta</button>
      </div>
      {meuPerfil && <MeuPerfil fechar={() => setMeuPerfil(false)} />}
      {personalizando && <Personalizar fechar={() => setPersonalizando(false)} irParaInicio={fechar} />}
      {ver === "tour" && <div className="fixed inset-0 z-50 flex flex-col bg-fundo p-5" onClick={(e) => e.stopPropagation()}><div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col"><Tour rotuloFinal="Fechar" aoTerminar={() => setVer(null)} aoFechar={() => setVer(null)} /></div></div>}
      {ver === "termos" && <Termos aoFechar={() => setVer(null)} />}
      {ver === "feedback" && <FeedbackDoApp aoFechar={() => setVer(null)} />}
      {ver === "novidades" && <Novidades itens={[...NOVIDADES].sort((a, b) => b.id - a.id)} aoFechar={() => setVer(null)} />}
    </div>
  );
}
