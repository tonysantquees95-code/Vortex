import test from "node:test";
import assert from "node:assert/strict";
import { androidParaJogos, ehAndroid, pacoteDe, falhaDeAbertura, limparFalhas } from "../src/androidApps.ts";
import { capaConhecida } from "../src/capas.ts";

test("apps do Android viram jogos da biblioteca Android, com o ícone como capa", () => {
  const l = androidParaJogos([{ pacote: "com.b", nome: "Zeta", icone: "data:image/png;base64,AA" }, { pacote: "com.a", nome: "Alfa", icone: "data:image/png;base64,BB" }], { "android:com.b": 1 });
  assert.deepEqual(l.map((j) => j.titulo), ["Alfa", "Zeta"]);
  assert.equal(l[0].plataforma, "android");
  assert.ok(ehAndroid(l[0]) && pacoteDe(l[0]) === "com.a");
  assert.equal(l[1].favorito, true);
  assert.equal(capaConhecida("android:com.a"), "data:image/png;base64,BB");
});

test("sem armazenamento, a contagem de falhas não quebra", () => {
  assert.equal(falhaDeAbertura("x"), false);
  limparFalhas("x");
});
