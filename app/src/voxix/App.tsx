import { useState } from "react";
import { useVoxix } from "./estado";
import { Entrar } from "./telas/Entrar";
import { CriarPerfil } from "./telas/CriarPerfil";
import { Principal } from "./telas/Principal";
import { Logo } from "./logo";
import { Apresentacao } from "./telas/Apresentacao";
import { Novidades } from "./telas/Novidades";
import { precisaApresentar } from "./apresentacao";
import { lerVisto, marcarVisto, novasDesde, ultimoId } from "./novidades";

export function App() {
  const { sessao, perfil } = useVoxix();
  const [, forcar] = useState(0);
  const [apresentar, setApresentar] = useState(precisaApresentar);
  // primeira instalação: a apresentação já explica tudo, então só passa a contar as novidades daqui para frente
  const [novidades, setNovidades] = useState(() => { const v = lerVisto(); if (v === null) { marcarVisto(ultimoId()); return []; } return novasDesde(v); });
  if (apresentar) return <Apresentacao aoConcluir={() => setApresentar(false)} />;
  if (!sessao) return <Entrar />;
  if (perfil === undefined) return <Carregando />;
  if (perfil === null) return <CriarPerfil aoCriar={() => forcar((n) => n + 1)} />;
  return <><Principal />{novidades.length > 0 && <Novidades itens={novidades} aoFechar={() => setNovidades([])} />}</>;
}

function Carregando() {
  return <div className="grid h-full place-items-center"><Logo tam={64} className="gravando" /></div>;
}
