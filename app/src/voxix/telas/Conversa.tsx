import { useState } from "react";
import { api, ErroApi } from "../api";
import { useVoxix } from "../estado";
import { ChatBase } from "./ChatBase";
import { PapelDaConversa } from "./PapelDaConversa";
import { VerPerfil } from "./PerfilEPrivacidade";
import { Avatar, useAvatarDe } from "../avatares";
import { esquecerPapelDaConversa } from "../papelConversa";

export function Conversa({ apelido }: { apelido: string }) {
  const { armazem, sessao, abrir, enviar, reenviar, apagar } = useVoxix();
  const conversa = armazem.conversas[apelido];
  const [denuncia, setDenuncia] = useState(false);
  const [perfil, setPerfil] = useState(false);
  const [papel, setPapel] = useState(false);
  const foto = useAvatarDe(apelido);
  if (!conversa) return null;
  const mensagens = conversa.mensagens;

  const bloquear = async (avisar: (t: string) => void) => {
    if (!sessao) return;
    try { await api.bloquear(sessao.token, apelido); avisar(`@${apelido} foi bloqueado. Ele não percebe, mas as mensagens dele não chegam mais para você.`); } catch (e) { avisar(e instanceof ErroApi ? e.message : "Não consegui bloquear agora."); }
  };

  return (
    <ChatBase
      chave={apelido}
      titulo={conversa.nome}
      subtitulo={`@${conversa.apelido}`}
      avatar={<Avatar valor={foto} nome={conversa.nome} tam={40} />}
      aoVoltar={() => abrir(null)}
      mensagens={mensagens}
      vazio={`Diga oi para ${conversa.nome}!`}
      menu={[
        { rotulo: "Ver perfil", aoTocar: () => setPerfil(true) },
        { rotulo: "Bloquear", aoTocar: (av) => void bloquear(av) },
        { rotulo: "Papel de parede", aoTocar: () => setPapel(true) },
        { rotulo: "Denunciar", aoTocar: () => setDenuncia(true) },
        { rotulo: "Apagar conversa deste aparelho", perigo: true, aoTocar: () => { esquecerPapelDaConversa(apelido); apagar(apelido); } },
      ]}
      aoEnviar={(t) => enviar(apelido, t)}
      aoReenviar={(id, corpo) => reenviar(apelido, id, corpo)}
      extra={(avisar) => <>{perfil && <VerPerfil apelido={conversa.apelido} fechar={() => setPerfil(false)} />}{papel && <PapelDaConversa chave={apelido} nome={conversa.nome} fechar={() => setPapel(false)} />}{denuncia && sessao && <Denuncia apelido={apelido} trecho={mensagens.filter((m) => !m.minha).slice(-10).map((m) => m.corpo).join("\n")} token={sessao.token} fechar={() => setDenuncia(false)} aoEnviar={() => avisar("Denúncia enviada. Obrigado por avisar.")} />}</>}
    />
  );
}

function Denuncia({ apelido, trecho, token, fechar, aoEnviar }: { apelido: string; trecho: string; token: string; fechar: () => void; aoEnviar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const enviar = async () => {
    setOcupado(true);
    setErro("");
    try { await api.denunciar(token, apelido, motivo, trecho); aoEnviar(); fechar(); } catch (e) { setErro(e instanceof ErroApi ? e.message : "Não consegui enviar a denúncia agora."); } finally { setOcupado(false); }
  };
  return (
    <div className="fixed inset-0 z-10 grid place-items-center bg-black/70 p-4" onClick={fechar}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-3 rounded-2xl border border-borda bg-painel p-5">
        <h2 className="text-lg font-extrabold">Denunciar @{apelido}</h2>
        <p className="text-sm text-suave">Conte o que aconteceu. As últimas mensagens dele nesta conversa vão junto, para a revisão (o Voxix não guarda conversas, então só o que você enviar aqui é visto).</p>
        <textarea autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={3} placeholder="Motivo" className="w-full resize-none rounded-xl border border-borda bg-fundo px-4 py-2.5 outline-none focus:border-neon" />
        {erro && <p className="text-sm text-erro" role="alert">{erro}</p>}
        <div className="flex gap-2">
          <button onClick={fechar} className="flex-1 rounded-xl border border-borda py-2.5">Cancelar</button>
          <button disabled={ocupado || !motivo.trim()} onClick={() => void enviar()} className="flex-1 rounded-xl bg-erro py-2.5 font-extrabold text-[#2a0606] disabled:opacity-60">{ocupado ? "Enviando…" : "Denunciar"}</button>
        </div>
      </div>
    </div>
  );
}
