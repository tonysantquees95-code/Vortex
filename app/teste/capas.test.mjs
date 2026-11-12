import test from "node:test";
import assert from "node:assert/strict";
import { artigoNoFim, candidatosDeCapa, nomeDoArquivo, nomeSeguro } from "../src/capas.ts";
import { infoDoConsole } from "../src/consoles.ts";

test("artigo vai para o fim como no No-Intro", () => {
  assert.equal(artigoNoFim("The Legend of Zelda - A Link to the Past"), "Legend of Zelda, The - A Link to the Past");
  assert.equal(artigoNoFim("Super Mario World"), "Super Mario World");
  assert.equal(artigoNoFim("A Boy and His Blob"), "Boy and His Blob, A");
});

test("nome do arquivo sem pasta e sem extensão, no Windows e no Android", () => {
  assert.equal(nomeDoArquivo("C:\\Jogos\\SNES\\Super Mario World (USA).sfc"), "Super Mario World (USA)");
  assert.equal(nomeDoArquivo("/storage/emulated/0/Roms/Contra.nes"), "Contra");
  assert.equal(nomeSeguro("Tom & Jerry: O Filme"), "Tom _ Jerry_ O Filme");
});

test("candidatos: nome do arquivo primeiro, depois título com a região do jogo", () => {
  const c = candidatosDeCapa({ titulo: "The Legend of Zelda", caminho: "/r/Legend of Zelda, The (USA).sfc", plataforma: "snes", regioes: ["Europa"] });
  assert.ok(c.length >= 3 && c.length <= 7);
  assert.ok(c[0].includes("Super%20Nintendo%20Entertainment%20System/Named_Boxarts/Legend%20of%20Zelda%2C%20The%20(USA).png"), c[0]);
  assert.ok(c[1].endsWith("Legend%20of%20Zelda%2C%20The%20(Europe).png"), c[1]);
  assert.equal(new Set(c).size, c.length);
});

test("console sem sistema na Libretro só usa a capa que o motor já trouxe", () => {
  assert.deepEqual(candidatosDeCapa({ titulo: "X", caminho: "x.apk", plataforma: "android" }), []);
  assert.deepEqual(candidatosDeCapa({ titulo: "X", caminho: "x.apk", plataforma: "android", capa_online: "https://a/b.png" }), ["https://a/b.png"]);
  assert.equal(infoDoConsole("naoexiste").curto, "NAOE");
});
