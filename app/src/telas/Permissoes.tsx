import { useCallback, useEffect, useState } from "react";
import type { Motor, Permissao } from "../ponte";

/** Permissões do aparelho: cada uma explica para que serve e abre a tela do sistema para liberar. Ao voltar, confere de novo. */
export function Permissoes({ motor, avisar, aoMudar }: { motor: Motor; avisar: (t: string) => void; aoMudar?: (lista: Permissao[]) => void }) {
  const [lista, setLista] = useState<Permissao[] | null>(null);
  const atualizar = useCallback(() => { motor.permissoes().then((l) => { setLista(l); aoMudar?.(l); }).catch(() => setLista([])); }, [motor, aoMudar]);
  useEffect(() => {
    atualizar();
    window.addEventListener("focus", atualizar);
    document.addEventListener("visibilitychange", atualizar);
    return () => { window.removeEventListener("focus", atualizar); document.removeEventListener("visibilitychange", atualizar); };
  }, [atualizar]);
  if (!lista) return <p className="text-slate-400">Conferindo…</p>;
  if (!lista.length) return <div className="vidro p-4 text-slate-300">Neste aparelho o Vortex não precisa de nenhuma permissão especial.</div>;
  return (
    <div className="grid gap-3">
      {lista.map((p) => (
        <div key={p.id} className="vidro flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0 flex-1 basis-64">
            <div className="font-bold">{p.titulo} <span className="ml-2 text-xs font-semibold uppercase tracking-widest" style={{ color: p.concedida ? "#4ade80" : p.obrigatoria ? "var(--neon)" : "#94a3b8" }}>{p.concedida ? "liberada" : p.obrigatoria ? "necessária" : "opcional"}</span></div>
            <p className="mt-1 text-sm text-slate-400">{p.motivo}</p>
          </div>
          {!p.concedida && <button data-foco className="botao primario" onClick={() => { motor.pedirPermissao(p.id).catch((e) => avisar(String(e instanceof Error ? e.message : e))); }}>Liberar</button>}
        </div>
      ))}
    </div>
  );
}
