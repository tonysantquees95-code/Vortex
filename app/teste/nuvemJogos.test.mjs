import test from "node:test";
import assert from "node:assert/strict";
import { chaveDoJogo, chaveDoCaminho, jogosQueFaltam } from "../src/nuvemJogos.ts";

test("a chave é a mesma do motor", () => {
  assert.equal(chaveDoJogo("gamecube", "Need for Speed - Most Wanted (USA).nkit".replace(/\.nkit$/, "")), "gamecube-need-for-speed-most-wanted-usa");
  assert.equal(chaveDoCaminho("gba", "C:\\Jogos\\Pokémon Fire.gba"), "gba-pok-mon-fire");
  assert.ok(chaveDoJogo("snes", "x".repeat(100)).length <= 60);
});

test("mostra só o que falta aqui, um por jogo", () => {
  const saves = [
    { jogo: "gba-pok-mon-fire", arquivo: "jogo.srm", bytes: 1, atualizado: 5, dispositivo: "Celular" },
    { jogo: "nes-super-mario", arquivo: "jogo.srm", bytes: 1, atualizado: 3, dispositivo: "Celular" },
    { jogo: "nes-super-mario", arquivo: "estado.auto", bytes: 1, atualizado: 9, dispositivo: "Celular" },
  ];
  const f = jogosQueFaltam(saves, [{ plataforma: "gba", caminho: "/x/Pokémon Fire.gba" }], ["gba", "nes"]);
  assert.equal(f.length, 1);
  assert.equal(f[0].titulo, "Super Mario");
  assert.equal(f[0].plataforma, "nes");
  assert.equal(f[0].atualizado, 9);
});
