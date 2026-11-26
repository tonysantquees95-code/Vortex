import test from "node:test";
import assert from "node:assert/strict";
import { linkDoConvite, SERVIDOR } from "../../src/voxix/api.ts";
import { TOUR } from "../../src/voxix/apresentacao.ts";

test("link do convite aponta para a página do servidor com o código", () => {
  assert.equal(linkDoConvite("ABCD2345"), `${SERVIDOR}/voxix/entrar/ABCD2345`);
});
test("a apresentação explica comunidades e convites", () => {
  const p = TOUR.find((x) => /comunidade/i.test(x.titulo));
  assert.ok(p && p.como?.some((c) => /convid/i.test(c)));
});
