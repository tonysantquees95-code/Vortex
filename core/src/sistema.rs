//! Varredura completa do computador: percorre todos os discos (inclusive o C:), acha as pastas que têm jogos de console e
//! arquivos ambíguos (.bin, .iso, .zip…) e resume o aparelho para uma IA ajudar a decidir. Só lê; quem adiciona pastas é o usuário.
use crate::emuladores::{Ambiente, So};
use crate::plataformas::{extensao, identificar, normalizar};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use walkdir::WalkDir;

/// Pastas do sistema e de programas que nunca guardam coleções de jogos (já normalizadas).
const PULAR: &[&str] = &[
    "windows", "programfiles", "programfilesx86", "programdata", "appdata", "recycle.bin", "recyclebin", "systemvolumeinformation", "nodemodules", "git",
    "recovery", "msocache", "perflogs", "windowsapps", "steamapps", "wsl", "onedrive", "dllcache", "config.msi", "intel", "amd", "nvidia", "drivers",
    "android", "bios", "saves", "states", "savestates", "screenshots", "thumbnails", "cheats", "boxart", "covers", "media", "vindexquarentena", "cache",
];
const AMBIGUAS: &[&str] = &["bin", "iso", "img", "zip", "7z", "chd", "cue", "rvz", "wbfs"];
const PROFUNDIDADE: usize = 9;
const LIMITE_ARQUIVOS: usize = 3_000_000;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct Candidata {
    pub pasta: PathBuf,
    pub total: usize,
    /// plataforma → quantidade de jogos reconhecidos
    pub plataformas: BTreeMap<String, usize>,
    /// arquivos que não deu para identificar só pela extensão
    pub ambiguos: usize,
    pub amostras: Vec<String>,
}

#[derive(Debug, Serialize, Default)]
pub struct Varredura {
    pub discos: Vec<PathBuf>,
    pub candidatas: Vec<Candidata>,
    pub arquivos_vistos: usize,
    pub completa: bool,
}

/// Discos que existem: A–Z no Windows; casa e pontos de montagem nos outros sistemas.
pub fn raizes_de_disco(amb: &Ambiente) -> Vec<PathBuf> {
    let mut v = Vec::new();
    if amb.so == So::Windows {
        for l in b'C'..=b'Z' {
            let p = PathBuf::from(format!("{}:\\", l as char));
            if p.is_dir() {
                v.push(p);
            }
        }
    } else if cfg!(target_os = "android") {
        v.push(PathBuf::from("/storage/emulated/0"));
        if let Ok(rd) = std::fs::read_dir("/storage") {
            for e in rd.filter_map(Result::ok) {
                let n = e.file_name().to_string_lossy().into_owned();
                if n != "emulated" && n != "self" && e.path().is_dir() {
                    v.push(e.path());
                }
            }
        }
    } else {
        v.push(amb.casa.clone());
        for base in ["/mnt", "/media", "/run/media"] {
            if let Ok(rd) = std::fs::read_dir(base) {
                for e in rd.filter_map(Result::ok) {
                    if e.path().is_dir() {
                        v.push(e.path());
                    }
                }
            }
        }
    }
    v
}

fn pular(nome: &str) -> bool {
    if nome.starts_with('$') || (nome.starts_with('.') && nome.len() > 1) {
        return true;
    }
    let n = normalizar(nome);
    PULAR.contains(&n.as_str())
}

#[derive(Default)]
struct Pasta {
    plataformas: BTreeMap<String, usize>,
    ambiguos: usize,
    amostras: Vec<String>,
}

/// Percorre `raizes` e devolve as pastas candidatas. `limite` encerra cedo (a varredura sai parcial, `completa = false`).
pub fn varrer(raizes: &[PathBuf], limite: Duration, casa: &Path) -> Varredura {
    let inicio = Instant::now();
    let mut por_pasta: BTreeMap<PathBuf, Pasta> = BTreeMap::new();
    let mut vistos = 0usize;
    let mut completa = true;
    'discos: for raiz in raizes {
        let it = WalkDir::new(raiz).follow_links(false).max_depth(PROFUNDIDADE).into_iter().filter_entry(|e| {
            if e.depth() == 0 || !e.file_type().is_dir() {
                return true;
            }
            !pular(&e.file_name().to_string_lossy())
        });
        for e in it.filter_map(Result::ok) {
            if !e.file_type().is_file() {
                continue;
            }
            vistos += 1;
            if vistos % 2000 == 0 && (inicio.elapsed() > limite || vistos > LIMITE_ARQUIVOS) {
                completa = false;
                break 'discos;
            }
            let p = e.path();
            let Some(pai) = p.parent() else { continue };
            if let Some(pl) = identificar(p, raiz) {
                *por_pasta.entry(pai.to_path_buf()).or_default().plataformas.entry(pl.id.to_string()).or_insert(0) += 1;
            } else if AMBIGUAS.contains(&extensao(p).as_str()) {
                let f = por_pasta.entry(pai.to_path_buf()).or_default();
                f.ambiguos += 1;
                if f.amostras.len() < 6 {
                    f.amostras.push(p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default());
                }
            }
        }
    }
    Varredura { discos: raizes.to_vec(), candidatas: agrupar(por_pasta, casa), arquivos_vistos: vistos, completa }
}

fn soma(a: &mut Pasta, b: &Pasta) {
    for (k, v) in &b.plataformas {
        *a.plataformas.entry(k.clone()).or_insert(0) += v;
    }
    a.ambiguos += b.ambiguos;
    for s in &b.amostras {
        if a.amostras.len() < 6 {
            a.amostras.push(s.clone());
        }
    }
}

/// Sobe cada pasta para a "coleção" a que pertence: se a pasta de cima tem 2 ou mais subpastas com jogos
/// (ex.: Roms\NES, Roms\SNES), a candidata é a de cima; discos e a pasta pessoal nunca viram candidatas.
fn agrupar(por_pasta: BTreeMap<PathBuf, Pasta>, casa: &Path) -> Vec<Candidata> {
    let mut atual = por_pasta;
    loop {
        let mut filhos: BTreeMap<PathBuf, Vec<PathBuf>> = BTreeMap::new();
        for p in atual.keys() {
            if let Some(pai) = p.parent() {
                filhos.entry(pai.to_path_buf()).or_default().push(p.clone());
            }
        }
        let mut proximo: BTreeMap<PathBuf, Pasta> = BTreeMap::new();
        let mut mudou = false;
        for (p, dados) in atual {
            let pai = p.parent().map(|x| x.to_path_buf());
            let sobe = match &pai {
                Some(pai) => {
                    let irmaos = filhos.get(pai).map(|v| v.len()).unwrap_or(0);
                    irmaos >= 2 && pai.parent().is_some() && pai != casa
                }
                None => false,
            };
            let destino = if sobe { pai.unwrap() } else { p };
            soma(proximo.entry(destino).or_default(), &dados);
            mudou |= sobe;
        }
        atual = proximo;
        if !mudou {
            break;
        }
    }
    let mut v: Vec<Candidata> = atual
        .into_iter()
        .map(|(pasta, d)| {
            let total: usize = d.plataformas.values().sum();
            Candidata { pasta, total, plataformas: d.plataformas, ambiguos: d.ambiguos, amostras: d.amostras }
        })
        .filter(|c| c.total >= 2 || c.ambiguos >= 3)
        .collect();
    v.sort_by(|a, b| b.total.cmp(&a.total).then(a.pasta.cmp(&b.pasta)));
    v
}

/// Dados do aparelho para ajustar a configuração (sem nada pessoal além de nomes de pastas de jogos).
#[derive(Debug, Serialize, Default)]
pub struct Aparelho {
    pub so: String,
    pub cpu: String,
    pub nucleos: usize,
    pub ram_gb: u64,
}

pub fn aparelho() -> Aparelho {
    let mut s = sysinfo::System::new();
    s.refresh_memory();
    s.refresh_cpu_all();
    Aparelho {
        so: std::env::consts::OS.to_string(),
        cpu: s.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default(),
        nucleos: s.cpus().len(),
        ram_gb: s.total_memory() / (1024 * 1024 * 1024),
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::fs;

    fn arq(p: &Path) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, "x").unwrap();
    }

    #[test]
    fn acha_colecao_e_sobe_para_a_pasta_de_cima() {
        let t = std::env::temp_dir().join(format!("vortex_sis_{}", std::process::id()));
        let _ = fs::remove_dir_all(&t);
        for i in 0..3 {
            arq(&t.join("Jogos").join("Retro").join("NES").join(format!("j{i}.nes")));
            arq(&t.join("Jogos").join("Retro").join("SNES").join(format!("j{i}.sfc")));
        }
        arq(&t.join("Windows").join("x.nes"));
        arq(&t.join("Outros").join("PS1").join("a.bin"));
        let v = varrer(&[t.clone()], Duration::from_secs(10), &t.join("casa"));
        assert!(v.completa);
        let c = v.candidatas.iter().find(|c| c.pasta == t.join("Jogos").join("Retro")).expect("sobe para Retro");
        assert_eq!(c.total, 6);
        assert_eq!(c.plataformas.len(), 2);
        assert!(!v.candidatas.iter().any(|c| c.pasta.starts_with(t.join("Windows"))));
        let _ = fs::remove_dir_all(&t);
    }

    #[test]
    fn pasta_unica_fica_onde_esta() {
        let t = std::env::temp_dir().join(format!("vortex_sis2_{}", std::process::id()));
        let _ = fs::remove_dir_all(&t);
        for i in 0..3 {
            arq(&t.join("Games").join("GBA").join(format!("j{i}.gba")));
        }
        let v = varrer(&[t.clone()], Duration::from_secs(10), &t.join("casa"));
        assert_eq!(v.candidatas.len(), 1);
        assert_eq!(v.candidatas[0].pasta, t.join("Games").join("GBA"));
        let _ = fs::remove_dir_all(&t);
    }
}
