import test from "node:test";
import assert from "node:assert/strict";
import { limparTema, TEMA_PADRAO, coresDoTema, textoSobre, segundaDe, hexValido } from "../src/tema.ts";

test("o tema padrão é vermelho, com vórtex e abertura ligada", () => {
  assert.equal(TEMA_PADRAO.cor, "vermelho");
  assert.equal(TEMA_PADRAO.fundo, "vortex");
  assert.equal(TEMA_PADRAO.abertura, true);
  assert.deepEqual(limparTema(null), TEMA_PADRAO);
});

test("valores estranhos guardados são corrigidos", () => {
  const t = limparTema({ cor: "<script>", brilho: 900, fundo: "x", cartas: "enorme", animacoes: "sim" });
  assert.equal(t.cor, "vermelho");
  assert.equal(t.brilho, 100);
  assert.equal(t.fundo, "vortex");
  assert.equal(t.cartas, "medio");
  assert.equal(t.animacoes, true);
  assert.equal(limparTema({ cor: "#12ab9f" }).cor, "#12ab9f");
  assert.equal(limparTema({ cor: "azul", brilho: -5 }).brilho, 0);
});

test("cores prontas e personalizadas", () => {
  assert.equal(coresDoTema({ ...TEMA_PADRAO, cor: "ciano" }).principal, "#19e3ff");
  const p = coresDoTema({ ...TEMA_PADRAO, cor: "#00ff00" });
  assert.equal(p.principal, "#00ff00");
  assert.ok(hexValido(p.segunda));
  assert.ok(hexValido(segundaDe("#ffffff")));
});

test("texto sobre a cor principal é legível", () => {
  assert.equal(textoSobre("#ff2a3d"), "#ffffff");
  assert.equal(textoSobre("#ffc21a"), "#08090f");
  assert.equal(textoSobre("#2dff8a"), "#08090f");
});
