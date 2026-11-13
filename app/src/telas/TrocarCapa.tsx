import { useEffect, useRef, useState } from "react";
import type { Jogo } from "../ponte";
import { buscarCapas, definirCapa, reduzirImagem, refazerCapa } from "../capas";
import { Camada } from "./pecas";

/** Troca a capa de um jogo: procura pelo nome na lista da Libretro, usa uma imagem da galeria, cola um link ou volta ao automático. */
export function TrocarCapa({ jogo, aoFechar }: { jogo: Jogo; aoFechar: () => void }) {
  const [texto, setTexto] = useState(jogo.titulo);
  const [achados, setAchados] = useState<{ nome: string; url: string }[] | null>(null);
  const [link, setLink] = useState("");
  const [aviso, setAviso] = useState("");
  const arquivo = useRef<HTMLInputElement | null>(null);

  const procurar = async (t: string) => { setAchados(null); setAchados(await buscarCapas(jogo.plataforma, t)); };
  useEffect(() => { void procurar(texto); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const escolher = (url: string) => { definirCapa(jogo.id, url); aoFechar(); };
  const daGaleria = async (f: File | undefined) => {
    if (!f) return;
    try { escolher(await reduzirImagem(f)); } catch { setAviso("Não consegui abrir essa imagem."); }
  };
  const usarLink = () => {
    if (!/^https:\/\/\S+$/i.test(link.trim())) { setAviso("Cole um endereço de imagem que comece com https://"); return; }
    const img = new Image();
    img.onload = () => escolher(link.trim());
    img.onerror = () => setAviso("Esse endereço não abriu como imagem.");
    img.src = link.trim();
  };

  return (
    <Camada aoFechar={aoFechar}>
      <div className="vidro entrar flex w-[min(720px,94vw)] max-h-[90vh] flex-col gap-4 overflow-hidden p-6">
        <h3 className="titulo-neon text-xl font-extrabold">Trocar capa</h3>
        <p className="text-sm text-slate-300">{jogo.titulo}</p>
        <div className="flex gap-2">
          <input data-foco className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2" value={texto} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void procurar(texto); }} aria-label="Nome para procurar" />
          <button data-foco className="botao primario" onClick={() => void procurar(texto)}>Buscar</button>
        </div>
        <div className="rolagem grid min-h-[120px] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
          {achados === null && <p className="col-span-full text-slate-400">Procurando…</p>}
          {achados !== null && achados.length === 0 && <p className="col-span-full text-slate-400">Nada com esse nome na lista. Tente menos palavras (ex.: só “batman”), ou use a galeria ou um link.</p>}
          {achados?.map((a) => (
            <button key={a.url} data-foco className="flex flex-col gap-1 text-left" onClick={() => escolher(a.url)} title={a.nome}>
              <span className="relative block aspect-[3/4] overflow-hidden rounded-lg border border-white/10 bg-black/30"><img src={a.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /></span>
              <span className="line-clamp-2 text-[11px] leading-tight text-slate-300">{a.nome}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input data-foco className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2" placeholder="Colar link da imagem (https://…)" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Link da imagem" />
          <button data-foco className="botao" onClick={usarLink}>Usar link</button>
        </div>
        {aviso && <p className="text-sm text-rose-300">{aviso}</p>}
        <div className="flex flex-wrap gap-3">
          <button data-foco className="botao" onClick={() => arquivo.current?.click()}>Da galeria</button>
          <button data-foco className="botao" onClick={() => { refazerCapa(jogo.id); aoFechar(); }}>Refazer automática</button>
          <button data-foco className="botao" onClick={aoFechar}>Fechar</button>
          <input ref={arquivo} type="file" accept="image/*" hidden onChange={(e) => void daGaleria(e.target.files?.[0])} />
        </div>
      </div>
    </Camada>
  );
}
