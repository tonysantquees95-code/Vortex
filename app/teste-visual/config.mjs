// Telas que o teste visual visita no Vortex (no navegador roda o motor de demonstração, sem celular de verdade).
import { readFileSync } from "node:fs";
const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const TERMOS = src("termos.ts").match(/VERSAO_DOS_TERMOS\s*=\s*(\d+)/)[1];
const ABAS = [...src("App.tsx").match(/const ABAS[^=]*=\s*\[(.*)\];/)[1].matchAll(/\["[a-z]+", "([^"]+)"/g)].map((m) => m[1]);

export default {
  porta: 4184,
  espera: 1800,
  guardado: (modo) => modo === "primeira" ? {} : {
    "vortex.tour": "1", "vortex.termos": TERMOS, "vortex:configurado": "1",
    "vortex.novidades.vistas": modo === "atualizou" ? "0" : "9999",
  },
  respostas: {},
  cenarios: [
    ["primeira-abertura", "primeira", async () => {}],
    ["o-que-ha-de-novo", "atualizou", async (p) => { await p.getByText("O que há de novo").first().waitFor(); }],
    ...ABAS.map((a) => [`aba-${a.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}`, "normal", async (p, ajuda) => { await ajuda.aba(p, a); }]),
    ["biblioteca-por-console", "normal", async (p, ajuda) => {
      await ajuda.aba(p, "Biblioteca");
      const c = p.locator(".chip").nth(1); if (await c.count()) await c.click();
      await p.waitForTimeout(300);
    }],
  ],
};
