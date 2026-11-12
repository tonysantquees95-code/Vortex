import { Icone } from "./Icones";

export interface ItemDoDock { id: string; nome: string; icone: string }

/** Dock de seções: o ícone da seção ativa fica maior e com o nome ao lado. Foco (teclado/controle) já seleciona a seção. */
export function Dock({ itens, ativo, aoEscolher, selecionarAoFocar = false, rotulo }: { itens: ItemDoDock[]; ativo: string; aoEscolher: (id: string) => void; selecionarAoFocar?: boolean; rotulo: string }) {
  return (
    <nav className="dock" aria-label={rotulo}>
      {itens.map((i) => (
        <button key={i.id} data-foco className="dock-item" data-ativa={ativo === i.id} aria-label={i.nome} aria-current={ativo === i.id ? "page" : undefined}
          onFocus={selecionarAoFocar ? () => aoEscolher(i.id) : undefined} onClick={() => aoEscolher(i.id)}>
          <Icone nome={i.icone} className="size-6" />
          <span className="dock-nome">{i.nome}</span>
        </button>
      ))}
    </nav>
  );
}
