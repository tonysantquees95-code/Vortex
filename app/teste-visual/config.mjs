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
    ["primeira-abertura", "primeira", async (p) => { await p.waitForTimeout(1000); }],
    ["o-que-ha-de-novo", "atualizou", async (p) => { await p.getByText("O que há de novo").first().waitFor(); }],
    ...ABAS.map((a) => [`aba-${a.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}`, "normal", async (p, ajuda) => { await ajuda.aba(p, a); }]),
    ["botao-voxix-na-barra", "normal", async (p) => { await p.getByRole("button", { name: /Voxix/ }).first().waitFor(); await p.waitForTimeout(300); }],
    ["feedback", "normal", async (p, ajuda) => { await ajuda.aba(p, "Ajustes"); await p.getByRole("navigation", { name: "Seções dos ajustes" }).getByRole("button", { name: "Sobre", exact: true }).click(); await p.getByRole("button", { name: "Enviar feedback" }).evaluate((e) => e.click()); await p.getByText(/^FEEDBACK/).waitFor(); await p.waitForTimeout(300); }],
    ["ajustes-temas-prontos", "normal", async (p, ajuda) => { await ajuda.aba(p, "Ajustes"); await p.getByRole("navigation", { name: "Seções dos ajustes" }).getByRole("button", { name: "Visual", exact: true }).click(); await p.getByText("Temas prontos").first().waitFor(); await p.locator(".pronto", { hasText: "TV de tubo" }).evaluate((e) => e.click()); await p.waitForTimeout(500); }],
    ["ajustes-conquistas", "normal", async (p, ajuda) => { await ajuda.aba(p, "Ajustes"); await p.getByRole("navigation", { name: "Seções dos ajustes" }).getByRole("button", { name: "Conquistas", exact: true }).click(); await p.getByText(/conquistas$/).first().waitFor(); await p.waitForTimeout(300); }],
    ["ajustes-dentro-do-jogo", "normal", async (p, ajuda) => { await ajuda.aba(p, "Ajustes"); await p.getByRole("navigation", { name: "Seções dos ajustes" }).getByRole("button", { name: "Emuladores", exact: true }).click(); await p.getByText("Dentro do jogo").first().waitFor(); await p.getByRole("button", { name: "TV de tubo", exact: true }).first().evaluate((e) => e.click()); await p.waitForTimeout(300); }],
    ["biblioteca-por-console", "normal", async (p, ajuda) => {
      await ajuda.aba(p, "Biblioteca");
      const c = p.locator(".chip").nth(1); if (await c.count()) await c.click();
      await p.waitForTimeout(300);
    }],
  ],
};
