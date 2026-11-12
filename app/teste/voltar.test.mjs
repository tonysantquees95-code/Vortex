import test from "node:test";
import assert from "node:assert/strict";
import { registrarVoltar, tratarVoltar } from "../src/voltar.ts";

test("maior prioridade responde primeiro e só ela", () => {
  const vistos = [];
  const a = registrarVoltar(1, () => { vistos.push("aba"); return true; });
  const b = registrarVoltar(3, () => { vistos.push("janela"); return true; });
  assert.equal(tratarVoltar(), true);
  assert.deepEqual(vistos, ["janela"]);
  b();
  assert.equal(tratarVoltar(), true);
  assert.deepEqual(vistos, ["janela", "aba"]);
  a();
});
test("false passa para o próximo e sem ninguém devolve false", () => {
  const vistos = [];
  const x = registrarVoltar(2, () => { vistos.push("x"); return false; });
  const y = registrarVoltar(1, () => { vistos.push("y"); });
  assert.equal(tratarVoltar(), true);
  assert.deepEqual(vistos, ["x", "y"]);
  x(); y();
  assert.equal(tratarVoltar(), false);
});
test("na mesma prioridade o mais recente vai primeiro", () => {
  const v = [];
  const a = registrarVoltar(2, () => { v.push("a"); return true; });
  const b = registrarVoltar(2, () => { v.push("b"); return true; });
  tratarVoltar();
  assert.deepEqual(v, ["b"]);
  a(); b();
});
