import { useCallback, useEffect, useState } from "react";
import type { ArquivoDoDrive, ListaDoDrive, Motor, ProgressoDoDrive } from "../ponte";

const ROMS = /\.(gba|gbc|gb|nes|sfc|smc|snes|md|gen|smd|n64|z64|v64|nds|iso|cue|bin|chm|pce|gg|sms|a26|lnx|ngp|ws|wsc|zip|7z|chd|cso|rvz|gcm)$/i;
const CONSOLE: Record<string, string> = { gba: "gba", gbc: "gbc", gb: "gb", nes: "nes", sfc: "snes", smc: "snes", md: "megadrive", gen: "megadrive", smd: "megadrive", n64: "n64", z64: "n64", v64: "n64", nds: "nds", pce: "pcengine", gg: "gamegear", sms: "mastersystem" };

export function tamanho(b: number): string {
  if (b >= 1024 ** 3) return (b / 1024 ** 3).toFixed(2).replace(".", ",") + " GB";
  if (b >= 1024 ** 2) return (b / 1024 ** 2).toFixed(1).replace(".", ",") + " MB";
  return Math.max(1, Math.round(b / 1024)) + " KB";
}
/** Pasta sugerida pelo nome: ROMs conhecidas vão para roms/<console>, o resto para documentos. */
export function pastaSugerida(nome: string): string {
  const ext = (nome.split(".").pop() ?? "").toLowerCase();
  if (CONSOLE[ext]) return "roms/" + CONSOLE[ext];
  return ROMS.test(nome) ? "roms/outros" : "documentos";
}
/** O nome sem barras ou ponto inicial, como o servidor exige. */
export function nomeLimpo(nome: string): string { return nome.replace(/[\\/\u0000-\u001f]/g, "_").replace(/^\.+/, "").trim().slice(0, 120); }

export function TelaDrive({ motor, avisar, aoMudarBiblioteca }: { motor: Motor; avisar: (t: string) => void; aoMudarBiblioteca: () => void }) {
  const drive = motor.drive!;
  const [dados, setDados] = useState<ListaDoDrive | null>(null);
  const [erro, setErro] = useState("");
  const [prog, setProg] = useState<ProgressoDoDrive | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const carregar = useCallback(async () => {
    try { setDados(await drive.lista()); setErro(""); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
  }, [drive]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => drive.aoProgredir(setProg), [drive]);

  const tente = async (f: () => Promise<void>) => {
    setOcupado(true);
    try { await f(); } catch (e) { avisar(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); setProg(null); void carregar(); }
  };
  const enviar = () => tente(async () => {
    const a = await drive.escolher();
    if (!a) return;
    const nome = nomeLimpo(a.nome);
    if (a.bytes > (dados?.maxArquivo ?? 2 * 1024 ** 3)) { avisar(`Esse arquivo tem ${tamanho(a.bytes)}. O limite por arquivo é ${tamanho(dados?.maxArquivo ?? 2 * 1024 ** 3)}.`); return; }
    await drive.enviar(a.uri, pastaSugerida(nome), nome);
    avisar(`“${nome}” está no seu Vetorial Drive.`);
  });
  const baixar = (f: ArquivoDoDrive) => tente(async () => {
    const r = await drive.baixar(f.pasta, f.nome);
    if (f.pasta.startsWith("roms")) {
      try { await motor.adicionarPasta(r.pasta); await motor.escanear(); aoMudarBiblioteca(); avisar(`“${f.nome}” baixado e adicionado à sua biblioteca.`); return; } catch { /* sem permissão de arquivos: o arquivo foi baixado do mesmo jeito */ }
    }
    avisar(`“${f.nome}” baixado em ${r.pasta}.`);
  });
  const apagar = (f: ArquivoDoDrive) => { if (!window.confirm(`Apagar “${f.nome}” do Vetorial Drive? Isso não apaga as cópias que estão nos seus aparelhos.`)) return; void tente(async () => { await drive.apagar(f.pasta, f.nome); }); };

  const pct = dados && dados.cota > 0 ? Math.min(100, (dados.usado / dados.cota) * 100) : 0;
  return (
    <div className="grid gap-4">
      {erro && <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">{erro}</p>}
      {dados && (
        <section className="vidro p-5" aria-label="Espaço usado">
          <div className="flex items-baseline justify-between"><span className="font-black">Espaço usado</span><span className="text-sm text-slate-300">{tamanho(dados.usado)} de {tamanho(dados.cota)}</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-300" style={{ width: pct + "%" }} /></div>
          <p className="mt-2 text-xs text-slate-400">Arquivos de até {tamanho(dados.maxArquivo)}. Só você vê o que está aqui.</p>
        </section>
      )}
      <div className="flex flex-wrap gap-3">
        <button data-foco className="botao primario" disabled={ocupado} onClick={() => void enviar()}>{ocupado && prog?.acao === "enviar" ? "Enviando…" : "Enviar arquivo"}</button>
        {ocupado && <button data-foco className="botao" onClick={() => void drive.cancelar()}>Cancelar</button>}
        <button data-foco className="botao" disabled={ocupado} onClick={() => void carregar()}>Atualizar lista</button>
      </div>
      {prog && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3" role="status">
          <div className="text-sm">{prog.acao === "enviar" ? "Enviando" : "Baixando"} “{prog.nome}” · {tamanho(prog.feito)}{prog.total > 0 ? ` de ${tamanho(prog.total)}` : ""}</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-300" style={{ width: (prog.total > 0 ? Math.min(100, (prog.feito / prog.total) * 100) : 0) + "%" }} /></div>
        </div>
      )}
      {dados && !dados.arquivos.length && !erro && <p className="text-sm text-slate-300">Nada por aqui ainda. Envie documentos ou ROMs e baixe em qualquer aparelho com a sua conta.</p>}
      <ul className="grid gap-2">
        {dados?.arquivos.map((f) => (
          <li key={f.pasta + "/" + f.nome} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="min-w-0"><div className="truncate font-semibold">{f.nome}</div><div className="text-xs text-slate-400">{f.pasta} · {tamanho(f.bytes)}{f.atualizado ? " · " + new Date(f.atualizado).toLocaleDateString("pt-BR") : ""}</div></div>
            <div className="flex gap-2">
              <button data-foco className="botao" disabled={ocupado} onClick={() => void baixar(f)}>Baixar</button>
              <button data-foco className="botao" disabled={ocupado} onClick={() => apagar(f)}>Apagar</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
