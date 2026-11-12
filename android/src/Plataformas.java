package tech.vetorial.vortex;

import java.util.ArrayList;
import java.util.List;

/** Catálogo de plataformas (gerado do catálogo do motor em Rust: extensões, nomes de pasta e núcleos do RetroArch). */
public final class Plataformas {
    public static final class P {
        public final String id, nome, tipo;
        public final String[] extensoes, pastas, nucleos;
        public final boolean exigePasta;
        P(String id, String nome, String tipo, String[] e, String[] p, String[] n, boolean x) {
            this.id = id; this.nome = nome; this.tipo = tipo; this.extensoes = e; this.pastas = p; this.nucleos = n; this.exigePasta = x;
        }
    }

    private static P p(String id, String nome, String tipo, String[] e, String[] pa, String[] n, boolean x) { return new P(id, nome, tipo, e, pa, n, x); }

    public static final List<P> TODAS = new ArrayList<P>();
    static {
        TODAS.add(p("nes", "Nintendo 8 bits (NES/Famicom)", "console", new String[]{"nes", "unf", "unif", "fds"}, new String[]{"nes", "famicom", "nintendo", "fc", "fds"}, new String[]{"mesen_libretro", "fceumm_libretro", "nestopia_libretro"}, false));
        TODAS.add(p("snes", "Super Nintendo", "console", new String[]{"smc", "sfc", "fig", "swc", "bs"}, new String[]{"snes", "supernintendo", "superfamicom", "sfc", "sfam"}, new String[]{"snes9x_libretro", "bsnes_libretro", "mesen-s_libretro"}, false));
        TODAS.add(p("n64", "Nintendo 64", "console", new String[]{"n64", "z64", "v64", "ndd"}, new String[]{"n64", "nintendo64"}, new String[]{"mupen64plus_next_libretro", "parallel_n64_libretro"}, false));
        TODAS.add(p("gb", "Game Boy", "portatil", new String[]{"gb"}, new String[]{"gb", "gameboy"}, new String[]{"gambatte_libretro", "sameboy_libretro", "mgba_libretro"}, false));
        TODAS.add(p("gbc", "Game Boy Color", "portatil", new String[]{"gbc"}, new String[]{"gbc", "gameboycolor"}, new String[]{"gambatte_libretro", "sameboy_libretro", "mgba_libretro"}, false));
        TODAS.add(p("gba", "Game Boy Advance", "portatil", new String[]{"gba", "agb"}, new String[]{"gba", "gameboyadvance"}, new String[]{"mgba_libretro", "vbanext_libretro"}, false));
        TODAS.add(p("nds", "Nintendo DS", "portatil", new String[]{"nds", "dsi"}, new String[]{"nds", "ds", "nintendods"}, new String[]{"melonds_libretro", "desmume_libretro"}, false));
        TODAS.add(p("3ds", "Nintendo 3DS", "portatil", new String[]{"3ds", "cia", "cxi", "cci"}, new String[]{"3ds", "nintendo3ds"}, new String[]{"citra_libretro"}, false));
        TODAS.add(p("gamecube", "Nintendo GameCube", "console", new String[]{"gcm", "gcz", "rvz", "ciso", "iso"}, new String[]{"gc", "gamecube", "ngc"}, new String[]{"dolphin_libretro"}, false));
        TODAS.add(p("wii", "Nintendo Wii", "console", new String[]{"wbfs", "wad", "rvz", "wia", "iso"}, new String[]{"wii"}, new String[]{"dolphin_libretro"}, false));
        TODAS.add(p("switch", "Nintendo Switch", "console", new String[]{"nsp", "xci", "nca"}, new String[]{"switch", "nsw"}, new String[]{}, false));
        TODAS.add(p("virtualboy", "Virtual Boy", "portatil", new String[]{"vb", "vboy"}, new String[]{"virtualboy", "vb"}, new String[]{"mednafen_vb_libretro"}, false));
        TODAS.add(p("pokemini", "Pokémon Mini", "portatil", new String[]{"min"}, new String[]{"pokemini"}, new String[]{"pokemini_libretro"}, false));
        TODAS.add(p("ps1", "PlayStation", "console", new String[]{"pbp", "cue", "chd", "bin", "iso", "img", "ecm", "mdf", "ccd", "m3u"}, new String[]{"ps1", "psx", "playstation", "psone"}, new String[]{"swanstation_libretro", "pcsx_rearmed_libretro", "mednafen_psx_hw_libretro"}, true));
        TODAS.add(p("ps2", "PlayStation 2", "console", new String[]{"iso", "chd", "cso", "bin", "gz"}, new String[]{"ps2", "playstation2"}, new String[]{"pcsx2_libretro", "play_libretro"}, true));
        TODAS.add(p("psp", "PlayStation Portable", "portatil", new String[]{"cso", "pbp", "iso", "chd"}, new String[]{"psp", "playstationportable"}, new String[]{"ppsspp_libretro"}, true));
        TODAS.add(p("ps3", "PlayStation 3", "console", new String[]{"pkg"}, new String[]{"ps3", "playstation3"}, new String[]{}, true));
        TODAS.add(p("genesis", "Mega Drive / Genesis", "console", new String[]{"md", "gen", "smd", "bin", "mdx"}, new String[]{"genesis", "megadrive", "md", "segagenesis", "segamegadrive"}, new String[]{"genesis_plus_gx_libretro", "picodrive_libretro", "blastem_libretro"}, false));
        TODAS.add(p("mastersystem", "Master System", "console", new String[]{"sms"}, new String[]{"mastersystem", "sms", "segamastersystem"}, new String[]{"genesis_plus_gx_libretro", "smsplus_libretro"}, false));
        TODAS.add(p("gamegear", "Game Gear", "portatil", new String[]{"gg"}, new String[]{"gamegear", "gg"}, new String[]{"genesis_plus_gx_libretro", "smsplus_libretro"}, false));
        TODAS.add(p("sg1000", "SG-1000", "console", new String[]{"sg"}, new String[]{"sg1000", "sg"}, new String[]{"genesis_plus_gx_libretro"}, false));
        TODAS.add(p("segacd", "Mega CD / Sega CD", "console", new String[]{"cue", "chd", "iso", "bin"}, new String[]{"segacd", "megacd", "mcd"}, new String[]{"genesis_plus_gx_libretro", "picodrive_libretro"}, true));
        TODAS.add(p("sega32x", "Sega 32X", "console", new String[]{"32x"}, new String[]{"sega32x", "32x"}, new String[]{"picodrive_libretro"}, false));
        TODAS.add(p("saturn", "Sega Saturn", "console", new String[]{"cue", "chd", "iso", "mdf", "ccd"}, new String[]{"saturn", "segasaturn"}, new String[]{"mednafen_saturn_libretro", "yabasanshiro_libretro", "kronos_libretro"}, true));
        TODAS.add(p("dreamcast", "Dreamcast", "console", new String[]{"gdi", "cdi", "chd", "cue"}, new String[]{"dreamcast", "dc"}, new String[]{"flycast_libretro"}, false));
        TODAS.add(p("atari2600", "Atari 2600", "console", new String[]{"a26"}, new String[]{"atari2600", "a2600"}, new String[]{"stella_libretro"}, false));
        TODAS.add(p("atari5200", "Atari 5200", "console", new String[]{"a52"}, new String[]{"atari5200", "a5200"}, new String[]{"atari800_libretro"}, false));
        TODAS.add(p("atari7800", "Atari 7800", "console", new String[]{"a78"}, new String[]{"atari7800", "a7800"}, new String[]{"prosystem_libretro"}, false));
        TODAS.add(p("lynx", "Atari Lynx", "portatil", new String[]{"lnx"}, new String[]{"lynx", "atarilynx"}, new String[]{"handy_libretro", "mednafen_lynx_libretro"}, false));
        TODAS.add(p("jaguar", "Atari Jaguar", "console", new String[]{"j64", "jag"}, new String[]{"jaguar", "atarijaguar"}, new String[]{"virtualjaguar_libretro"}, false));
        TODAS.add(p("atarist", "Atari ST", "computador", new String[]{"st", "msa", "stx"}, new String[]{"atarist", "st"}, new String[]{"hatari_libretro"}, false));
        TODAS.add(p("pcengine", "PC Engine / TurboGrafx-16", "console", new String[]{"pce", "sgx"}, new String[]{"pcengine", "tg16", "turbografx16", "turbografx"}, new String[]{"mednafen_pce_fast_libretro", "mednafen_pce_libretro"}, false));
        TODAS.add(p("pcenginecd", "PC Engine CD", "console", new String[]{"cue", "chd", "ccd"}, new String[]{"pcenginecd", "tg16cd", "turbografxcd"}, new String[]{"mednafen_pce_libretro"}, true));
        TODAS.add(p("neogeo", "Neo Geo", "arcade", new String[]{"neo"}, new String[]{"neogeo"}, new String[]{"fbneo_libretro", "geolith_libretro"}, true));
        TODAS.add(p("neogeocd", "Neo Geo CD", "console", new String[]{"cue", "chd"}, new String[]{"neogeocd", "ngcd"}, new String[]{"neocd_libretro"}, true));
        TODAS.add(p("ngp", "Neo Geo Pocket", "portatil", new String[]{"ngp", "ngc"}, new String[]{"ngp", "ngpc", "neogeopocket", "neogeopocketcolor"}, new String[]{"mednafen_ngp_libretro"}, false));
        TODAS.add(p("wonderswan", "WonderSwan", "portatil", new String[]{"ws", "wsc"}, new String[]{"wonderswan", "ws", "wsc", "wonderswancolor"}, new String[]{"mednafen_wswan_libretro"}, false));
        TODAS.add(p("arcade", "Arcade (MAME/FBNeo)", "arcade", new String[]{"zip", "7z"}, new String[]{"arcade", "mame", "fbneo", "fba", "cps1", "cps2", "cps3", "naomi", "atomiswave"}, new String[]{"fbneo_libretro", "mame_libretro", "mame2003_plus_libretro"}, true));
        TODAS.add(p("msx", "MSX", "computador", new String[]{"mx1", "mx2", "rom", "dsk", "cas"}, new String[]{"msx", "msx2"}, new String[]{"bluemsx_libretro", "fmsx_libretro"}, true));
        TODAS.add(p("c64", "Commodore 64", "computador", new String[]{"d64", "t64", "prg", "crt", "x64", "g64", "tap"}, new String[]{"c64", "commodore64"}, new String[]{"vice_x64_libretro"}, false));
        TODAS.add(p("amiga", "Amiga", "computador", new String[]{"adf", "adz", "ipf", "lha", "dms", "hdf"}, new String[]{"amiga", "amiga500", "amiga1200"}, new String[]{"puae_libretro"}, false));
        TODAS.add(p("zxspectrum", "ZX Spectrum", "computador", new String[]{"z80", "tzx", "sna", "szx"}, new String[]{"zxspectrum", "spectrum", "zx"}, new String[]{"fuse_libretro"}, false));
        TODAS.add(p("dos", "MS-DOS", "computador", new String[]{"dosz", "com", "bat"}, new String[]{"dos", "msdos", "pcdos"}, new String[]{"dosbox_pure_libretro", "dosbox_core_libretro"}, true));
        TODAS.add(p("scummvm", "ScummVM", "computador", new String[]{"scummvm"}, new String[]{"scummvm"}, new String[]{"scummvm_libretro"}, false));
        TODAS.add(p("3do", "3DO", "console", new String[]{"cue", "chd", "iso"}, new String[]{"3do"}, new String[]{"opera_libretro"}, true));
        TODAS.add(p("intellivision", "Intellivision", "console", new String[]{"int"}, new String[]{"intellivision"}, new String[]{"freeintv_libretro"}, false));
        TODAS.add(p("colecovision", "ColecoVision", "console", new String[]{"col"}, new String[]{"colecovision", "coleco"}, new String[]{"gearcoleco_libretro", "bluemsx_libretro"}, false));
        TODAS.add(p("vectrex", "Vectrex", "console", new String[]{"vec"}, new String[]{"vectrex"}, new String[]{"vecx_libretro"}, false));
        TODAS.add(p("odyssey2", "Odyssey 2 / Videopac", "console", new String[]{"o2"}, new String[]{"odyssey2", "videopac", "o2em"}, new String[]{"o2em_libretro"}, false));
        TODAS.add(p("android", "Jogos Android", "android", new String[]{"apk", "xapk", "apks"}, new String[]{"android", "androidgames", "apk"}, new String[]{}, true));
        TODAS.add(p("pc", "Jogos de PC", "pc", new String[]{"exe", "lnk", "url"}, new String[]{"pc", "windows", "pcgames", "windowsgames", "jogospc"}, new String[]{}, true));
    }

    public static P porId(String id) {
        for (P x : TODAS) if (x.id.equals(id)) return x;
        return null;
    }

    private Plataformas() {}
}
