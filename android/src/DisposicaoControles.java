package tech.vetorial.vortex;

/**
 * Controle virtual de cada console: quais controles aparecem na tela do jogo (direcional, analógicos, botões, ombros).
 * É só dados (sem Android), então dá para testar no CI. A pessoa pode trocar o modelo de um console em Ajustes;
 * sem escolha, vale o "automático", que segue o que o console original usava.
 */
public final class DisposicaoControles {
    /** Direcional: nenhum, grande (sem analógico) ou pequeno (acompanha o analógico, para menus). */
    public static final int SEM = 0, GRANDE = 1, PEQUENO = 2;
    /** Conjunto de botões de ação. */
    public static final String AB = "ab", QUATRO = "quatro", PS = "ps", SEGA = "sega";
    /** Ombros: nada, L/R, L/R + L2/R2, N64 (L, R, Z), gatilhos (L2/R2), GameCube (L2/R2 + Z). */
    public static final String NENHUM = "nenhum", LR = "lr", LR2 = "lr2", N64 = "n64", GATILHOS = "gatilhos", GC = "gc";

    public final int direcional;
    public final boolean analogicoEsq, analogicoDir;
    public final String botoes, ombros;
    public final boolean select, start;
    /** Nome mostrado nos Ajustes: o que o "automático" escolheu. */
    public final String resumo;

    private DisposicaoControles(int d, boolean ae, boolean ad, String b, String o, boolean sel, String resumo) {
        this.direcional = d; this.analogicoEsq = ae; this.analogicoDir = ad; this.botoes = b; this.ombros = o; this.select = sel; this.start = true; this.resumo = resumo;
    }

    private static DisposicaoControles d(int dir, boolean ae, boolean ad, String b, String o, boolean sel, String r) { return new DisposicaoControles(dir, ae, ad, b, o, sel, r); }

    /** O que cada console usa de verdade. Plataforma desconhecida cai no padrão (direcional + 4 botões + L/R). */
    public static DisposicaoControles automatica(String plataforma) {
        String p = plataforma == null ? "" : plataforma;
        switch (p) {
            case "nes": case "gb": case "gbc": case "pokemini": case "atari2600": case "atari5200": case "atari7800": case "lynx": case "pcengine": case "pcenginecd":
            case "virtualboy": case "ngp": case "wonderswan": case "intellivision": case "colecovision": case "vectrex": case "odyssey2":
                return d(GRANDE, false, false, AB, NENHUM, true, "Direcional e 2 botões");
            case "mastersystem": case "gamegear": case "sg1000":
                return d(GRANDE, false, false, AB, NENHUM, false, "Direcional e 2 botões");
            case "gba":
                return d(GRANDE, false, false, AB, LR, true, "Direcional, 2 botões e L/R");
            case "snes": case "nds": case "saturn":
                return d(GRANDE, false, false, QUATRO, LR, true, "Direcional, 4 botões e L/R");
            case "genesis": case "segacd": case "sega32x":
                return d(GRANDE, false, false, SEGA, LR, true, "Direcional e botões de 6");
            case "n64":
                return d(PEQUENO, true, true, QUATRO, N64, false, "Analógico, botões C, L/R e Z");
            case "gamecube": case "wii":
                return d(PEQUENO, true, true, QUATRO, GC, false, "Analógico, C-stick e gatilhos");
            case "ps1": case "ps2":
                return d(PEQUENO, true, true, PS, LR2, true, "Direcional, 2 analógicos e L1/R1/L2/R2");
            case "psp":
                return d(PEQUENO, true, false, PS, LR, true, "Analógico, direcional e L/R");
            case "3ds":
                return d(PEQUENO, true, false, QUATRO, LR2, true, "Analógico, direcional e L/R/ZL/ZR");
            case "dreamcast":
                return d(PEQUENO, true, false, QUATRO, GATILHOS, false, "Analógico e gatilhos");
            case "neogeo": case "neogeocd": case "arcade":
                return d(GRANDE, false, false, QUATRO, LR, true, "Direcional e 4 botões");
            default:
                return d(GRANDE, false, false, QUATRO, LR, true, "Direcional, 4 botões e L/R");
        }
    }

    /** Escolhas que a pessoa pode fazer por console (além do automático). */
    public static final String AUTO = "auto", DIRECIONAL = "direcional", ANALOGICO = "analogico", AMBOS = "ambos";

    public static boolean escolhaValida(String e) {
        return AUTO.equals(e) || DIRECIONAL.equals(e) || ANALOGICO.equals(e) || AMBOS.equals(e);
    }

    /** Aplica a escolha da pessoa sobre o automático: só troca o que é direcional/analógico; botões e ombros seguem o console. */
    public static DisposicaoControles de(String plataforma, String escolha) {
        DisposicaoControles a = automatica(plataforma);
        if (escolha == null || AUTO.equals(escolha) || !escolhaValida(escolha)) return a;
        boolean temDireita = a.analogicoDir;
        if (DIRECIONAL.equals(escolha)) return d(GRANDE, false, false, a.botoes, a.ombros, a.select, "Só direcional");
        if (ANALOGICO.equals(escolha)) return d(SEM, true, temDireita, a.botoes, a.ombros, a.select, "Só analógico");
        return d(PEQUENO, true, temDireita, a.botoes, a.ombros, a.select, "Direcional e analógico");
    }

    /** Lê a escolha de um console do texto JSON {"psp":"ambos",...} gravado pelo app (org.json, que já vem no Android). */
    public static String escolhaDe(String json, String plataforma) {
        if (json == null || plataforma == null || plataforma.isEmpty()) return AUTO;
        try {
            org.json.JSONObject o = new org.json.JSONObject(json);
            String e = o.optString(plataforma, AUTO);
            return escolhaValida(e) ? e : AUTO;
        } catch (Exception e) {
            return AUTO;
        }
    }

    public boolean temAnalogico() { return analogicoEsq || analogicoDir; }
}
