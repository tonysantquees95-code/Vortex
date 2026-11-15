import test from "node:test";
import assert from "node:assert/strict";
import { lerId, detectar, entradaAtiva, normalizar, linksDeDriver, PASSOS } from "../src/controle.ts";

test("lerId: formato novo e formato antigo do Chromium", () => {
  assert.deepEqual(lerId("Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)"), { nome: "Xbox 360 Controller", vid: "045e", pid: "028e" });
  assert.deepEqual(lerId("054c-09cc-Wireless Controller"), { nome: "Wireless Controller", vid: "054c", pid: "09cc" });
  assert.equal(lerId("Controle esquisito").vid, "");
});

test("detectar: botão apertado, eixo que saiu do repouso e ruído ignorado", () => {
  assert.deepEqual(detectar([0, 0], [false, true], [0, 0]), { t: "b", i: 1 });
  assert.deepEqual(detectar([0, 0], [false], [0, -1]), { t: "e", i: 1, v: -1 });
  assert.equal(detectar([0, 0], [false], [0.2, 0.1]), null);
  // setinha solta (1,29) não conta; um dos 8 valores exatos conta
  const repouso = Array(10).fill(0); repouso[9] = 1.29;
  assert.equal(detectar(repouso, [], repouso), null);
  const hat = repouso.slice(); hat[9] = -1;
  assert.deepEqual(detectar(repouso, [], hat), { t: "e", i: 9, v: -1 });
});

test("normalizar: o perfil leva o botão físico para a posição padrão e a setinha crua some", () => {
  const mapa = { A: { t: "b", i: 2 }, Cima: { t: "e", i: 9, v: -1 } };
  const n = normalizar(mapa, [false, false, true], Array(10).fill(0).map((_, k) => (k === 9 ? -1 : 0)));
  assert.equal(n.botoes[0], true);
  assert.equal(n.botoes[12], true);
  assert.equal(n.eixos[9], 1.3);
  assert.deepEqual(normalizar(null, [true], [0]), { botoes: [true], eixos: [0] });
  assert.ok(entradaAtiva({ t: "e", i: 0, v: 1 }, [], [0.9]));
  assert.ok(!entradaAtiva({ t: "e", i: 0, v: 1 }, [], [-0.9]));
});

test("linksDeDriver: com código do aparelho busca no catálogo da Microsoft; sem código só pesquisa", () => {
  const com = linksDeDriver({ nome: "Pad", vid: "045e", pid: "028e" });
  assert.ok(com.some((l) => l.url.includes("VID_045E%26PID_028E")));
  assert.ok(com.every((l) => l.url.startsWith("https://")));
  assert.equal(linksDeDriver({ nome: "Pad", vid: "", pid: "" }).length, 1);
  assert.equal(new Set(PASSOS.map((p) => p.id)).size, PASSOS.length);
});

import { limparTema, TEMA_PADRAO } from "../src/tema.ts";
test("luz do logo: valores estranhos voltam ao padrão e os bons ficam", () => {
  assert.equal(limparTema({}).luz, "padrao");
  assert.equal(limparTema({ luz: "rgb" }).luz, "rgb");
  assert.equal(limparTema({ luz: "laser" }).luz, TEMA_PADRAO.luz);
  assert.equal(limparTema({ luzCor: "#12abef" }).luzCor, "#12abef");
  assert.equal(limparTema({ luzCor: "vermelho" }).luzCor, TEMA_PADRAO.luzCor);
});
