import { Icone } from "../icones";
import { useRef, useState } from "react";
import { aceitarTermos, marcarTourVisto, TERMOS, TOUR } from "../apresentacao";
import { marcarVisto, ultimoId } from "../novidades";
import { pedirMicrofone } from "../ditado";
import { Logo } from "../logo";

type Fase = "tour" | "permissoes" | "termos";

/** Primeira abertura: conhecer as funções, entender as permissões e aceitar os termos. */
export function Apresentacao({ aoConcluir }: { aoConcluir: () => void }) {
  const [fase, setFase] = useState<Fase>("tour");
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-fundo">
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-5 pb-4 pt-6">
        {fase === "tour" && <Tour aoTerminar={() => setFase("permissoes")} />}
        {fase === "permissoes" && <Permissoes aoVoltar={() => setFase("tour")} aoContinuar={() => setFase("termos")} />}
        {fase === "termos" && <Termos aoVoltar={() => setFase("permissoes")} aoAceitar={() => { aceitarTermos(); marcarTourVisto(); marcarVisto(ultimoId()); aoConcluir(); }} />}
      </div>
    </div>
  );
}

/** Telas passando (deslize ou botões): cada função e como usar. Também abre pelos Ajustes. */
export function Tour({ aoTerminar, rotuloFinal = "Continuar", aoFechar }: { aoTerminar: () => void; rotuloFinal?: string; aoFechar?: () => void }) {
  const [i, setI] = useState(0);
  const inicio = useRef<number | null>(null);
  const p = TOUR[i]!;
  const ultimo = i === TOUR.length - 1;
  const ir = (d: number) => setI((x) => Math.max(0, Math.min(TOUR.length - 1, x + d)));
  return (
    <div className="flex min-h-0 flex-1 flex-col" onTouchStart={(e) => { inicio.current = e.touches[0]!.clientX; }} onTouchEnd={(e) => { if (inicio.current === null) return; const dx = e.changedTouches[0]!.clientX - inicio.current; inicio.current = null; if (Math.abs(dx) > 60) ir(dx < 0 ? 1 : -1); }}>
      <div className="flex items-center justify-between"><Logo tam={32} />{aoFechar ? <button onClick={aoFechar} aria-label="Fechar" className="grid min-h-10 min-w-10 place-items-center text-suave"><Icone nome="fechar" tam={24} /></button> : <button onClick={aoTerminar} className="min-h-10 px-3 text-sm text-suave underline">Pular</button>}</div>
      <div className="rolagem flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto text-center">
        <div className="grid h-24 w-24 place-items-center rounded-3xl border border-borda bg-painel text-5xl shadow-[0_0_40px_-10px_var(--color-neon)]" aria-hidden>{p.icone}</div>
        <h1 className="text-2xl font-extrabold">{p.titulo}</h1>
        <p className="text-suave">{p.texto}</p>
        {p.como && <ul className="w-full space-y-2 rounded-2xl border border-borda bg-painel p-4 text-left text-sm">{p.como.map((c) => <li key={c} className="flex gap-2"><span className="text-neon">›</span><span>{c}</span></li>)}</ul>}
      </div>
      <div className="mb-4 flex justify-center gap-2" aria-label={`Tela ${i + 1} de ${TOUR.length}`}>{TOUR.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-8 bg-neon" : "w-3 bg-white/20"}`} />)}</div>
      <div className="flex gap-3">
        <button disabled={i === 0} onClick={() => ir(-1)} className="rounded-xl border border-borda px-5 py-3 disabled:opacity-30">‹ Voltar</button>
        <button onClick={() => (ultimo ? aoTerminar() : ir(1))} className="flex-1 rounded-xl bg-neon py-3 font-extrabold text-white">{ultimo ? rotuloFinal : "Próximo ›"}</button>
      </div>
    </div>
  );
}

function Permissoes({ aoVoltar, aoContinuar }: { aoVoltar: () => void; aoContinuar: () => void }) {
  const [mic, setMic] = useState<"pendente" | "liberado" | "negado">("pendente");
  const liberar = async () => { setMic((await pedirMicrofone()) ? "liberado" : "negado"); };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div><h1 className="text-2xl font-extrabold">Permissões</h1><p className="mt-1 text-sm text-suave">O Voxix pede o mínimo. Veja o que é usado e por quê:</p></div>
      <ul className="rolagem min-h-0 flex-1 space-y-3 overflow-y-auto">
        <li className="rounded-2xl border border-borda bg-painel p-4">
          <div className="flex items-center justify-between gap-2"><b>🌐 Internet</b><span className="text-xs text-ok">liberada</span></div>
          <p className="mt-1 text-sm text-suave">Para enviar e receber mensagens em tempo real. O Android libera sozinho, não precisa fazer nada.</p>
        </li>
        <li className="rounded-2xl border border-borda bg-painel p-4">
          <div className="flex items-center justify-between gap-2"><b>🎤 Microfone <span className="ml-1 rounded-full bg-neon/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neon">opcional</span></b><span className={`text-xs ${mic === "liberado" ? "text-ok" : mic === "negado" ? "text-erro" : "text-aviso"}`}>{mic === "liberado" ? "liberado" : mic === "negado" ? "não liberado" : "pendente"}</span></div>
          <p className="mt-1 text-sm text-suave">Só para o ditado: ele liga quando você toca no botão do microfone e desliga quando você para. O Voxix não grava conversas nem escuta em segundo plano.</p>
          {mic !== "liberado" && <button onClick={() => void liberar()} className="mt-3 rounded-xl border border-neon px-4 py-2 text-sm font-bold text-neon">Liberar o microfone agora</button>}
          {mic === "negado" && <p className="mt-2 text-xs text-aviso">Sem problema: você pode liberar depois nas configurações do aparelho, ou só digitar.</p>}
        </li>
      </ul>
      <div className="flex gap-3">
        <button onClick={aoVoltar} className="rounded-xl border border-borda px-5 py-3">‹ Voltar</button>
        <button onClick={aoContinuar} className="flex-1 rounded-xl bg-neon py-3 font-extrabold text-white">Continuar</button>
      </div>
    </div>
  );
}

/** Termos de uso: na primeira vez é preciso aceitar; depois dá para reler pelos Ajustes. */
export function Termos({ aoAceitar, aoVoltar, aoFechar }: { aoAceitar?: () => void; aoVoltar?: () => void; aoFechar?: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 ${aoFechar ? "fixed inset-0 z-50 bg-fundo p-5" : ""}`}>
      <h1 className="text-2xl font-extrabold">Termos de uso</h1>
      <div className="rolagem min-h-0 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-borda bg-painel p-4 text-sm text-suave" tabIndex={0}>
        {TERMOS.map((t) => <section key={t.titulo}><h2 className="mb-1 font-bold text-texto">{t.titulo}</h2><p>{t.texto}</p></section>)}
      </div>
      {aoAceitar ? (
        <>
          <label className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-neon" checked={ok} onChange={(e) => setOk(e.target.checked)} />Li e aceito os termos de uso do Voxix.</label>
          <div className="flex gap-3">
            {aoVoltar && <button onClick={aoVoltar} className="rounded-xl border border-borda px-5 py-3">‹ Voltar</button>}
            <button disabled={!ok} onClick={aoAceitar} className="flex-1 rounded-xl bg-neon py-3 font-extrabold text-white disabled:opacity-40">Aceitar e continuar</button>
          </div>
        </>
      ) : <button onClick={aoFechar} className="rounded-xl bg-neon py-3 font-extrabold text-white">Fechar</button>}
    </div>
  );
}
