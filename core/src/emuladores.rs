//! EmulatorBridge: acha os emuladores instalados (RetroArch e programas próprios de cada console), escolhe o melhor para
//! cada jogo e monta o comando de lançamento (um clique). No RetroArch gera uma configuração automática de tela cheia,
//! shader por tipo de plataforma, controles (autoconfiguração de gamepads como GameSir) e atalho para sair.
//! O catálogo dos emuladores de Android também mora aqui, para a interface e o Android usarem a mesma lista.
use crate::plataformas::{self, por_id, Plataforma, Tipo};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum So {
    Windows,
    Linux,
    Mac,
}

/// Onde procurar programas. `Ambiente::atual()` lê o computador de verdade; os testes montam o seu.
#[derive(Debug, Clone)]
pub struct Ambiente {
    pub so: So,
    pub casa: PathBuf,
    pub appdata: Option<PathBuf>,
    pub local_appdata: Option<PathBuf>,
    pub programas: Vec<PathBuf>,
    pub path: Vec<PathBuf>,
}

impl Ambiente {
    pub fn atual() -> Ambiente {
        let var = |n: &str| std::env::var_os(n).filter(|v| !v.is_empty()).map(PathBuf::from);
        let so = if cfg!(windows) { So::Windows } else if cfg!(target_os = "macos") { So::Mac } else { So::Linux };
        let casa = var(if so == So::Windows { "USERPROFILE" } else { "HOME" }).unwrap_or_default();
        let programas = ["ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"].iter().filter_map(|n| var(n)).collect();
        let path = std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
        Ambiente { so, casa, appdata: var("APPDATA"), local_appdata: var("LOCALAPPDATA"), programas, path }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Modelo {
    RetroArch,
    Proprio,
}

/// Emulador próprio de uma plataforma: onde costuma morar e como se abre um jogo.
pub struct Catalogo {
    pub id: &'static str,
    pub nome: &'static str,
    pub plataformas: &'static [&'static str],
    /// nomes do programa por sistema
    pub exe_windows: &'static [&'static str],
    pub exe_linux: &'static [&'static str],
    /// pastas de instalação comuns (dentro de Program Files, AppData\Local\Programs, AppData\Roaming, ou na casa da pessoa)
    pub pastas: &'static [&'static str],
    /// argumentos, com {rom} (arquivo) e {pasta} (pasta do arquivo); "{rom}" sozinho vira um argumento só
    pub args: &'static [&'static str],
}

pub static EMULADORES: &[Catalogo] = &[
    Catalogo { id: "dolphin", nome: "Dolphin", plataformas: &["gamecube", "wii"], exe_windows: &["Dolphin.exe"], exe_linux: &["dolphin-emu"], pastas: &["Dolphin-x64", "Dolphin", "Dolphin Emulator"], args: &["-b", "-e", "{rom}"] },
    Catalogo { id: "pcsx2", nome: "PCSX2", plataformas: &["ps2"], exe_windows: &["pcsx2-qt.exe", "pcsx2-qtx64.exe", "pcsx2-qtx64-avx2.exe"], exe_linux: &["pcsx2-qt", "pcsx2"], pastas: &["PCSX2", "PCSX2-Qt", "pcsx2-qt"], args: &["-batch", "-fullscreen", "--", "{rom}"] },
    Catalogo { id: "duckstation", nome: "DuckStation", plataformas: &["ps1"], exe_windows: &["duckstation-qt-x64-ReleaseLTCG.exe", "duckstation-qt.exe"], exe_linux: &["duckstation-qt"], pastas: &["DuckStation", "duckstation"], args: &["-batch", "-fullscreen", "--", "{rom}"] },
    Catalogo { id: "ppsspp", nome: "PPSSPP", plataformas: &["psp"], exe_windows: &["PPSSPPWindows64.exe", "PPSSPPWindows.exe"], exe_linux: &["PPSSPPSDL", "ppsspp"], pastas: &["PPSSPP", "PPSSPPWindows64"], args: &["{rom}", "--fullscreen"] },
    Catalogo { id: "rpcs3", nome: "RPCS3", plataformas: &["ps3"], exe_windows: &["rpcs3.exe"], exe_linux: &["rpcs3"], pastas: &["RPCS3", "rpcs3"], args: &["--no-gui", "{rom}"] },
    Catalogo { id: "cemu", nome: "Cemu", plataformas: &[], exe_windows: &["Cemu.exe"], exe_linux: &["cemu"], pastas: &["Cemu", "cemu"], args: &["-f", "-g", "{rom}"] },
    Catalogo { id: "ryujinx", nome: "Ryujinx", plataformas: &["switch"], exe_windows: &["Ryujinx.exe"], exe_linux: &["Ryujinx", "ryujinx"], pastas: &["Ryujinx", "ryujinx"], args: &["{rom}", "-f"] },
    Catalogo { id: "yuzu", nome: "Yuzu/Sudachi", plataformas: &["switch"], exe_windows: &["yuzu.exe", "sudachi.exe"], exe_linux: &["yuzu", "sudachi"], pastas: &["yuzu", "Sudachi", "sudachi"], args: &["-f", "-g", "{rom}"] },
    Catalogo { id: "lime3ds", nome: "Lime3DS/Citra", plataformas: &["3ds"], exe_windows: &["lime3ds-gui.exe", "citra-qt.exe", "azahar.exe"], exe_linux: &["lime3ds", "citra-qt", "azahar"], pastas: &["Lime3DS", "Citra", "Azahar", "lime3ds"], args: &["{rom}", "-f"] },
    Catalogo { id: "melonds", nome: "melonDS", plataformas: &["nds"], exe_windows: &["melonDS.exe"], exe_linux: &["melonDS"], pastas: &["melonDS", "melonds"], args: &["-f", "{rom}"] },
    Catalogo { id: "mgba", nome: "mGBA", plataformas: &["gba", "gb", "gbc"], exe_windows: &["mGBA.exe"], exe_linux: &["mgba-qt", "mgba"], pastas: &["mGBA", "mgba"], args: &["-f", "{rom}"] },
    Catalogo { id: "flycast", nome: "Flycast", plataformas: &["dreamcast"], exe_windows: &["flycast.exe"], exe_linux: &["flycast"], pastas: &["Flycast", "flycast"], args: &["{rom}"] },
    Catalogo { id: "project64", nome: "Project64", plataformas: &["n64"], exe_windows: &["Project64.exe"], exe_linux: &[], pastas: &["Project64 3.0", "Project64", "Project64 2.3"], args: &["{rom}"] },
    Catalogo { id: "snes9x", nome: "Snes9x", plataformas: &["snes"], exe_windows: &["snes9x-x64.exe", "snes9x.exe"], exe_linux: &["snes9x-gtk", "snes9x"], pastas: &["Snes9x", "snes9x"], args: &["{rom}", "-fullscreen"] },
    Catalogo { id: "mame", nome: "MAME", plataformas: &["arcade", "neogeo"], exe_windows: &["mame.exe"], exe_linux: &["mame"], pastas: &["MAME", "mame"], args: &["-rompath", "{pasta}", "-skip_gameinfo", "{nome}"] },
    Catalogo { id: "dosbox", nome: "DOSBox Staging", plataformas: &["dos"], exe_windows: &["dosbox.exe"], exe_linux: &["dosbox"], pastas: &["DOSBox Staging", "DOSBox-X", "DOSBox-0.74-3"], args: &["{rom}", "-fullscreen"] },
    Catalogo { id: "scummvm", nome: "ScummVM", plataformas: &["scummvm"], exe_windows: &["scummvm.exe"], exe_linux: &["scummvm"], pastas: &["ScummVM", "scummvm"], args: &["-f", "--path={pasta}"] },
];

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Instalado {
    pub id: String,
    pub nome: String,
    pub modelo: Modelo,
    pub programa: PathBuf,
    pub plataformas: Vec<String>,
    /// RetroArch: núcleos encontrados (nome sem extensão)
    pub nucleos: Vec<String>,
}

/// Preferências da pessoa (salvas em configuracao.json ao lado da biblioteca).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Configuracao {
    /// pasta do RetroArch, se for em lugar fora do comum
    pub retroarch: Option<PathBuf>,
    /// pastas extras onde procurar emuladores
    pub pastas_extras: Vec<PathBuf>,
    /// plataforma → emulador ("retroarch", "dolphin"…) e, para o RetroArch, o núcleo preferido
    pub preferidos: BTreeMap<String, Preferido>,
    /// desliga o shader automático do RetroArch
    pub sem_shader: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Preferido {
    pub emulador: String,
    pub nucleo: Option<String>,
}

impl Configuracao {
    pub fn carregar(arquivo: &Path) -> Configuracao {
        fs::read_to_string(arquivo).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
    }
    pub fn salvar(&self, arquivo: &Path) -> Result<(), String> {
        if let Some(p) = arquivo.parent() {
            fs::create_dir_all(p).map_err(|e| e.to_string())?;
        }
        let tmp = arquivo.with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_string_pretty(self).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        fs::rename(&tmp, arquivo).map_err(|e| e.to_string())
    }
}

fn extensao_de_nucleo(so: So) -> &'static str {
    match so {
        So::Windows => "dll",
        So::Linux => "so",
        So::Mac => "dylib",
    }
}

fn pastas_de_busca(amb: &Ambiente, cfg: &Configuracao) -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = cfg.pastas_extras.clone();
    v.extend(amb.programas.iter().cloned());
    if let Some(l) = &amb.local_appdata {
        v.push(l.join("Programs"));
        v.push(l.clone());
    }
    if let Some(a) = &amb.appdata {
        v.push(a.clone());
    }
    v.push(amb.casa.join("scoop").join("apps"));
    v.push(amb.casa.join("Emuladores"));
    v.push(amb.casa.join("Emulators"));
    v.push(amb.casa.join("Games"));
    v.push(amb.casa.join("Jogos"));
    v.push(amb.casa.join("Applications"));
    v.push(PathBuf::from(if amb.so == So::Windows { "C:\\" } else { "/opt" }));
    for pasta in ["Downloads", "Desktop", "Documents", "Área de Trabalho", "Transferências"] {
        v.push(amb.casa.join(pasta));
    }
    for disco in crate::sistema::raizes_de_disco(amb) {
        if disco == amb.casa {
            continue;
        }
        for nome in ["Emuladores", "Emulators", "Emulation", "Emulacao", "Emu", "Games", "Jogos", "Retro", "Portable", "Apps"] {
            v.push(disco.join(nome));
        }
        v.push(disco);
    }
    v
}

/// Procura o programa em até 3 níveis dentro das pastas de busca (emulador instalado numa pasta de nome qualquer).
fn achar_fundo(amb: &Ambiente, cfg: &Configuracao, exes: &[&str]) -> Option<PathBuf> {
    for base in pastas_de_busca(amb, cfg) {
        // nunca entra em discos inteiros nem em Windows/Program Files: só nas pastas de emuladores e de usuário
        if base.parent().is_none() || base.file_name().is_none() {
            continue;
        }
        for e in WalkDir::new(&base).max_depth(3).follow_links(false).into_iter().filter_entry(|x| !x.file_name().to_string_lossy().starts_with('$')).filter_map(Result::ok) {
            if e.file_type().is_file() {
                let n = e.file_name().to_string_lossy().to_lowercase();
                if exes.iter().any(|x| x.to_lowercase() == n) {
                    return Some(e.path().to_path_buf());
                }
            }
        }
    }
    None
}

fn achar_exe(amb: &Ambiente, cfg: &Configuracao, pastas: &[&str], exes: &[&str]) -> Option<PathBuf> {
    for base in pastas_de_busca(amb, cfg) {
        for p in pastas {
            for dir in [base.join(p), base.join(p).join("current"), base.join(p).join("bin")] {
                for e in exes {
                    let c = dir.join(e);
                    if c.is_file() {
                        return Some(c);
                    }
                }
            }
        }
        for e in exes {
            let c = base.join(e);
            if c.is_file() {
                return Some(c);
            }
        }
    }
    for d in &amb.path {
        for e in exes {
            let c = d.join(e);
            if c.is_file() {
                return Some(c);
            }
        }
    }
    achar_fundo(amb, cfg, exes)
}

/// Pasta de instalação do RetroArch (onde ficam retroarch.exe, cores/ e shaders/).
pub fn achar_retroarch(amb: &Ambiente, cfg: &Configuracao) -> Option<PathBuf> {
    let exe = if amb.so == So::Windows { "retroarch.exe" } else { "retroarch" };
    if let Some(d) = &cfg.retroarch {
        if d.join(exe).is_file() {
            return Some(d.join(exe));
        }
        if d.is_file() {
            return Some(d.clone());
        }
    }
    achar_exe(amb, cfg, &["RetroArch", "RetroArch-Win64", "retroarch", "RetroArch-Win32"], &[exe])
}

/// Pastas onde o RetroArch guarda os núcleos.
fn pastas_de_nucleos(amb: &Ambiente, exe: &Path) -> Vec<PathBuf> {
    let mut v = Vec::new();
    if let Some(d) = exe.parent() {
        v.push(d.join("cores"));
    }
    if let Some(a) = &amb.appdata {
        v.push(a.join("RetroArch").join("cores"));
    }
    v.push(amb.casa.join(".config").join("retroarch").join("cores"));
    for p in ["/usr/lib/libretro", "/usr/lib64/libretro", "/usr/lib/x86_64-linux-gnu/libretro", "/usr/local/lib/libretro"] {
        v.push(PathBuf::from(p));
    }
    v
}

pub fn nucleos_instalados(amb: &Ambiente, exe: &Path) -> BTreeMap<String, PathBuf> {
    let ext = extensao_de_nucleo(amb.so);
    let mut m = BTreeMap::new();
    for d in pastas_de_nucleos(amb, exe) {
        let Ok(rd) = fs::read_dir(&d) else { continue };
        for e in rd.filter_map(Result::ok) {
            let p = e.path();
            if p.extension().and_then(|x| x.to_str()) == Some(ext) {
                if let Some(nome) = p.file_stem().and_then(|s| s.to_str()) {
                    m.entry(nome.to_string()).or_insert(p);
                }
            }
        }
    }
    m
}

pub fn descobrir(amb: &Ambiente, cfg: &Configuracao) -> Vec<Instalado> {
    let mut v = Vec::new();
    if let Some(exe) = achar_retroarch(amb, cfg) {
        let nucleos = nucleos_instalados(amb, &exe);
        let plataformas = plataformas::PLATAFORMAS.iter().filter(|p| p.nucleos.iter().any(|n| nucleos.contains_key(*n))).map(|p| p.id.to_string()).collect();
        v.push(Instalado { id: "retroarch".into(), nome: "RetroArch".into(), modelo: Modelo::RetroArch, programa: exe, plataformas, nucleos: nucleos.keys().cloned().collect() });
    }
    for c in EMULADORES {
        let exes = if amb.so == So::Windows { c.exe_windows } else { c.exe_linux };
        if exes.is_empty() {
            continue;
        }
        if let Some(exe) = achar_exe(amb, cfg, c.pastas, exes) {
            v.push(Instalado { id: c.id.into(), nome: c.nome.into(), modelo: Modelo::Proprio, programa: exe, plataformas: c.plataformas.iter().map(|s| s.to_string()).collect(), nucleos: Vec::new() });
        }
    }
    v
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Lancamento {
    pub emulador: String,
    pub programa: PathBuf,
    pub args: Vec<String>,
    pub diretorio: Option<PathBuf>,
    /// arquivo de configuração gerado para esse jogo (RetroArch)
    pub configuracao: Option<PathBuf>,
    pub nucleo: Option<String>,
}

const SHADERS_CRT: &[&str] = &["crt/crt-geom.slangp", "crt/crt-easymode.slangp", "crt/crt-aperture.slangp"];
const SHADERS_LCD: &[&str] = &["handheld/lcd-grid-v2.slangp", "handheld/lcd3x.slangp", "handheld/gameboy.slangp"];

/// Shader por tipo: TVs de tubo para consoles de 8/16 bits, grade de LCD para portáteis, nenhum para 3D e computadores.
fn shader_para(pl: &Plataforma, retroarch: &Path) -> Option<PathBuf> {
    let candidatos: &[&str] = match pl.tipo {
        Tipo::Console | Tipo::Arcade if !matches!(pl.id, "n64" | "gamecube" | "wii" | "ps1" | "ps2" | "ps3" | "saturn" | "dreamcast" | "switch" | "3do" | "jaguar") => SHADERS_CRT,
        Tipo::Portatil if !matches!(pl.id, "nds" | "3ds" | "psp") => SHADERS_LCD,
        _ => return None,
    };
    let base = retroarch.parent()?.join("shaders").join("shaders_slang");
    candidatos.iter().map(|c| base.join(c)).find(|p| p.is_file())
}

/// Configuração automática que acompanha cada lançamento do RetroArch (vai em --appendconfig, sem mexer na configuração da pessoa).
pub fn configuracao_retroarch(pl: &Plataforma, retroarch: &Path, cfg: &Configuracao) -> String {
    let mut l: Vec<String> = vec![
        "# Gerado pelo Vortex: vale só para jogos abertos por ele; a sua configuração do RetroArch não é alterada.".into(),
        "video_fullscreen = \"true\"".into(),
        "video_windowed_fullscreen = \"true\"".into(),
        "video_vsync = \"true\"".into(),
        "video_smooth = \"false\"".into(),
        "input_autodetect_enable = \"true\"".into(),
        "input_player1_analog_dpad_mode = \"1\"".into(),
        // Start+Select abre o menu do RetroArch; segurar o atalho de saída fecha o jogo e volta ao Vortex
        "input_menu_toggle_gamepad_combo = \"4\"".into(),
        "input_quit_gamepad_combo = \"0\"".into(),
        "savestate_auto_save = \"true\"".into(),
        "savestate_auto_load = \"true\"".into(),
        "config_save_on_exit = \"false\"".into(),
        "pause_nonactive = \"true\"".into(),
        "notification_show_autoconfig = \"false\"".into(),
        "menu_driver = \"ozone\"".into(),
    ];
    if !cfg.sem_shader {
        if let Some(s) = shader_para(pl, retroarch) {
            l.push("video_shader_enable = \"true\"".into());
            l.push(format!("video_shader = \"{}\"", s.to_string_lossy().replace('\\', "/")));
        }
    }
    l.push(String::new());
    l.join("\n")
}

fn nome_sem_extensao(rom: &Path) -> String {
    rom.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string()
}

fn montar_args(modelo: &[&str], rom: &Path) -> Vec<String> {
    let pasta = rom.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
    modelo.iter().map(|a| a.replace("{rom}", &rom.to_string_lossy()).replace("{pasta}", &pasta).replace("{nome}", &nome_sem_extensao(rom))).collect()
}

/// Lança um jogo de PC direto (.exe) ou por atalho (.lnk/.url).
fn plano_pc(rom: &Path, so: So) -> Result<Lancamento, String> {
    let ext = plataformas::extensao(rom);
    let dir = rom.parent().map(Path::to_path_buf);
    if so == So::Windows && (ext == "lnk" || ext == "url") {
        return Ok(Lancamento { emulador: "pc".into(), programa: PathBuf::from("cmd"), args: vec!["/C".into(), "start".into(), "".into(), rom.to_string_lossy().to_string()], diretorio: dir, configuracao: None, nucleo: None });
    }
    Ok(Lancamento { emulador: "pc".into(), programa: rom.to_path_buf(), args: Vec::new(), diretorio: dir, configuracao: None, nucleo: None })
}

/// Escolhe o emulador e monta o comando. `pasta_dados` é onde o Vortex guarda as configurações geradas para o RetroArch.
pub fn planejar(rom: &Path, plataforma_id: &str, instalados: &[Instalado], cfg: &Configuracao, amb: &Ambiente, pasta_dados: &Path) -> Result<Lancamento, String> {
    let pl = por_id(plataforma_id).ok_or_else(|| format!("Plataforma desconhecida: {plataforma_id}."))?;
    if !rom.exists() {
        return Err("O arquivo do jogo não está mais lá. Conecte o disco ou escaneie a biblioteca de novo.".into());
    }
    if pl.tipo == Tipo::Pc {
        return plano_pc(rom, amb.so);
    }
    if pl.tipo == Tipo::Android {
        return Err("Jogos de Android abrem pelo Vortex no celular. No computador, use um emulador de Android.".into());
    }
    let pref = cfg.preferidos.get(plataforma_id);
    let proprio = |id: &str| -> Option<(&Instalado, &Catalogo)> {
        let i = instalados.iter().find(|i| i.id == id && i.modelo == Modelo::Proprio)?;
        let c = EMULADORES.iter().find(|c| c.id == id)?;
        Some((i, c))
    };
    let retro = instalados.iter().find(|i| i.modelo == Modelo::RetroArch);
    let pelo_retroarch = |nucleo_pref: Option<&str>| -> Result<Lancamento, String> {
        let ra = retro.ok_or_else(|| format!("Para abrir {} instale o RetroArch (retroarch.com) ou um emulador próprio.", pl.nome))?;
        let nucleos = nucleos_instalados(amb, &ra.programa);
        let ordem: Vec<&str> = nucleo_pref.into_iter().chain(pl.nucleos.iter().copied()).collect();
        let (nome, caminho) = ordem.iter().find_map(|n| nucleos.get(*n).map(|p| (n.to_string(), p.clone()))).ok_or_else(|| {
            format!("O RetroArch não tem núcleo para {}. No RetroArch: Menu principal → Carregar núcleo → Baixar um núcleo ({}).", pl.nome, pl.nucleos.first().copied().unwrap_or("não há núcleo conhecido"))
        })?;
        let arq_cfg = pasta_dados.join("retroarch").join(format!("vortex-{}.cfg", pl.id));
        if let Some(p) = arq_cfg.parent() {
            fs::create_dir_all(p).map_err(|e| format!("Não consegui preparar a configuração do RetroArch: {e}"))?;
        }
        let mut texto_cfg = configuracao_retroarch(pl, &ra.programa, cfg);
        // no motor do próprio Vortex os saves ficam em pastas conhecidas (para a nuvem); no RetroArch da pessoa nada muda
        let motor = pasta_dados.join("retroarch");
        if ra.programa.parent() == Some(motor.as_path()) {
            texto_cfg.push_str(&format!("savefile_directory = \"{}\"\nsavestate_directory = \"{}\"\n", motor.join("saves").to_string_lossy().replace('\\', "/"), motor.join("states").to_string_lossy().replace('\\', "/")));
        }
        fs::write(&arq_cfg, texto_cfg).map_err(|e| format!("Não consegui gravar a configuração do RetroArch: {e}"))?;
        Ok(Lancamento {
            emulador: "retroarch".into(),
            programa: ra.programa.clone(),
            args: vec!["-L".into(), caminho.to_string_lossy().to_string(), "--appendconfig".into(), arq_cfg.to_string_lossy().to_string(), rom.to_string_lossy().to_string()],
            diretorio: ra.programa.parent().map(Path::to_path_buf),
            configuracao: Some(arq_cfg),
            nucleo: Some(nome),
        })
    };
    let pelo_proprio = |i: &Instalado, c: &Catalogo| Lancamento {
        emulador: i.id.clone(),
        programa: i.programa.clone(),
        args: montar_args(c.args, rom),
        diretorio: i.programa.parent().map(Path::to_path_buf),
        configuracao: None,
        nucleo: None,
    };
    // 1) preferência da pessoa
    if let Some(p) = pref {
        if p.emulador == "retroarch" {
            return pelo_retroarch(p.nucleo.as_deref());
        }
        if let Some((i, c)) = proprio(&p.emulador) {
            return Ok(pelo_proprio(i, c));
        }
    }
    // 2) emulador próprio instalado para a plataforma (costuma ser o melhor para consoles 3D)
    let tridimensional = matches!(pl.id, "gamecube" | "wii" | "ps2" | "psp" | "ps3" | "switch" | "3ds" | "dreamcast" | "n64" | "nds");
    if tridimensional || retro.is_none() {
        if let Some((i, c)) = EMULADORES.iter().filter(|c| c.plataformas.contains(&pl.id)).find_map(|c| proprio(c.id).map(|(i, _)| (i, c))) {
            return Ok(pelo_proprio(i, c));
        }
    }
    // 3) RetroArch com o primeiro núcleo instalado; se não deu, tenta um emulador próprio como reserva
    match pelo_retroarch(None) {
        Ok(l) => Ok(l),
        Err(e) => EMULADORES.iter().filter(|c| c.plataformas.contains(&pl.id)).find_map(|c| proprio(c.id).map(|(i, _)| pelo_proprio(i, c))).ok_or(e),
    }
}

// ------------------------------------------------------------------ Android
/// Emuladores de Android: pacote, atividade (quando há uma que recebe o jogo direto) e plataformas.
#[derive(Debug, Serialize)]
pub struct EmuladorAndroid {
    pub id: &'static str,
    pub nome: &'static str,
    pub pacotes: &'static [&'static str],
    pub plataformas: &'static [&'static str],
    /// "retroarch" (extras ROM/LIBRETRO/CONFIGFILE), "view" (ACTION_VIEW com o arquivo) ou "abrir" (só abre o app)
    pub metodo: &'static str,
    pub atividade: &'static str,
}

pub static EMULADORES_ANDROID: &[EmuladorAndroid] = &[
    EmuladorAndroid { id: "retroarch", nome: "RetroArch", pacotes: &["com.retroarch.aarch64", "com.retroarch", "com.retroarch.ra32"], plataformas: &[], metodo: "retroarch", atividade: "com.retroarch.browser.retroactivity.RetroActivityFuture" },
    EmuladorAndroid { id: "ppsspp", nome: "PPSSPP", pacotes: &["org.ppsspp.ppsspp", "org.ppsspp.ppssppgold"], plataformas: &["psp"], metodo: "view", atividade: "org.ppsspp.ppsspp.PpssppActivity" },
    EmuladorAndroid { id: "dolphin", nome: "Dolphin", pacotes: &["org.dolphinemu.dolphinemu"], plataformas: &["gamecube", "wii"], metodo: "view", atividade: "org.dolphinemu.dolphinemu.ui.main.MainActivity" },
    EmuladorAndroid { id: "duckstation", nome: "DuckStation", pacotes: &["com.github.stenzek.duckstation"], plataformas: &["ps1"], metodo: "view", atividade: "" },
    EmuladorAndroid { id: "nethersx2", nome: "NetherSX2/AetherSX2", pacotes: &["xyz.aethersx2.android", "xyz.aethersx2.custom"], plataformas: &["ps2"], metodo: "view", atividade: "" },
    EmuladorAndroid { id: "flycast", nome: "Flycast", pacotes: &["com.flycast.emulator"], plataformas: &["dreamcast"], metodo: "view", atividade: "" },
    EmuladorAndroid { id: "melonds", nome: "melonDS", pacotes: &["me.magnum.melonds"], plataformas: &["nds"], metodo: "view", atividade: "" },
    EmuladorAndroid { id: "lemuroid", nome: "Lemuroid", pacotes: &["com.swordfish.lemuroid"], plataformas: &["nes", "snes", "gb", "gbc", "gba", "genesis", "mastersystem", "gamegear", "ps1", "psp", "n64", "nds", "atari2600", "pcengine", "lynx", "neogeo", "arcade"], metodo: "abrir", atividade: "" },
    EmuladorAndroid { id: "mupen", nome: "M64Plus FZ", pacotes: &["org.mupen64plusae.v3.fzurita", "org.mupen64plusae.v3.fzurita.pro"], plataformas: &["n64"], metodo: "view", atividade: "" },
    EmuladorAndroid { id: "citra", nome: "Citra/Lime3DS", pacotes: &["org.citra.emu", "io.github.lime3ds.android", "org.azahar_emu.azahar"], plataformas: &["3ds"], metodo: "view", atividade: "" },
    EmuladorAndroid { id: "yuzu", nome: "Sudachi/Yuzu (Switch)", pacotes: &["org.sudachi.sudachi_emu", "org.yuzu.yuzu_emu"], plataformas: &["switch"], metodo: "view", atividade: "" },
    EmuladorAndroid { id: "scummvm", nome: "ScummVM", pacotes: &["org.scummvm.scummvm"], plataformas: &["scummvm"], metodo: "abrir", atividade: "" },
];

/// Pasta onde o RetroArch do Android guarda os núcleos, por pacote.
pub fn nucleos_retroarch_android(pacote: &str) -> String {
    format!("/data/data/{pacote}/cores")
}

/// Núcleo do RetroArch para Android: o mesmo nome do desktop, terminando em "_android.so".
pub fn arquivo_do_nucleo_android(nucleo: &str) -> String {
    format!("{nucleo}_android.so")
}

pub fn emuladores_android_para(plataforma_id: &str) -> Vec<&'static EmuladorAndroid> {
    EMULADORES_ANDROID.iter().filter(|e| e.plataformas.contains(&plataforma_id) || (e.id == "retroarch" && por_id(plataforma_id).is_some_and(|p| !p.nucleos.is_empty()))).collect()
}

#[cfg(test)]
mod testes {
    use super::*;

    fn amb_de(t: &Path) -> Ambiente {
        Ambiente { so: So::Windows, casa: t.join("casa"), appdata: Some(t.join("appdata")), local_appdata: Some(t.join("local")), programas: vec![t.join("programas")], path: vec![] }
    }

    fn arq(p: &Path) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, "x").unwrap();
    }

    fn com_retroarch(t: &Path, nucleos: &[&str]) {
        arq(&t.join("programas/RetroArch/retroarch.exe"));
        for n in nucleos {
            arq(&t.join(format!("programas/RetroArch/cores/{n}.dll")));
        }
        arq(&t.join("programas/RetroArch/shaders/shaders_slang/crt/crt-geom.slangp"));
        arq(&t.join("programas/RetroArch/shaders/shaders_slang/handheld/lcd3x.slangp"));
    }

    #[test]
    fn catalogo_consistente() {
        for c in EMULADORES {
            assert!(c.plataformas.iter().all(|p| por_id(p).is_some()), "{} aponta para plataforma inexistente", c.id);
            assert!(c.args.iter().any(|a| a.contains("{rom}") || a.contains("{nome}") || a.contains("{pasta}")), "{} sem {{rom}}", c.id);
            assert!(!c.pastas.is_empty());
        }
        for e in EMULADORES_ANDROID {
            assert!(e.plataformas.iter().all(|p| por_id(p).is_some()), "{}", e.id);
            assert!(["retroarch", "view", "abrir"].contains(&e.metodo));
            assert!(!e.pacotes.is_empty());
        }
        let mut ids: Vec<&str> = EMULADORES.iter().map(|c| c.id).collect();
        ids.sort();
        let n = ids.len();
        ids.dedup();
        assert_eq!(n, ids.len());
    }

    #[test]
    fn descobre_retroarch_nucleos_e_emuladores_proprios() {
        let t = tempfile::tempdir().unwrap();
        com_retroarch(t.path(), &["snes9x_libretro", "mgba_libretro"]);
        arq(&t.path().join("programas/Dolphin-x64/Dolphin.exe"));
        arq(&t.path().join("local/Programs/PPSSPP/PPSSPPWindows64.exe"));
        let amb = amb_de(t.path());
        let v = descobrir(&amb, &Configuracao::default());
        let ids: Vec<&str> = v.iter().map(|i| i.id.as_str()).collect();
        assert_eq!(ids, vec!["retroarch", "dolphin", "ppsspp"]);
        let ra = &v[0];
        assert_eq!(ra.nucleos, vec!["mgba_libretro", "snes9x_libretro"]);
        assert!(ra.plataformas.contains(&"snes".to_string()) && ra.plataformas.contains(&"gba".to_string()) && !ra.plataformas.contains(&"ps2".to_string()));
        assert!(descobrir(&amb_de(&t.path().join("vazio")), &Configuracao::default()).is_empty());
    }

    #[test]
    fn retroarch_em_pasta_escolhida_pela_pessoa() {
        let t = tempfile::tempdir().unwrap();
        arq(&t.path().join("meu/ra/retroarch.exe"));
        let cfg = Configuracao { retroarch: Some(t.path().join("meu/ra")), ..Default::default() };
        assert!(achar_retroarch(&amb_de(t.path()), &cfg).is_some());
        assert!(achar_retroarch(&amb_de(t.path()), &Configuracao::default()).is_none());
    }

    #[test]
    fn lanca_snes_no_retroarch_com_configuracao_automatica() {
        let t = tempfile::tempdir().unwrap();
        com_retroarch(t.path(), &["bsnes_libretro", "snes9x_libretro"]);
        let rom = t.path().join("roms/Zelda.sfc");
        arq(&rom);
        let amb = amb_de(t.path());
        let inst = descobrir(&amb, &Configuracao::default());
        let dados = t.path().join("dados");
        let l = planejar(&rom, "snes", &inst, &Configuracao::default(), &amb, &dados).unwrap();
        assert_eq!(l.emulador, "retroarch");
        assert_eq!(l.nucleo.as_deref(), Some("snes9x_libretro")); // o primeiro da lista que está instalado
        assert_eq!(l.args[0], "-L");
        assert!(l.args[1].ends_with("snes9x_libretro.dll"));
        assert_eq!(l.args[2], "--appendconfig");
        assert!(l.args.last().unwrap().ends_with("Zelda.sfc"));
        let cfg = fs::read_to_string(l.configuracao.as_ref().unwrap()).unwrap();
        assert!(cfg.contains("video_fullscreen = \"true\""));
        assert!(cfg.contains("input_autodetect_enable = \"true\""));
        assert!(cfg.contains("crt-geom.slangp")); // console 16 bits ganha shader de TV de tubo
        assert!(cfg.contains("config_save_on_exit = \"false\""));
    }

    #[test]
    fn shader_conforme_o_tipo_da_plataforma() {
        let t = tempfile::tempdir().unwrap();
        com_retroarch(t.path(), &["mgba_libretro", "mupen64plus_next_libretro"]);
        let ra = t.path().join("programas/RetroArch/retroarch.exe");
        let c = Configuracao::default();
        assert!(configuracao_retroarch(por_id("gba").unwrap(), &ra, &c).contains("lcd3x.slangp"));
        assert!(!configuracao_retroarch(por_id("n64").unwrap(), &ra, &c).contains("video_shader"));
        assert!(!configuracao_retroarch(por_id("nes").unwrap(), &ra, &Configuracao { sem_shader: true, ..Default::default() }).contains("video_shader"));
    }

    #[test]
    fn console_3d_prefere_emulador_proprio() {
        let t = tempfile::tempdir().unwrap();
        com_retroarch(t.path(), &["dolphin_libretro"]);
        arq(&t.path().join("programas/Dolphin-x64/Dolphin.exe"));
        let rom = t.path().join("roms/Mario.rvz");
        arq(&rom);
        let amb = amb_de(t.path());
        let inst = descobrir(&amb, &Configuracao::default());
        let l = planejar(&rom, "gamecube", &inst, &Configuracao::default(), &amb, &t.path().join("d")).unwrap();
        assert_eq!(l.emulador, "dolphin");
        assert_eq!(l.args, vec!["-b".to_string(), "-e".to_string(), rom.to_string_lossy().to_string()]);
    }

    #[test]
    fn preferencia_da_pessoa_manda() {
        let t = tempfile::tempdir().unwrap();
        com_retroarch(t.path(), &["bsnes_libretro", "snes9x_libretro"]);
        arq(&t.path().join("programas/Snes9x/snes9x-x64.exe"));
        let rom = t.path().join("Zelda.sfc");
        arq(&rom);
        let amb = amb_de(t.path());
        let inst = descobrir(&amb, &Configuracao::default());
        let mut cfg = Configuracao::default();
        cfg.preferidos.insert("snes".into(), Preferido { emulador: "retroarch".into(), nucleo: Some("bsnes_libretro".into()) });
        assert_eq!(planejar(&rom, "snes", &inst, &cfg, &amb, &t.path().join("d")).unwrap().nucleo.as_deref(), Some("bsnes_libretro"));
        cfg.preferidos.insert("snes".into(), Preferido { emulador: "snes9x".into(), nucleo: None });
        let l = planejar(&rom, "snes", &inst, &cfg, &amb, &t.path().join("d")).unwrap();
        assert_eq!(l.emulador, "snes9x");
        assert_eq!(l.args[1], "-fullscreen");
    }

    #[test]
    fn mensagens_de_erro_ajudam() {
        let t = tempfile::tempdir().unwrap();
        let amb = amb_de(t.path());
        let rom = t.path().join("Zelda.sfc");
        arq(&rom);
        let e = planejar(&rom, "snes", &[], &Configuracao::default(), &amb, &t.path().join("d")).unwrap_err();
        assert!(e.contains("instale o RetroArch"), "{e}");
        com_retroarch(t.path(), &[]);
        let inst = descobrir(&amb, &Configuracao::default());
        let e = planejar(&rom, "snes", &inst, &Configuracao::default(), &amb, &t.path().join("d")).unwrap_err();
        assert!(e.contains("não tem núcleo") && e.contains("snes9x_libretro"), "{e}");
        assert!(planejar(&t.path().join("sumiu.sfc"), "snes", &inst, &Configuracao::default(), &amb, &t.path().join("d")).unwrap_err().contains("não está mais"));
        assert!(planejar(&rom, "inventada", &inst, &Configuracao::default(), &amb, &t.path().join("d")).unwrap_err().contains("desconhecida"));
        assert!(planejar(&rom, "android", &inst, &Configuracao::default(), &amb, &t.path().join("d")).unwrap_err().contains("Android"));
    }

    #[test]
    fn jogo_de_pc_abre_direto_e_atalho_pelo_sistema() {
        let t = tempfile::tempdir().unwrap();
        let amb = amb_de(t.path());
        let exe = t.path().join("Windows/Hades/Hades.exe");
        arq(&exe);
        let l = planejar(&exe, "pc", &[], &Configuracao::default(), &amb, t.path()).unwrap();
        assert_eq!(l.programa, exe);
        assert_eq!(l.diretorio, exe.parent().map(Path::to_path_buf));
        let atalho = t.path().join("Windows/Jogo.lnk");
        arq(&atalho);
        let l = planejar(&atalho, "pc", &[], &Configuracao::default(), &amb, t.path()).unwrap();
        assert_eq!(l.programa, PathBuf::from("cmd"));
        assert_eq!(l.args[..3], ["/C".to_string(), "start".to_string(), "".to_string()]);
    }

    #[test]
    fn mame_usa_pasta_e_nome_do_jogo() {
        let t = tempfile::tempdir().unwrap();
        arq(&t.path().join("programas/MAME/mame.exe"));
        let rom = t.path().join("roms/arcade/sf2.zip");
        arq(&rom);
        let amb = amb_de(t.path());
        let inst = descobrir(&amb, &Configuracao::default());
        let l = planejar(&rom, "arcade", &inst, &Configuracao::default(), &amb, &t.path().join("d")).unwrap();
        assert_eq!(l.emulador, "mame");
        assert_eq!(l.args.last().map(String::as_str), Some("sf2"));
        assert!(l.args.contains(&t.path().join("roms/arcade").to_string_lossy().to_string()));
    }

    #[test]
    fn configuracao_salva_e_carrega() {
        let t = tempfile::tempdir().unwrap();
        let a = t.path().join("x/configuracao.json");
        let mut c = Configuracao::default();
        c.preferidos.insert("ps2".into(), Preferido { emulador: "pcsx2".into(), nucleo: None });
        c.salvar(&a).unwrap();
        assert_eq!(Configuracao::carregar(&a), c);
        assert_eq!(Configuracao::carregar(&t.path().join("nada.json")), Configuracao::default());
    }

    #[test]
    fn android_lista_por_plataforma() {
        let ids: Vec<&str> = emuladores_android_para("psp").iter().map(|e| e.id).collect();
        assert!(ids.contains(&"ppsspp") && ids.contains(&"retroarch") && ids.contains(&"lemuroid"));
        assert!(!emuladores_android_para("android").iter().any(|e| e.id == "retroarch"));
        assert_eq!(arquivo_do_nucleo_android("snes9x_libretro"), "snes9x_libretro_android.so");
        assert_eq!(nucleos_retroarch_android("com.retroarch.aarch64"), "/data/data/com.retroarch.aarch64/cores");
    }
}
