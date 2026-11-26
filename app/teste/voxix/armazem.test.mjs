import test from "node:test";
import assert from "node:assert/strict";
import { vazio, receber, enviando, confirmar, falhou, marcarLida, lista, totalNaoLidas, ler, apagarConversa, MAX_POR_CONVERSA } from "../../src/voxix/armazem.ts";

test("mensagem recebida cria a conversa, conta como não lida e não duplica", () => {
  let a = receber(vazio(), "Beto", "Beto Silva", "id1", "oi", 100);
  a = receber(a, "beto", "Beto Silva", "id1", "oi", 100); // chegou de novo (fila + ao vivo)
  assert.equal(a.conversas.beto.mensagens.length, 1);
  assert.equal(totalNaoLidas(a), 1);
  a = marcarLida(a, "BETO");
  assert.equal(totalNaoLidas(a), 0);
});

test("conversa aberta não acumula não lidas", () => {
  const a = receber(vazio(), "beto", "Beto", "id1", "oi", 100, true);
  assert.equal(totalNaoLidas(a), 0);
});

test("o que eu envio aparece na hora e vira 'enviada' quando o servidor confirma", () => {
  let a = enviando(vazio(), "beto", "Beto", "local1", "bora?", 200);
  assert.equal(a.conversas.beto.mensagens[0].estado, "enviando");
  a = confirmar(a, "beto", "local1", "srv1", 205);
  const m = a.conversas.beto.mensagens[0];
  assert.deepEqual([m.id, m.estado, m.criado, m.minha], ["srv1", "enviada", 205, true]);
  a = enviando(a, "beto", "Beto", "local2", "ué", 300);
  a = falhou(a, "beto", "local2");
  assert.equal(a.conversas.beto.mensagens[1].estado, "falhou");
});

test("lista põe a conversa mais recente primeiro e o histórico respeita o limite", () => {
  let a = receber(vazio(), "ana", "Ana", "a1", "oi", 100);
  a = receber(a, "beto", "Beto", "b1", "oi", 300);
  assert.deepEqual(lista(a).map((c) => c.apelido), ["beto", "ana"]);
  for (let i = 0; i < MAX_POR_CONVERSA + 50; i++) a = receber(a, "ana", "Ana", `x${i}`, "m", 1000 + i, true);
  assert.equal(a.conversas.ana.mensagens.length, MAX_POR_CONVERSA);
  assert.equal(apagarConversa(a, "ana").conversas.ana, undefined);
});

test("leitura ignora lixo e o que estava 'enviando' vira 'falhou' (o app fechou no meio)", () => {
  assert.deepEqual(ler(null), vazio());
  assert.deepEqual(ler({ conversas: 5 }), vazio());
  const a = ler({ conversas: { Beto: { apelido: "Beto", nome: "Beto", naoLidas: 2, ultima: 9, mensagens: [{ id: "1", corpo: "oi", criado: 1, minha: true, estado: "enviando" }, { id: 2 }, { id: "3", corpo: "x", criado: 2 }] }, ruim: 7 } });
  assert.equal(a.conversas.beto.mensagens.length, 2);
  assert.equal(a.conversas.beto.mensagens[0].estado, "falhou");
  assert.equal(a.conversas.beto.naoLidas, 2);
});

test("histórico do servidor entra sem repetir e confirmar não duplica", async () => {
  const A = await import("../../src/voxix/armazem.ts");
  let a = A.vazio();
  a = A.enviando(a, "beto", "Beto", "local1", "oi", 100);
  // o histórico traz a mesma mensagem com o id do servidor, antes da confirmação
  a = A.mesclarHistorico(a, [{ id: "srv1", minha: true, apelido: "beto", nome: "Beto", corpo: "oi", criado: 100 }, { id: "srv2", minha: false, apelido: "beto", nome: "Beto", corpo: "e aí", criado: 200 }], true);
  a = A.confirmar(a, "beto", "local1", "srv1", 100);
  assert.deepEqual(a.conversas.beto.mensagens.map((m) => m.id), ["srv1", "srv2"]);
  assert.equal(a.conversas.beto.naoLidas, 1); // só a que veio do outro conta como não lida
  assert.equal(A.temMensagem(a, "srv2"), true);
  const b = A.mesclarHistorico(A.vazio(), [{ id: "x", minha: false, apelido: "ana", nome: "Ana", corpo: "oi", criado: 1 }], false);
  assert.equal(b.conversas.ana.naoLidas, 0); // primeira carga num aparelho novo: nada de "não lido" antigo
});
