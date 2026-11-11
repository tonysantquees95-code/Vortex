//! Catálogo de plataformas: extensões de ROM, nomes de pasta comuns, núcleos do RetroArch e nome do sistema nas capas da Libretro.
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Tipo {
    Console,
    Portatil,
    Arcade,
    Computador,
    Android,
    Pc,
}

#[derive(Debug, Serialize)]
pub struct Plataforma {
    pub id: &'static str,
    pub nome: &'static str,
    pub fabricante: &'static str,
    pub tipo: Tipo,
    /// extensões de arquivo de jogo (minúsculas, sem ponto)
    pub extensoes: &'static [&'static str],
    /// nomes de pasta que indicam a plataforma (já sem acento, minúsculas e só letras e números)
    pub pastas: &'static [&'static str],
    /// núcleos do RetroArch (nome do arquivo sem extensão), do preferido para o reserva
    pub nucleos: &'static [&'static str],
    /// nome do sistema no repositório de capas da Libretro (thumbnails.libretro.com); vazio se não houver
    pub libretro: &'static str,
    /// só vale quando o arquivo está numa pasta com o nome da plataforma (ex.: .exe e .apk existem por toda parte)
    pub exige_pasta: bool,
}

macro_rules! p {
    ($id:expr, $nome:expr, $fab:expr, $tipo:expr, [$($e:expr),*], [$($f:expr),*], [$($n:expr),*], $lib:expr, $exige:expr) => {
        Plataforma { id: $id, nome: $nome, fabricante: $fab, tipo: $tipo, extensoes: &[$($e),*], pastas: &[$($f),*], nucleos: &[$($n),*], libretro: $lib, exige_pasta: $exige }
    };
}
use Tipo::*;

pub static PLATAFORMAS: &[Plataforma] = &[
    p!("nes", "Nintendo 8 bits (NES/Famicom)", "Nintendo", Console, ["nes", "unf", "unif", "fds"], ["nes", "famicom", "nintendo", "fc", "fds"], ["mesen_libretro", "fceumm_libretro", "nestopia_libretro"], "Nintendo - Nintendo Entertainment System", false),
    p!("snes", "Super Nintendo", "Nintendo", Console, ["smc", "sfc", "fig", "swc", "bs"], ["snes", "supernintendo", "superfamicom", "sfc", "sfam"], ["snes9x_libretro", "bsnes_libretro", "mesen-s_libretro"], "Nintendo - Super Nintendo Entertainment System", false),
    p!("n64", "Nintendo 64", "Nintendo", Console, ["n64", "z64", "v64", "ndd"], ["n64", "nintendo64"], ["mupen64plus_next_libretro", "parallel_n64_libretro"], "Nintendo - Nintendo 64", false),
    p!("gb", "Game Boy", "Nintendo", Portatil, ["gb"], ["gb", "gameboy"], ["gambatte_libretro", "sameboy_libretro", "mgba_libretro"], "Nintendo - Game Boy", false),
    p!("gbc", "Game Boy Color", "Nintendo", Portatil, ["gbc"], ["gbc", "gameboycolor"], ["gambatte_libretro", "sameboy_libretro", "mgba_libretro"], "Nintendo - Game Boy Color", false),
    p!("gba", "Game Boy Advance", "Nintendo", Portatil, ["gba", "agb"], ["gba", "gameboyadvance"], ["mgba_libretro", "vbanext_libretro"], "Nintendo - Game Boy Advance", false),
    p!("nds", "Nintendo DS", "Nintendo", Portatil, ["nds", "dsi"], ["nds", "ds", "nintendods"], ["melonds_libretro", "desmume_libretro"], "Nintendo - Nintendo DS", false),
    p!("3ds", "Nintendo 3DS", "Nintendo", Portatil, ["3ds", "cia", "cxi", "cci"], ["3ds", "nintendo3ds"], ["citra_libretro"], "Nintendo - Nintendo 3DS", false),
    p!("gamecube", "Nintendo GameCube", "Nintendo", Console, ["gcm", "gcz", "rvz", "ciso"], ["gc", "gamecube", "ngc"], ["dolphin_libretro"], "Nintendo - GameCube", false),
    p!("wii", "Nintendo Wii", "Nintendo", Console, ["wbfs", "wad", "rvz", "wia"], ["wii"], ["dolphin_libretro"], "Nintendo - Wii", false),
    p!("switch", "Nintendo Switch", "Nintendo", Console, ["nsp", "xci", "nca"], ["switch", "nsw"], [], "", false),
    p!("virtualboy", "Virtual Boy", "Nintendo", Portatil, ["vb", "vboy"], ["virtualboy", "vb"], ["mednafen_vb_libretro"], "Nintendo - Virtual Boy", false),
    p!("pokemini", "Pokémon Mini", "Nintendo", Portatil, ["min"], ["pokemini"], ["pokemini_libretro"], "Nintendo - Pokemon Mini", false),
    p!("ps1", "PlayStation", "Sony", Console, ["pbp", "cue", "chd", "bin", "iso", "img", "ecm", "mdf", "ccd", "m3u"], ["ps1", "psx", "playstation", "psone"], ["swanstation_libretro", "pcsx_rearmed_libretro", "mednafen_psx_hw_libretro"], "Sony - PlayStation", true),
    p!("ps2", "PlayStation 2", "Sony", Console, ["iso", "chd", "cso", "bin", "gz"], ["ps2", "playstation2"], ["pcsx2_libretro", "play_libretro"], "Sony - PlayStation 2", true),
    p!("psp", "PlayStation Portable", "Sony", Portatil, ["cso", "pbp", "iso", "chd"], ["psp", "playstationportable"], ["ppsspp_libretro"], "Sony - PlayStation Portable", true),
    p!("ps3", "PlayStation 3", "Sony", Console, ["pkg"], ["ps3", "playstation3"], [], "", true),
    p!("genesis", "Mega Drive / Genesis", "Sega", Console, ["md", "gen", "smd", "bin", "mdx"], ["genesis", "megadrive", "md", "segagenesis", "segamegadrive"], ["genesis_plus_gx_libretro", "picodrive_libretro", "blastem_libretro"], "Sega - Mega Drive - Genesis", false),
    p!("mastersystem", "Master System", "Sega", Console, ["sms"], ["mastersystem", "sms", "segamastersystem"], ["genesis_plus_gx_libretro", "smsplus_libretro"], "Sega - Master System - Mark III", false),
    p!("gamegear", "Game Gear", "Sega", Portatil, ["gg"], ["gamegear", "gg"], ["genesis_plus_gx_libretro", "smsplus_libretro"], "Sega - Game Gear", false),
    p!("sg1000", "SG-1000", "Sega", Console, ["sg"], ["sg1000", "sg"], ["genesis_plus_gx_libretro"], "Sega - SG-1000", false),
    p!("segacd", "Mega CD / Sega CD", "Sega", Console, ["cue", "chd", "iso", "bin"], ["segacd", "megacd", "mcd"], ["genesis_plus_gx_libretro", "picodrive_libretro"], "Sega - Mega-CD - Sega CD", true),
    p!("sega32x", "Sega 32X", "Sega", Console, ["32x"], ["sega32x", "32x"], ["picodrive_libretro"], "Sega - 32X", false),
    p!("saturn", "Sega Saturn", "Sega", Console, ["cue", "chd", "iso", "mdf", "ccd"], ["saturn", "segasaturn"], ["mednafen_saturn_libretro", "yabasanshiro_libretro", "kronos_libretro"], "Sega - Saturn", true),
    p!("dreamcast", "Dreamcast", "Sega", Console, ["gdi", "cdi", "chd", "cue"], ["dreamcast", "dc"], ["flycast_libretro"], "Sega - Dreamcast", false),
    p!("atari2600", "Atari 2600", "Atari", Console, ["a26"], ["atari2600", "a2600"], ["stella_libretro"], "Atari - 2600", false),
    p!("atari5200", "Atari 5200", "Atari", Console, ["a52"], ["atari5200", "a5200"], ["atari800_libretro"], "Atari - 5200", false),
    p!("atari7800", "Atari 7800", "Atari", Console, ["a78"], ["atari7800", "a7800"], ["prosystem_libretro"], "Atari - 7800", false),
    p!("lynx", "Atari Lynx", "Atari", Portatil, ["lnx"], ["lynx", "atarilynx"], ["handy_libretro", "mednafen_lynx_libretro"], "Atari - Lynx", false),
    p!("jaguar", "Atari Jaguar", "Atari", Console, ["j64", "jag"], ["jaguar", "atarijaguar"], ["virtualjaguar_libretro"], "Atari - Jaguar", false),
    p!("atarist", "Atari ST", "Atari", Computador, ["st", "msa", "stx"], ["atarist", "st"], ["hatari_libretro"], "Atari - ST", false),
    p!("pcengine", "PC Engine / TurboGrafx-16", "NEC", Console, ["pce", "sgx"], ["pcengine", "tg16", "turbografx16", "turbografx"], ["mednafen_pce_fast_libretro", "mednafen_pce_libretro"], "NEC - PC Engine - TurboGrafx 16", false),
    p!("pcenginecd", "PC Engine CD", "NEC", Console, ["cue", "chd", "ccd"], ["pcenginecd", "tg16cd", "turbografxcd"], ["mednafen_pce_libretro"], "NEC - PC Engine CD - TurboGrafx-CD", true),
    p!("neogeo", "Neo Geo", "SNK", Arcade, ["neo"], ["neogeo"], ["fbneo_libretro", "geolith_libretro"], "SNK - Neo Geo", true),
    p!("neogeocd", "Neo Geo CD", "SNK", Console, ["cue", "chd"], ["neogeocd", "ngcd"], ["neocd_libretro"], "SNK - Neo Geo CD", true),
    p!("ngp", "Neo Geo Pocket", "SNK", Portatil, ["ngp", "ngc"], ["ngp", "ngpc", "neogeopocket", "neogeopocketcolor"], ["mednafen_ngp_libretro"], "SNK - Neo Geo Pocket Color", false),
    p!("wonderswan", "WonderSwan", "Bandai", Portatil, ["ws", "wsc"], ["wonderswan", "ws", "wsc", "wonderswancolor"], ["mednafen_wswan_libretro"], "Bandai - WonderSwan Color", false),
    p!("arcade", "Arcade (MAME/FBNeo)", "Vários", Arcade, ["zip", "7z"], ["arcade", "mame", "fbneo", "fba", "cps1", "cps2", "cps3", "naomi", "atomiswave"], ["fbneo_libretro", "mame_libretro", "mame2003_plus_libretro"], "MAME", true),
    p!("msx", "MSX", "Microsoft/ASCII", Computador, ["mx1", "mx2", "rom", "dsk", "cas"], ["msx", "msx2"], ["bluemsx_libretro", "fmsx_libretro"], "Microsoft - MSX", true),
    p!("c64", "Commodore 64", "Commodore", Computador, ["d64", "t64", "prg", "crt", "x64", "g64", "tap"], ["c64", "commodore64"], ["vice_x64_libretro"], "Commodore - 64", false),
    p!("amiga", "Amiga", "Commodore", Computador, ["adf", "adz", "ipf", "lha", "dms", "hdf"], ["amiga", "amiga500", "amiga1200"], ["puae_libretro"], "Commodore - Amiga", false),
    p!("zxspectrum", "ZX Spectrum", "Sinclair", Computador, ["z80", "tzx", "sna", "szx"], ["zxspectrum", "spectrum", "zx"], ["fuse_libretro"], "Sinclair - ZX Spectrum +3", false),
    p!("dos", "MS-DOS", "Microsoft", Computador, ["dosz", "com", "bat"], ["dos", "msdos", "pcdos"], ["dosbox_pure_libretro", "dosbox_core_libretro"], "DOS", true),
    p!("scummvm", "ScummVM", "ScummVM", Computador, ["scummvm"], ["scummvm"], ["scummvm_libretro"], "ScummVM", false),
    p!("3do", "3DO", "Panasonic", Console, ["cue", "chd", "iso"], ["3do"], ["opera_libretro"], "The 3DO Company - 3DO", true),
    p!("intellivision", "Intellivision", "Mattel", Console, ["int"], ["intellivision"], ["freeintv_libretro"], "Mattel - Intellivision", false),
    p!("colecovision", "ColecoVision", "Coleco", Console, ["col"], ["colecovision", "coleco"], ["gearcoleco_libretro", "bluemsx_libretro"], "Coleco - ColecoVision", false),
    p!("vectrex", "Vectrex", "GCE", Console, ["vec"], ["vectrex"], ["vecx_libretro"], "GCE - Vectrex", false),
    p!("odyssey2", "Odyssey 2 / Videopac", "Magnavox", Console, ["o2"], ["odyssey2", "videopac", "o2em"], ["o2em_libretro"], "Magnavox - Odyssey2", false),
    p!("android", "Jogos Android", "Google", Android, ["apk", "xapk", "apks"], ["android", "androidgames", "apk"], [], "", true),
    p!("pc", "Jogos de PC", "Windows", Pc, ["exe", "lnk", "url"], ["pc", "windows", "pcgames", "windowsgames", "jogospc"], [], "", true),
];

/// "Super Nintendo (SNES)" → "supernintendosnes": minúsculas, sem acento, só letras e números.
pub fn normalizar(texto: &str) -> String {
    texto
        .chars()
        .flat_map(|c| c.to_lowercase())
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            c => c,
        })
        .filter(|c| c.is_ascii_alphanumeric())
        .collect()
}

pub fn por_id(id: &str) -> Option<&'static Plataforma> {
    PLATAFORMAS.iter().find(|p| p.id == id)
}

pub fn extensao(caminho: &Path) -> String {
    caminho.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase()
}

/// Plataforma indicada por uma pasta do caminho (a mais próxima do arquivo vence), olhando só dentro da raiz escolhida e a própria raiz.
pub fn plataforma_da_pasta(arquivo: &Path, raiz: &Path) -> Option<&'static Plataforma> {
    let mut atual = arquivo.parent();
    while let Some(p) = atual {
        if let Some(nome) = p.file_name().and_then(|n| n.to_str()) {
            let n = normalizar(nome);
            if let Some(pl) = PLATAFORMAS.iter().find(|pl| pl.id == n || pl.pastas.contains(&n.as_str())) {
                return Some(pl);
            }
        }
        if p == raiz {
            break;
        }
        atual = p.parent();
    }
    None
}

/// Decide a plataforma de um arquivo pela extensão e, quando a extensão é ambígua, pela pasta.
/// Devolve None se não for um jogo reconhecido.
pub fn identificar(arquivo: &Path, raiz: &Path) -> Option<&'static Plataforma> {
    let ext = extensao(arquivo);
    if ext.is_empty() {
        return None;
    }
    if let Some(pl) = plataforma_da_pasta(arquivo, raiz) {
        // zip e 7z valem para qualquer plataforma da pasta (arcade, computadores antigos…)
        if pl.extensoes.contains(&ext.as_str()) || ext == "zip" || ext == "7z" {
            return Some(pl);
        }
    }
    unica_pela_extensao(&ext)
}

/// Plataforma dona exclusiva de uma extensão (nenhuma outra plataforma a usa) e que não exige pasta própria.
fn unica_pela_extensao(ext: &str) -> Option<&'static Plataforma> {
    if ext == "zip" || ext == "7z" {
        return None;
    }
    let todas: Vec<&Plataforma> = PLATAFORMAS.iter().filter(|p| p.extensoes.contains(&ext)).collect();
    if todas.len() == 1 && !todas[0].exige_pasta {
        Some(todas[0])
    } else {
        None
    }
}

/// Extensão que só serve de "caixa" e precisa de uma espiada por dentro para saber o que é.
pub fn eh_pacote(ext: &str) -> bool {
    ext == "zip"
}

/// Descobre a plataforma pelo que há dentro de um .zip (ex.: um único .nes). None se não der para saber.
pub fn identificar_dentro(nomes: &[String]) -> Option<&'static Plataforma> {
    for n in nomes {
        if let Some(p) = unica_pela_extensao(&extensao(Path::new(n))) {
            return Some(p);
        }
    }
    None
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn catalogo_sem_ids_repetidos_e_com_nucleos_validos() {
        let mut ids: Vec<&str> = PLATAFORMAS.iter().map(|p| p.id).collect();
        ids.sort();
        let n = ids.len();
        ids.dedup();
        assert_eq!(ids.len(), n, "ids repetidos");
        for p in PLATAFORMAS {
            assert!(!p.extensoes.is_empty() && !p.pastas.is_empty(), "{} sem extensões ou pastas", p.id);
            assert!(p.nucleos.iter().all(|n| n.ends_with("_libretro")), "{} tem núcleo com nome estranho", p.id);
            assert!(p.extensoes.iter().all(|e| *e == e.to_lowercase() && !e.starts_with('.')));
            assert!(p.pastas.iter().all(|f| *f == normalizar(f)), "{}: pasta mal escrita", p.id);
        }
    }

    #[test]
    fn normaliza_nomes_de_pasta() {
        assert_eq!(normalizar("Super Nintendo (SNES)"), "supernintendosnes");
        assert_eq!(normalizar("Mega_Drive"), "megadrive");
        assert_eq!(normalizar("Jogos PC"), "jogospc");
        assert_eq!(normalizar("Pokémon"), "pokemon");
    }

    #[test]
    fn extensao_unica_identifica_sozinha() {
        let r = PathBuf::from("/roms");
        assert_eq!(identificar(&r.join("Mario.sfc"), &r).unwrap().id, "snes");
        assert_eq!(identificar(&r.join("sonic.MD"), &r).unwrap().id, "genesis");
        assert_eq!(identificar(&r.join("Pokemon.gba"), &r).unwrap().id, "gba");
        assert!(identificar(&r.join("leiame.txt"), &r).is_none());
        assert!(identificar(&r.join("semextensao"), &r).is_none());
    }

    #[test]
    fn extensao_ambigua_usa_a_pasta() {
        let r = PathBuf::from("/roms");
        assert_eq!(identificar(&r.join("PSX/Crash.cue"), &r).unwrap().id, "ps1");
        assert_eq!(identificar(&r.join("Saturn/Nights.cue"), &r).unwrap().id, "saturn");
        assert_eq!(identificar(&r.join("PSP/GTA.iso"), &r).unwrap().id, "psp");
        assert_eq!(identificar(&r.join("sega/megadrive/sonic.bin"), &r).unwrap().id, "genesis");
        assert!(identificar(&r.join("Downloads/filme.iso"), &r).is_none());
        assert!(identificar(&r.join("qualquer.cue"), &r).is_none());
    }

    #[test]
    fn exe_e_apk_so_valem_em_pasta_propria() {
        let r = PathBuf::from("/jogos");
        assert!(identificar(&r.join("setup.exe"), &r).is_none());
        assert!(identificar(&r.join("app.apk"), &r).is_none());
        assert_eq!(identificar(&r.join("Windows/Hades.exe"), &r).unwrap().id, "pc");
        assert_eq!(identificar(&r.join("Android/Genshin.apk"), &r).unwrap().id, "android");
    }

    #[test]
    fn zip_vai_para_a_plataforma_da_pasta_ou_espia_dentro() {
        let r = PathBuf::from("/roms");
        assert_eq!(identificar(&r.join("arcade/sf2.zip"), &r).unwrap().id, "arcade");
        assert_eq!(identificar(&r.join("nes/Zelda.zip"), &r).unwrap().id, "nes");
        assert!(identificar(&r.join("soltos/x.zip"), &r).is_none());
        assert_eq!(identificar_dentro(&["Zelda (USA).nes".to_string()]).unwrap().id, "nes");
        assert!(identificar_dentro(&["leia.txt".to_string()]).is_none());
    }

    #[test]
    fn pasta_mais_proxima_vence() {
        let r = PathBuf::from("/roms");
        assert_eq!(plataforma_da_pasta(&r.join("snes/hacks/x.smc"), &r).unwrap().id, "snes");
        assert_eq!(plataforma_da_pasta(&r.join("nes/snes/x.bin"), &r).unwrap().id, "snes");
        assert!(plataforma_da_pasta(&r.join("outros/x.bin"), &r).is_none());
    }
}
