//! GameSpacePerformanceMode: quando um jogo abre, o Vortex deixa o computador focado nele e, quando o jogo fecha, desfaz TUDO.
//!  - prioridade alta para o emulador/jogo e preferência pela GPU dedicada;
//!  - apps de segundo plano conhecidos (navegadores, chats, nuvens, launchers) ficam com prioridade baixa e devolvem RAM;
//!  - atualizadores (Google/Edge/Adobe/Java) são pausados;
//!  - notificações do sistema silenciadas; plano de energia de alto desempenho; tela e PC não dormem.
//! Nada é fechado nem apagado. Cada mudança é anotada num arquivo (modo_jogo.json) para ser desfeita mesmo se o Vortex fechar sem avisar.
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Configuracao {
    pub ligado: bool,
    pub prioridade_do_jogo: bool,
    pub rebaixar_apps: bool,
    pub pausar_atualizadores: bool,
    pub liberar_ram: bool,
    pub bloquear_notificacoes: bool,
    pub energia_maxima: bool,
    pub gpu_dedicada: bool,
    pub manter_acordado: bool,
    /// nomes de programa que nunca devem ser mexidos (sem .exe)
    pub protegidos_extra: Vec<String>,
    /// programas seus que também devem ficar em segundo plano durante o jogo
    pub rebaixar_extra: Vec<String>,
}

impl Default for Configuracao {
    fn default() -> Self {
        Configuracao {
            ligado: true,
            prioridade_do_jogo: true,
            rebaixar_apps: true,
            pausar_atualizadores: true,
            liberar_ram: true,
            bloquear_notificacoes: true,
            energia_maxima: true,
            gpu_dedicada: true,
            manter_acordado: true,
            protegidos_extra: Vec::new(),
            rebaixar_extra: Vec::new(),
        }
    }
}

impl Configuracao {
    pub fn carregar(arquivo: &Path) -> Configuracao {
        fs::read_to_string(arquivo).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
    }
    pub fn salvar(&self, arquivo: &Path) -> Result<(), String> {
        if let Some(p) = arquivo.parent() {
            fs::create_dir_all(p).map_err(|e| e.to_string())?;
        }
        fs::write(arquivo, serde_json::to_string_pretty(self).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Proc {
    pub pid: u32,
    pub nome: String,
    pub memoria: u64,
    pub pai: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Prioridade {
    Alta,
    AbaixoDoNormal,
    Normal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Acao {
    Rebaixar,
    Pausar,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Alvo {
    pub pid: u32,
    pub nome: String,
    pub memoria: u64,
    pub acao: Acao,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize)]
pub struct Plano {
    pub alvos: Vec<Alvo>,
    pub ram_estimada: u64,
}

// ------------------------------------------------------------------ o que pode e o que nunca pode ser mexido
/// Nunca mexer: sistema, segurança, áudio, drivers de vídeo, o próprio Vortex e os emuladores.
const PROTEGIDOS: &[&str] = &[
    "system", "idle", "registry", "smss", "csrss", "wininit", "services", "lsass", "svchost", "winlogon", "dwm", "explorer", "fontdrvhost", "audiodg", "taskhostw", "sihost", "ctfmon",
    "msmpeng", "nissrv", "securityhealthservice", "securityhealthsystray", "searchhost", "startmenuexperiencehost", "shellexperiencehost", "textinputhost", "runtimebroker", "conhost",
    "dllhost", "wudfhost", "spoolsv", "vortex", "retroarch", "rtss", "msiafterburner", "steam", "gamesir", "xboxpcapp", "gamebar", "gamebarpresencewriter",
    // Linux
    "systemd", "xorg", "xwayland", "pipewire", "pulseaudio", "wireplumber", "gnome-shell", "kwin_x11", "kwin_wayland", "plasmashell", "dbus-daemon", "sway", "mutter",
];
const PREFIXOS_PROTEGIDOS: &[&str] = &["nvidia", "nv", "amd", "radeon", "igfx", "intel", "rtk", "realtek", "wlan", "bluetooth", "xbox", "dolphin", "pcsx", "ppsspp", "duckstation", "rpcs3", "cemu", "ryujinx", "yuzu", "mgba", "melonds", "flycast", "mame", "snes9x", "systemd"];

/// Seguros para ficar em segundo plano (prioridade baixa e RAM devolvida).
const REBAIXAVEIS: &[&str] = &[
    "chrome", "msedge", "firefox", "brave", "opera", "vivaldi", "discord", "slack", "teams", "ms-teams", "telegram", "whatsapp", "signal", "onedrive", "dropbox", "googledrivefs",
    "googledrive", "icloudservices", "iclouddrive", "code", "adobe desktop service", "creative cloud", "ccxprocess", "epicgameslauncher", "epicwebhelper", "origin", "eadesktop", "upc",
    "ubisoftconnect", "battle.net", "galaxyclient", "steamwebhelper", "searchindexer", "msedgewebview2", "teamviewer", "notion", "obsidian", "zoom", "skype", "thunderbird", "outlook",
    "chromium", "firefox-bin", "slack-desktop",
];

/// Atualizadores e serviços de telemetria que podem ficar pausados com segurança durante o jogo.
const PAUSAVEIS: &[&str] = &["googleupdate", "microsoftedgeupdate", "adobearm", "armsvc", "jusched", "onedrivestandaloneupdater", "updater", "googlecrashhandler", "googlecrashhandler64", "ccleanerbrowser"];

pub fn nome_limpo(nome: &str) -> String {
    let n = nome.trim().to_lowercase();
    n.strip_suffix(".exe").unwrap_or(&n).to_string()
}

fn protegido(nome: &str, cfg: &Configuracao) -> bool {
    PROTEGIDOS.contains(&nome) || PREFIXOS_PROTEGIDOS.iter().any(|p| nome.starts_with(p)) || cfg.protegidos_extra.iter().any(|p| nome_limpo(p) == nome)
}

/// Decide o que mexer. Função pura: recebe a lista de processos e devolve o plano, sem tocar em nada.
/// `jogo` = processos do jogo/emulador e do Vortex; os filhos e ancestrais deles ficam protegidos.
pub fn planejar(procs: &[Proc], jogo: &[u32], cfg: &Configuracao) -> Plano {
    let mut seguros: HashSet<u32> = jogo.iter().copied().collect();
    // descendentes do jogo (ex.: launcher do emulador)
    loop {
        let antes = seguros.len();
        for p in procs {
            if p.pai.is_some_and(|pai| seguros.contains(&pai)) {
                seguros.insert(p.pid);
            }
        }
        if seguros.len() == antes {
            break;
        }
    }
    // ancestrais do jogo (quem abriu), sem puxar os outros filhos deles
    for &inicio in jogo {
        let mut atual = inicio;
        for _ in 0..64 {
            match procs.iter().find(|p| p.pid == atual).and_then(|p| p.pai) {
                Some(pai) if seguros.insert(pai) || pai != atual => atual = pai,
                _ => break,
            }
        }
    }
    let mut plano = Plano::default();
    for p in procs {
        if seguros.contains(&p.pid) || p.pid <= 4 {
            continue;
        }
        let nome = nome_limpo(&p.nome);
        if protegido(&nome, cfg) {
            continue;
        }
        let acao = if cfg.pausar_atualizadores && PAUSAVEIS.contains(&nome.as_str()) {
            Some(Acao::Pausar)
        } else if cfg.rebaixar_apps && (REBAIXAVEIS.contains(&nome.as_str()) || cfg.rebaixar_extra.iter().any(|e| nome_limpo(e) == nome)) {
            Some(Acao::Rebaixar)
        } else {
            None
        };
        if let Some(acao) = acao {
            if acao == Acao::Rebaixar && cfg.liberar_ram {
                plano.ram_estimada += p.memoria;
            }
            plano.alvos.push(Alvo { pid: p.pid, nome, memoria: p.memoria, acao });
        }
    }
    plano.alvos.sort_by(|a, b| b.memoria.cmp(&a.memoria));
    plano
}

// ------------------------------------------------------------------ o sistema de verdade (e o falso dos testes)
pub trait Sistema {
    fn processos(&self) -> Vec<Proc>;
    fn prioridade(&self, pid: u32, p: Prioridade) -> Result<(), String>;
    fn pausar(&self, pid: u32) -> Result<(), String>;
    fn retomar(&self, pid: u32) -> Result<(), String>;
    fn liberar_memoria(&self, pid: u32) -> Result<(), String>;
    /// liga/desliga as notificações; devolve o valor anterior para restaurar
    fn notificacoes(&self, ligadas: bool) -> Result<Option<String>, String>;
    fn restaurar_notificacoes(&self, anterior: &str) -> Result<(), String>;
    /// coloca o plano de energia de alto desempenho; devolve o plano anterior
    fn energia_maxima(&self) -> Result<Option<String>, String>;
    fn restaurar_energia(&self, anterior: &str) -> Result<(), String>;
    fn gpu_dedicada(&self, programa: &Path, ligada: bool) -> Result<(), String>;
    fn manter_acordado(&self, ligado: bool) -> Result<(), String>;
}

/// O que foi mudado, guardado em disco para desfazer tudo (inclusive depois de um fechamento inesperado).
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct Registro {
    pub jogo_pid: Option<u32>,
    pub jogo_prioridade_alterada: bool,
    pub rebaixados: Vec<(u32, String)>,
    pub pausados: Vec<(u32, String)>,
    pub notificacoes_antes: Option<String>,
    pub energia_antes: Option<String>,
    pub gpu_programa: Option<PathBuf>,
    pub acordado: bool,
    pub ativado_em: u64,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize)]
pub struct Relatorio {
    pub rebaixados: usize,
    pub pausados: usize,
    pub ram_liberada_estimada: u64,
    pub notificacoes_silenciadas: bool,
    pub energia_maxima: bool,
    pub gpu_dedicada: bool,
    pub prioridade_do_jogo: bool,
    pub manter_acordado: bool,
    pub avisos: Vec<String>,
}

fn arquivo_do_registro(pasta_dados: &Path) -> PathBuf {
    pasta_dados.join("modo_jogo.json")
}

fn gravar(registro: &Registro, pasta_dados: &Path) -> Result<(), String> {
    fs::create_dir_all(pasta_dados).map_err(|e| e.to_string())?;
    let a = arquivo_do_registro(pasta_dados);
    let tmp = a.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_string(registro).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::rename(&tmp, a).map_err(|e| e.to_string())
}

pub fn pendente(pasta_dados: &Path) -> Option<Registro> {
    serde_json::from_str(&fs::read_to_string(arquivo_do_registro(pasta_dados)).ok()?).ok()
}

/// Liga o modo jogo. Se der errado em algum passo, segue com os outros e conta no relatório (nunca deixa o jogo sem abrir por isso).
pub fn ativar(sis: &dyn Sistema, cfg: &Configuracao, pid_do_jogo: u32, programa_do_jogo: Option<&Path>, pids_do_vortex: &[u32], pasta_dados: &Path, agora: u64) -> Relatorio {
    let mut rel = Relatorio::default();
    if !cfg.ligado {
        return rel;
    }
    // se sobrou algo de uma vez anterior, desfaz primeiro
    if pendente(pasta_dados).is_some() {
        desativar(sis, pasta_dados);
    }
    let mut reg = Registro { jogo_pid: Some(pid_do_jogo), ativado_em: agora, ..Default::default() };
    let procs = sis.processos();
    let mut protegidos = vec![pid_do_jogo];
    protegidos.extend_from_slice(pids_do_vortex);
    let plano = planejar(&procs, &protegidos, cfg);

    if cfg.prioridade_do_jogo {
        match sis.prioridade(pid_do_jogo, Prioridade::Alta) {
            Ok(()) => {
                reg.jogo_prioridade_alterada = true;
                rel.prioridade_do_jogo = true;
            }
            Err(e) => rel.avisos.push(format!("Prioridade do jogo: {e}")),
        }
    }
    for a in &plano.alvos {
        match a.acao {
            Acao::Rebaixar => match sis.prioridade(a.pid, Prioridade::AbaixoDoNormal) {
                Ok(()) => {
                    reg.rebaixados.push((a.pid, a.nome.clone()));
                    rel.rebaixados += 1;
                    if cfg.liberar_ram && sis.liberar_memoria(a.pid).is_ok() {
                        rel.ram_liberada_estimada += a.memoria;
                    }
                }
                Err(_) => {} // processo de outro usuário ou já fechou: ignora em silêncio
            },
            Acao::Pausar => {
                if sis.pausar(a.pid).is_ok() {
                    reg.pausados.push((a.pid, a.nome.clone()));
                    rel.pausados += 1;
                }
            }
        }
    }
    if cfg.bloquear_notificacoes {
        match sis.notificacoes(false) {
            Ok(antes) => {
                reg.notificacoes_antes = Some(antes.unwrap_or_else(|| "1".into()));
                rel.notificacoes_silenciadas = true;
            }
            Err(e) => rel.avisos.push(format!("Notificações: {e}")),
        }
    }
    if cfg.energia_maxima {
        match sis.energia_maxima() {
            Ok(antes) => {
                reg.energia_antes = antes;
                rel.energia_maxima = true;
            }
            Err(e) => rel.avisos.push(format!("Plano de energia: {e}")),
        }
    }
    if cfg.gpu_dedicada {
        if let Some(p) = programa_do_jogo {
            match sis.gpu_dedicada(p, true) {
                Ok(()) => {
                    reg.gpu_programa = Some(p.to_path_buf());
                    rel.gpu_dedicada = true;
                }
                Err(e) => rel.avisos.push(format!("GPU dedicada: {e}")),
            }
        }
    }
    if cfg.manter_acordado {
        match sis.manter_acordado(true) {
            Ok(()) => {
                reg.acordado = true;
                rel.manter_acordado = true;
            }
            Err(e) => rel.avisos.push(format!("Tela acesa: {e}")),
        }
    }
    if let Err(e) = gravar(&reg, pasta_dados) {
        rel.avisos.push(format!("Não consegui anotar as mudanças para desfazer depois: {e}"));
    }
    rel
}

/// Desfaz tudo o que o modo jogo mudou. Pode ser chamado várias vezes (a segunda não faz nada).
pub fn desativar(sis: &dyn Sistema, pasta_dados: &Path) -> bool {
    let Some(reg) = pendente(pasta_dados) else { return false };
    let vivos: Vec<Proc> = sis.processos();
    let mesmo = |pid: u32, nome: &str| vivos.iter().any(|p| p.pid == pid && nome_limpo(&p.nome) == nome);
    for (pid, nome) in &reg.pausados {
        if mesmo(*pid, nome) {
            let _ = sis.retomar(*pid);
        }
    }
    for (pid, nome) in &reg.rebaixados {
        if mesmo(*pid, nome) {
            let _ = sis.prioridade(*pid, Prioridade::Normal);
        }
    }
    if reg.jogo_prioridade_alterada {
        if let Some(pid) = reg.jogo_pid {
            let _ = sis.prioridade(pid, Prioridade::Normal);
        }
    }
    if let Some(n) = &reg.notificacoes_antes {
        let _ = sis.restaurar_notificacoes(n);
    }
    if let Some(e) = &reg.energia_antes {
        let _ = sis.restaurar_energia(e);
    }
    if let Some(p) = &reg.gpu_programa {
        let _ = sis.gpu_dedicada(p, false);
    }
    if reg.acordado {
        let _ = sis.manter_acordado(false);
    }
    let _ = fs::remove_file(arquivo_do_registro(pasta_dados));
    true
}

// ------------------------------------------------------------------ implementação real
pub struct SistemaReal {
    #[cfg(windows)]
    acordado: std::sync::Mutex<Option<std::sync::mpsc::Sender<()>>>,
}

impl SistemaReal {
    pub fn novo() -> SistemaReal {
        SistemaReal {
            #[cfg(windows)]
            acordado: std::sync::Mutex::new(None),
        }
    }
}

impl Default for SistemaReal {
    fn default() -> Self {
        Self::novo()
    }
}

fn executar(programa: &str, args: &[&str]) -> Result<String, String> {
    let mut c = std::process::Command::new(programa);
    c.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000); // sem abrir janela preta
    }
    let o = c.output().map_err(|e| format!("{programa}: {e}"))?;
    if o.status.success() {
        Ok(String::from_utf8_lossy(&o.stdout).to_string())
    } else {
        Err(format!("{programa} falhou: {}", String::from_utf8_lossy(&o.stderr).trim()))
    }
}

/// "ToastEnabled    REG_DWORD    0x0" → "0"
pub fn valor_do_registro(saida: &str) -> Option<String> {
    let l = saida.lines().find(|l| l.contains("REG_DWORD"))?;
    let v = l.split_whitespace().last()?;
    u32::from_str_radix(v.trim_start_matches("0x"), 16).ok().map(|n| n.to_string())
}

/// "Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced)" → o GUID
pub fn guid_do_plano(saida: &str) -> Option<String> {
    let t = saida.split("GUID:").nth(1)?.trim();
    let g = t.split_whitespace().next()?;
    if g.len() == 36 && g.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        Some(g.to_string())
    } else {
        None
    }
}

#[cfg(windows)]
mod nativo {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::ProcessStatus::K32EmptyWorkingSet;
    use windows_sys::Win32::System::Threading::{OpenProcess, SetPriorityClass, ABOVE_NORMAL_PRIORITY_CLASS, BELOW_NORMAL_PRIORITY_CLASS, HIGH_PRIORITY_CLASS, NORMAL_PRIORITY_CLASS, PROCESS_QUERY_INFORMATION, PROCESS_SET_INFORMATION, PROCESS_SET_QUOTA};

    const PROCESS_SUSPEND_RESUME: u32 = 0x0800;

    #[link(name = "ntdll")]
    extern "system" {
        fn NtSuspendProcess(processo: *mut core::ffi::c_void) -> i32;
        fn NtResumeProcess(processo: *mut core::ffi::c_void) -> i32;
    }

    pub fn prioridade(pid: u32, alta: Option<bool>, baixa: bool) -> Result<(), String> {
        let classe = if baixa { BELOW_NORMAL_PRIORITY_CLASS } else if alta == Some(true) { HIGH_PRIORITY_CLASS } else if alta == Some(false) { ABOVE_NORMAL_PRIORITY_CLASS } else { NORMAL_PRIORITY_CLASS };
        unsafe {
            let h = OpenProcess(PROCESS_SET_INFORMATION, 0, pid);
            if h.is_null() {
                return Err(format!("sem acesso ao processo {pid}"));
            }
            let ok = SetPriorityClass(h, classe) != 0;
            CloseHandle(h);
            if ok { Ok(()) } else { Err(format!("o Windows recusou mudar o processo {pid}")) }
        }
    }

    pub fn suspender(pid: u32, retomar: bool) -> Result<(), String> {
        unsafe {
            let h = OpenProcess(PROCESS_SUSPEND_RESUME, 0, pid);
            if h.is_null() {
                return Err(format!("sem acesso ao processo {pid}"));
            }
            let r = if retomar { NtResumeProcess(h) } else { NtSuspendProcess(h) };
            CloseHandle(h);
            if r >= 0 { Ok(()) } else { Err(format!("não consegui pausar o processo {pid}")) }
        }
    }

    pub fn liberar(pid: u32) -> Result<(), String> {
        unsafe {
            let h = OpenProcess(PROCESS_SET_QUOTA | PROCESS_QUERY_INFORMATION, 0, pid);
            if h.is_null() {
                return Err(format!("sem acesso ao processo {pid}"));
            }
            let ok = K32EmptyWorkingSet(h) != 0;
            CloseHandle(h);
            if ok { Ok(()) } else { Err("não consegui liberar a memória".into()) }
        }
    }

    /// Mantém PC e tela acordados enquanto a thread viver (o estado vale por thread).
    pub fn acordado_enquanto_receber(rx: std::sync::mpsc::Receiver<()>) {
        use windows_sys::Win32::System::Power::{SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED};
        unsafe {
            SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED);
        }
        let _ = rx.recv();
        unsafe {
            SetThreadExecutionState(ES_CONTINUOUS);
        }
    }
}

impl Sistema for SistemaReal {
    fn processos(&self) -> Vec<Proc> {
        use sysinfo::{ProcessesToUpdate, System};
        let mut s = System::new();
        s.refresh_processes(ProcessesToUpdate::All, true);
        s.processes().iter().map(|(pid, p)| Proc { pid: pid.as_u32(), nome: p.name().to_string_lossy().to_string(), memoria: p.memory(), pai: p.parent().map(|x| x.as_u32()) }).collect()
    }

    fn prioridade(&self, pid: u32, p: Prioridade) -> Result<(), String> {
        #[cfg(windows)]
        {
            return match p {
                Prioridade::Alta => nativo::prioridade(pid, Some(true), false),
                Prioridade::AbaixoDoNormal => nativo::prioridade(pid, None, true),
                Prioridade::Normal => nativo::prioridade(pid, None, false),
            };
        }
        #[cfg(not(windows))]
        {
            let n = match p {
                Prioridade::Alta => "-5",
                Prioridade::AbaixoDoNormal => "10",
                Prioridade::Normal => "0",
            };
            executar("renice", &["-n", n, "-p", &pid.to_string()]).map(|_| ())
        }
    }

    fn pausar(&self, pid: u32) -> Result<(), String> {
        #[cfg(windows)]
        {
            return nativo::suspender(pid, false);
        }
        #[cfg(not(windows))]
        {
            executar("kill", &["-STOP", &pid.to_string()]).map(|_| ())
        }
    }

    fn retomar(&self, pid: u32) -> Result<(), String> {
        #[cfg(windows)]
        {
            return nativo::suspender(pid, true);
        }
        #[cfg(not(windows))]
        {
            executar("kill", &["-CONT", &pid.to_string()]).map(|_| ())
        }
    }

    fn liberar_memoria(&self, pid: u32) -> Result<(), String> {
        #[cfg(windows)]
        {
            return nativo::liberar(pid);
        }
        #[cfg(not(windows))]
        {
            let _ = pid;
            Err("sem suporte neste sistema".into())
        }
    }

    fn notificacoes(&self, ligadas: bool) -> Result<Option<String>, String> {
        #[cfg(windows)]
        {
            const CHAVE: &str = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications";
            let antes = executar("reg", &["query", CHAVE, "/v", "ToastEnabled"]).ok().and_then(|s| valor_do_registro(&s));
            executar("reg", &["add", CHAVE, "/v", "ToastEnabled", "/t", "REG_DWORD", "/d", if ligadas { "1" } else { "0" }, "/f"])?;
            return Ok(antes);
        }
        #[cfg(not(windows))]
        {
            let antes = executar("gsettings", &["get", "org.gnome.desktop.notifications", "show-banners"]).ok().map(|s| s.trim().to_string());
            executar("gsettings", &["set", "org.gnome.desktop.notifications", "show-banners", if ligadas { "true" } else { "false" }])?;
            Ok(antes)
        }
    }

    fn restaurar_notificacoes(&self, anterior: &str) -> Result<(), String> {
        #[cfg(windows)]
        {
            let v = if anterior == "0" { "0" } else { "1" };
            return executar("reg", &["add", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\PushNotifications", "/v", "ToastEnabled", "/t", "REG_DWORD", "/d", v, "/f"]).map(|_| ());
        }
        #[cfg(not(windows))]
        {
            let v = if anterior.contains("false") { "false" } else { "true" };
            executar("gsettings", &["set", "org.gnome.desktop.notifications", "show-banners", v]).map(|_| ())
        }
    }

    fn energia_maxima(&self) -> Result<Option<String>, String> {
        #[cfg(windows)]
        {
            let antes = executar("powercfg", &["/getactivescheme"]).ok().and_then(|s| guid_do_plano(&s));
            executar("powercfg", &["/setactive", "SCHEME_MIN"])?;
            return Ok(antes);
        }
        #[cfg(not(windows))]
        {
            let antes = executar("powerprofilesctl", &["get"]).ok().map(|s| s.trim().to_string());
            executar("powerprofilesctl", &["set", "performance"])?;
            Ok(antes)
        }
    }

    fn restaurar_energia(&self, anterior: &str) -> Result<(), String> {
        #[cfg(windows)]
        {
            return executar("powercfg", &["/setactive", anterior]).map(|_| ());
        }
        #[cfg(not(windows))]
        {
            executar("powerprofilesctl", &["set", anterior]).map(|_| ())
        }
    }

    fn gpu_dedicada(&self, programa: &Path, ligada: bool) -> Result<(), String> {
        #[cfg(windows)]
        {
            const CHAVE: &str = "HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences";
            let p = programa.to_string_lossy().to_string();
            return if ligada { executar("reg", &["add", CHAVE, "/v", &p, "/t", "REG_SZ", "/d", "GpuPreference=2;", "/f"]).map(|_| ()) } else { executar("reg", &["delete", CHAVE, "/v", &p, "/f"]).map(|_| ()) };
        }
        #[cfg(not(windows))]
        {
            let _ = (programa, ligada);
            Err("sem suporte neste sistema".into())
        }
    }

    fn manter_acordado(&self, ligado: bool) -> Result<(), String> {
        #[cfg(windows)]
        {
            let mut g = self.acordado.lock().map_err(|e| e.to_string())?;
            if ligado && g.is_none() {
                let (tx, rx) = std::sync::mpsc::channel();
                std::thread::spawn(move || nativo::acordado_enquanto_receber(rx));
                *g = Some(tx);
            } else if !ligado {
                if let Some(tx) = g.take() {
                    let _ = tx.send(());
                }
            }
            return Ok(());
        }
        #[cfg(not(windows))]
        {
            let _ = ligado;
            Ok(())
        }
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::cell::RefCell;

    #[derive(Default)]
    struct Falso {
        procs: Vec<Proc>,
        chamadas: RefCell<Vec<String>>,
        falhar_energia: bool,
    }

    impl Sistema for Falso {
        fn processos(&self) -> Vec<Proc> {
            self.procs.clone()
        }
        fn prioridade(&self, pid: u32, p: Prioridade) -> Result<(), String> {
            self.chamadas.borrow_mut().push(format!("prioridade {pid} {p:?}"));
            Ok(())
        }
        fn pausar(&self, pid: u32) -> Result<(), String> {
            self.chamadas.borrow_mut().push(format!("pausar {pid}"));
            Ok(())
        }
        fn retomar(&self, pid: u32) -> Result<(), String> {
            self.chamadas.borrow_mut().push(format!("retomar {pid}"));
            Ok(())
        }
        fn liberar_memoria(&self, pid: u32) -> Result<(), String> {
            self.chamadas.borrow_mut().push(format!("liberar {pid}"));
            Ok(())
        }
        fn notificacoes(&self, ligadas: bool) -> Result<Option<String>, String> {
            self.chamadas.borrow_mut().push(format!("notificacoes {ligadas}"));
            Ok(Some("1".into()))
        }
        fn restaurar_notificacoes(&self, a: &str) -> Result<(), String> {
            self.chamadas.borrow_mut().push(format!("restaurar_notificacoes {a}"));
            Ok(())
        }
        fn energia_maxima(&self) -> Result<Option<String>, String> {
            if self.falhar_energia {
                return Err("sem plano".into());
            }
            self.chamadas.borrow_mut().push("energia".into());
            Ok(Some("guid-antigo".into()))
        }
        fn restaurar_energia(&self, a: &str) -> Result<(), String> {
            self.chamadas.borrow_mut().push(format!("restaurar_energia {a}"));
            Ok(())
        }
        fn gpu_dedicada(&self, p: &Path, l: bool) -> Result<(), String> {
            self.chamadas.borrow_mut().push(format!("gpu {} {l}", p.display()));
            Ok(())
        }
        fn manter_acordado(&self, l: bool) -> Result<(), String> {
            self.chamadas.borrow_mut().push(format!("acordado {l}"));
            Ok(())
        }
    }

    fn p(pid: u32, nome: &str, mb: u64, pai: Option<u32>) -> Proc {
        Proc { pid, nome: nome.into(), memoria: mb * 1024 * 1024, pai }
    }

    fn cenario() -> Vec<Proc> {
        vec![
            p(4, "System", 1, None),
            p(100, "explorer.exe", 200, None),
            p(200, "vortex.exe", 150, Some(100)),
            p(300, "retroarch.exe", 300, Some(200)),
            p(301, "retroarch-helper.exe", 20, Some(300)),
            p(400, "chrome.exe", 900, Some(100)),
            p(401, "chrome.exe", 400, Some(400)),
            p(500, "Discord.exe", 350, Some(100)),
            p(600, "GoogleUpdate.exe", 10, None),
            p(700, "MsMpEng.exe", 250, None),
            p(800, "nvcontainer.exe", 50, None),
            p(900, "notepad.exe", 30, Some(100)),
            p(1000, "OneDrive.exe", 120, Some(100)),
        ]
    }

    #[test]
    fn plano_so_mexe_no_que_e_seguro() {
        let plano = planejar(&cenario(), &[300, 200], &Configuracao::default());
        let nomes: Vec<(&str, Acao)> = plano.alvos.iter().map(|a| (a.nome.as_str(), a.acao)).collect();
        assert_eq!(nomes, vec![("chrome", Acao::Rebaixar), ("chrome", Acao::Rebaixar), ("discord", Acao::Rebaixar), ("onedrive", Acao::Rebaixar), ("googleupdate", Acao::Pausar)]);
        assert_eq!(plano.ram_estimada, (900 + 400 + 350 + 120) * 1024 * 1024);
        // protegidos nunca aparecem
        assert!(!plano.alvos.iter().any(|a| ["explorer", "msmpeng", "nvcontainer", "retroarch", "vortex", "notepad", "system"].contains(&a.nome.as_str())));
    }

    #[test]
    fn filhos_e_ancestrais_do_jogo_ficam_protegidos() {
        // se o Chrome fosse o "pai" do jogo (ex.: aberto por um site), ele não pode ser rebaixado
        let procs = vec![p(10, "chrome.exe", 500, None), p(11, "emulador.exe", 100, Some(10)), p(12, "chrome.exe", 300, Some(11)), p(13, "chrome.exe", 200, None)];
        let plano = planejar(&procs, &[11], &Configuracao::default());
        assert_eq!(plano.alvos.iter().map(|a| a.pid).collect::<Vec<_>>(), vec![13]);
    }

    #[test]
    fn configuracao_liga_e_desliga_partes() {
        let sem = Configuracao { rebaixar_apps: false, pausar_atualizadores: false, ..Default::default() };
        assert!(planejar(&cenario(), &[300], &sem).alvos.is_empty());
        let so_pausar = Configuracao { rebaixar_apps: false, ..Default::default() };
        assert_eq!(planejar(&cenario(), &[300], &so_pausar).alvos.len(), 1);
        let extra = Configuracao { rebaixar_extra: vec!["Notepad.exe".into()], ..Default::default() };
        assert!(planejar(&cenario(), &[300], &extra).alvos.iter().any(|a| a.nome == "notepad"));
        let protegendo = Configuracao { protegidos_extra: vec!["discord".into()], ..Default::default() };
        assert!(!planejar(&cenario(), &[300], &protegendo).alvos.iter().any(|a| a.nome == "discord"));
        let sem_ram = Configuracao { liberar_ram: false, ..Default::default() };
        assert_eq!(planejar(&cenario(), &[300], &sem_ram).ram_estimada, 0);
    }

    #[test]
    fn ativa_e_desfaz_tudo() {
        let t = tempfile::tempdir().unwrap();
        let sis = Falso { procs: cenario(), ..Default::default() };
        let rel = ativar(&sis, &Configuracao::default(), 300, Some(Path::new("C:/RetroArch/retroarch.exe")), &[200], t.path(), 5000);
        assert!(rel.prioridade_do_jogo && rel.notificacoes_silenciadas && rel.energia_maxima && rel.gpu_dedicada && rel.manter_acordado);
        assert_eq!((rel.rebaixados, rel.pausados), (4, 1));
        assert_eq!(rel.ram_liberada_estimada, (900 + 400 + 350 + 120) * 1024 * 1024);
        assert!(rel.avisos.is_empty(), "{:?}", rel.avisos);
        let c = sis.chamadas.borrow().clone();
        assert!(c.contains(&"prioridade 300 Alta".to_string()));
        assert!(c.contains(&"prioridade 400 AbaixoDoNormal".to_string()));
        assert!(c.contains(&"pausar 600".to_string()));
        assert!(c.contains(&"notificacoes false".to_string()));
        assert!(pendente(t.path()).is_some());
        sis.chamadas.borrow_mut().clear();

        assert!(desativar(&sis, t.path()));
        let c = sis.chamadas.borrow().clone();
        assert!(c.contains(&"retomar 600".to_string()));
        assert!(c.contains(&"prioridade 400 Normal".to_string()));
        assert!(c.contains(&"prioridade 300 Normal".to_string()));
        assert!(c.contains(&"restaurar_notificacoes 1".to_string()));
        assert!(c.contains(&"restaurar_energia guid-antigo".to_string()));
        assert!(c.iter().any(|x| x.starts_with("gpu ") && x.ends_with("false")));
        assert!(c.contains(&"acordado false".to_string()));
        assert!(pendente(t.path()).is_none());
        // segunda chamada não faz nada
        sis.chamadas.borrow_mut().clear();
        assert!(!desativar(&sis, t.path()));
        assert!(sis.chamadas.borrow().is_empty());
    }

    #[test]
    fn nao_mexe_em_processo_que_mudou_de_dono() {
        let t = tempfile::tempdir().unwrap();
        let mut sis = Falso { procs: cenario(), ..Default::default() };
        ativar(&sis, &Configuracao::default(), 300, None, &[200], t.path(), 1);
        // o Chrome 400 fechou e o número foi reaproveitado por outro programa
        sis.procs.iter_mut().find(|x| x.pid == 400).unwrap().nome = "outro.exe".into();
        sis.chamadas.borrow_mut().clear();
        desativar(&sis, t.path());
        assert!(!sis.chamadas.borrow().iter().any(|c| c == "prioridade 400 Normal"));
        assert!(sis.chamadas.borrow().iter().any(|c| c == "prioridade 401 Normal"));
    }

    #[test]
    fn falha_em_um_passo_nao_derruba_os_outros() {
        let t = tempfile::tempdir().unwrap();
        let sis = Falso { procs: cenario(), falhar_energia: true, ..Default::default() };
        let rel = ativar(&sis, &Configuracao::default(), 300, None, &[200], t.path(), 1);
        assert!(!rel.energia_maxima && rel.notificacoes_silenciadas && rel.rebaixados == 4);
        assert_eq!(rel.avisos.len(), 1);
        assert!(rel.avisos[0].contains("Plano de energia"));
        assert!(!rel.gpu_dedicada); // sem caminho do jogo, não há o que configurar
    }

    #[test]
    fn desligado_nao_faz_nada_e_pendencia_antiga_e_desfeita() {
        let t = tempfile::tempdir().unwrap();
        let sis = Falso { procs: cenario(), ..Default::default() };
        let desligado = Configuracao { ligado: false, ..Default::default() };
        assert_eq!(ativar(&sis, &desligado, 300, None, &[], t.path(), 1), Relatorio::default());
        assert!(sis.chamadas.borrow().is_empty() && pendente(t.path()).is_none());
        // o Vortex fechou no meio de um jogo: na vez seguinte, o que ficou é desfeito antes de começar
        ativar(&sis, &Configuracao::default(), 300, None, &[200], t.path(), 1);
        sis.chamadas.borrow_mut().clear();
        ativar(&sis, &Configuracao::default(), 300, None, &[200], t.path(), 2);
        assert!(sis.chamadas.borrow().iter().any(|c| c.starts_with("retomar")));
    }

    #[test]
    fn configuracao_persiste() {
        let t = tempfile::tempdir().unwrap();
        let a = t.path().join("x/modo.json");
        assert_eq!(Configuracao::carregar(&a), Configuracao::default());
        let c = Configuracao { energia_maxima: false, protegidos_extra: vec!["obs64".into()], ..Default::default() };
        c.salvar(&a).unwrap();
        assert_eq!(Configuracao::carregar(&a), c);
        std::fs::write(&a, "{ quebrado").unwrap();
        assert_eq!(Configuracao::carregar(&a), Configuracao::default());
    }

    #[test]
    fn le_saidas_do_windows() {
        assert_eq!(valor_do_registro("\nHKEY_CURRENT_USER\\x\n    ToastEnabled    REG_DWORD    0x1\n").as_deref(), Some("1"));
        assert_eq!(valor_do_registro("    ToastEnabled    REG_DWORD    0x0").as_deref(), Some("0"));
        assert_eq!(valor_do_registro("erro"), None);
        assert_eq!(guid_do_plano("Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced)").as_deref(), Some("381b4222-f694-41f0-9685-ff5bb260df2e"));
        assert_eq!(guid_do_plano("sem guid"), None);
        assert_eq!(nome_limpo(" Chrome.EXE "), "chrome");
    }

    #[test]
    fn sistema_real_lista_processos() {
        let s = SistemaReal::novo();
        let v = s.processos();
        assert!(!v.is_empty());
        assert!(v.iter().any(|p| p.pid == std::process::id()));
    }
}
