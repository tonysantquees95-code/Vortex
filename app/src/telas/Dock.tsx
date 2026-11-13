import { Icone } from "./Icones";

export interface ItemDoDock { id: string; nome: string; icone: string; /** botão de ação (não é uma seção) */ acao?: boolean; girando?: boolean; desligado?: boolean }

/** Dock de seções: o ícone da seção ativa fica maior e com o nome ao lado. Foco (teclado/controle) já seleciona a seção. */
export function Dock({ itens, ativo, aoEscolher, selecionarAoFocar = false, rotulo, foco = true }: { itens: ItemDoDock[]; ativo: string; aoEscolher: (id: string) => void; selecionarAoFocar?: boolean; rotulo: string; /** false = o controle (direcional e analógico) não chega aqui; só toque, mouse e os botões LB/RB */ foco?: boolean }) {
  return (
    <nav className="dock" aria-label={rotulo}>
      {itens.map((i) => (
        <button key={i.id} {...(foco ? { "data-foco": "" } : { tabIndex: -1 })} className="dock-item" data-ativa={!i.acao && ativo === i.id} aria-label={i.nome} title={i.nome} disabled={i.desligado} aria-current={!i.acao && ativo === i.id ? "page" : undefined}
          onFocus={selecionarAoFocar && !i.acao ? () => aoEscolher(i.id) : undefined} onClick={() => aoEscolher(i.id)}>
          <Icone nome={i.icone} className={i.girando ? "size-6 orbita" : "size-6"} />
          <span className="dock-nome">{i.nome}</span>
        </button>
      ))}
    </nav>
  );
}
