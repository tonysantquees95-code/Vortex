//! Organizador automático: acha jogos retrô soltos no computador (Downloads, Documentos, pastas de ROMs…), identifica o console,
//! descompacta o que for preciso e guarda tudo na pasta do Vortex, uma pasta por console. Cada movimento fica num registro para desfazer.
use crate::plataformas::{self, Plataforma};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Item {
    pub origem: PathBuf,
    pub destino: PathBuf,
    pub plataforma: String,
    /// true quando o jogo estava num .zip e foi descompactado (a origem é o zip)
    pub extraido: bool,
}

#[derive(Debug, Default, Serialize)]
pub struct Relatorio {
    pub organizados: Vec<Item>,
    pub ja_no_lugar: usize,
    pub falhas: Vec<String>,
    /// zerados ou quebrados: não entram na biblioteca, vão para a pasta "Corrompidos" (nada é apagado)
    pub descartados: Vec<String>,
    pub simulacao: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Registro {
    pub movimentos: Vec<Item>,
}

/// Pastas onde jogos costumam ficar soltos. Só devolve as que existem.
pub fn candidatos(casa: &Path, windows: bool) -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = ["Downloads", "Documents", "Documentos", "Desktop", "Área de Trabalho", "Games", "Jogos", "Roms", "ROMs", "Emulation", "Emulacao"].iter().map(|n| casa.join(n)).collect();
    if windows {
        for letra in b'C'..=b'Z' {
            for n in ["Roms", "ROMs", "Games", "Jogos", "Emulation", "Emulacao", "Retro"] {
                v.push(PathBuf::from(format!("{}:\\{n}", letra as char)));
            }
        }
    }
    v.retain(|p| p.is_dir());
    v.dedup();
    v
}

fn nome_de_pasta(p: &Plataforma) -> String {
    p.nome.chars().map(|c| if "<>:\"/\\|?*".contains(c) { '-' } else { c }).collect::<String>().trim().to_string()
}

pub(crate) fn livre(destino: PathBuf) -> PathBuf {
    if !destino.exists() {
        return destino;
    }
    let stem = destino.file_stem().and_then(|s| s.to_str()).unwrap_or("jogo").to_string();
    let ext = destino.extension().and_then(|s| s.to_str()).map(|e| format!(".{e}")).unwrap_or_default();
    for n in 2.. {
        let c = destino.with_file_name(format!("{stem} ({n}){ext}"));
        if !c.exists() {
            return c;
        }
    }
    unreachable!()
}

pub(crate) fn mover_arquivo(de: &Path, para: &Path) -> Result<(), String> {
    if let Some(p) = para.parent() {
        fs::create_dir_all(p).map_err(|e| format!("{}: {e}", p.display()))?;
    }
    if fs::rename(de, para).is_ok() {
        return Ok(());
    }
    fs::copy(de, para).map_err(|e| format!("{}: {e}", de.display()))?;
    fs::remove_file(de).map_err(|e| format!("{}: {e}", de.display()))
}

/// Arquivos que acompanham uma imagem de disco: .bin/.img de um .cue, e quem tem o mesmo nome-base.
pub(crate) fn acompanhantes(arquivo: &Path) -> Vec<PathBuf> {
    let ext = plataformas::extensao(arquivo);
    let Some(dir) = arquivo.parent() else { return vec![] };
    let mut v = Vec::new();
    if ext == "cue" || ext == "gdi" || ext == "m3u" {
        if let Ok(txt) = fs::read_to_string(arquivo) {
            for l in txt.lines() {
                let l = l.trim();
                let alvo = if let (Some(a), Some(b)) = (l.find('"'), l.rfind('"')) { if b > a { Some(&l[a + 1..b]) } else { None } } else if ext != "cue" { Some(l) } else { None };
                if let Some(n) = alvo.filter(|n| !n.is_empty() && !n.starts_with('#')) {
                    let p = dir.join(n);
                    if p.is_file() && p != arquivo {
                        v.push(p);
                    }
                }
            }
        }
    }
    if ext == "cue" || ext == "ccd" || ext == "mds" {
        let stem = arquivo.file_stem().and_then(|s| s.to_str()).unwrap_or("");
        if let Ok(rd) = fs::read_dir(dir) {
            for e in rd.flatten() {
                let p = e.path();
                if p != arquivo && p.is_file() && p.file_stem().and_then(|s| s.to_str()) == Some(stem) && ["bin", "img", "sub", "iso", "mdf"].contains(&plataformas::extensao(&p).as_str()) && !v.contains(&p) {
                    v.push(p);
                }
            }
        }
    }
    v
}

fn nomes_do_zip(caminho: &Path) -> Vec<String> {
    let Ok(f) = fs::File::open(caminho) else { return vec![] };
    let Ok(mut z) = zip::ZipArchive::new(f) else { return vec![] };
    (0..z.len().min(200)).filter_map(|i| z.by_index(i).ok().filter(|e| !e.is_dir()).map(|e| e.name().to_string())).collect()
}

/// Descompacta um .zip dentro de `pasta`. Se for um jogo só, o arquivo vai direto para a pasta; senão cria uma subpasta com o nome do zip.
fn extrair(zipado: &Path, pasta: &Path, plat: &Plataforma) -> Result<PathBuf, String> {
    let f = fs::File::open(zipado).map_err(|e| e.to_string())?;
    let mut z = zip::ZipArchive::new(f).map_err(|e| format!("Zip inválido ({}): {e}", zipado.display()))?;
    let arquivos = (0..z.len()).filter(|i| z.by_index(*i).map(|e| !e.is_dir()).unwrap_or(false)).count();
    let stem = zipado.file_stem().and_then(|s| s.to_str()).unwrap_or("jogo");
    let base = if arquivos <= 1 { pasta.to_path_buf() } else { livre(pasta.join(stem)) };
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let mut principal = base.clone();
    for i in 0..z.len() {
        let mut e = z.by_index(i).map_err(|e| e.to_string())?;
        let Some(rel) = e.enclosed_name() else { continue }; // ignora caminhos que tentam sair da pasta
        if e.is_dir() {
            continue;
        }
        let nome = if arquivos <= 1 { PathBuf::from(rel.file_name().unwrap_or_default()) } else { rel };
        let alvo = if arquivos <= 1 { livre(base.join(nome)) } else { base.join(nome) };
        if let Some(p) = alvo.parent() {
            fs::create_dir_all(p).map_err(|e| e.to_string())?;
        }
        let mut s = fs::File::create(&alvo).map_err(|e| e.to_string())?;
        std::io::copy(&mut e, &mut s).map_err(|e| e.to_string())?;
        if arquivos <= 1 || (principal == base && plat.extensoes.contains(&plataformas::extensao(&alvo).as_str())) {
            principal = alvo;
        }
    }
    Ok(principal)
}

fn percorrer(dir: &Path, fora: &Path, nivel: u32, saida: &mut Vec<PathBuf>) {
    if nivel > 6 {
        return;
    }
    let Ok(rd) = fs::read_dir(dir) else { return };
    for e in rd.flatten() {
        let p = e.path();
        let nome = e.file_name().to_string_lossy().to_string();
        if nome.starts_with('.') || p.starts_with(fora) {
            continue;
        }
        if p.is_dir() {
            if matches!(nome.to_lowercase().as_str(), "windows" | "program files" | "program files (x86)" | "appdata" | "node_modules" | "$recycle.bin" | "system volume information") {
                continue;
            }
            percorrer(&p, fora, nivel + 1, saida);
        } else {
            saida.push(p);
        }
    }
}

/// Varre `origens`, identifica jogos e guarda em `pasta_vortex/<Console>/`. Com `simulacao` só conta o que faria.
pub fn organizar(origens: &[PathBuf], pasta_vortex: &Path, simulacao: bool) -> (Relatorio, Registro) {
    let mut rel = Relatorio { simulacao, ..Default::default() };
    let mut reg = Registro::default();
    let mut feitos: std::collections::HashSet<PathBuf> = Default::default();
    for raiz in origens {
        if !raiz.is_dir() || raiz.starts_with(pasta_vortex) {
            continue;
        }
        let mut todos = Vec::new();
        percorrer(raiz, pasta_vortex, 0, &mut todos);
        todos.sort();
        // arquivos que só acompanham uma imagem de disco (.bin de um .cue) não são jogos por conta própria
        let acomp: std::collections::HashSet<PathBuf> = todos.iter().filter(|a| ["cue", "gdi", "m3u", "ccd", "mds"].contains(&plataformas::extensao(a).as_str())).flat_map(|a| acompanhantes(a)).collect();
        for arq in todos {
            if feitos.contains(&arq) || acomp.contains(&arq) || !arq.exists() {
                continue;
            }
            let ext = plataformas::extensao(&arq);
            // zerado ou quebrado: vai para "Corrompidos" em vez de ficar dando erro a cada busca
            if plataformas::eh_pacote(&ext) || plataformas::identificar(&arq, raiz).is_some() {
                let vazio = fs::metadata(&arq).map(|m| m.len() == 0).unwrap_or(false);
                let motivo = if vazio { Some("arquivo vazio".to_string()) } else if plataformas::eh_pacote(&ext) { crate::limpeza::motivo_de_corrupcao(&arq) } else { None };
                if let Some(m) = motivo {
                    rel.descartados.push(format!("{} ({m})", arq.display()));
                    feitos.insert(arq.clone());
                    if !simulacao {
                        if let Err(e) = mover_arquivo(&arq, &livre(pasta_vortex.join(crate::limpeza::PASTA_CORROMPIDOS).join(arq.file_name().unwrap_or_default()))) {
                            rel.falhas.push(e);
                        }
                    }
                    continue;
                }
            }
            // zip: só se descobrir o console pelo conteúdo e não estiver em pasta de arcade (arcade usa o zip fechado)
            let (plat, do_zip) = if plataformas::eh_pacote(&ext) {
                match plataformas::plataforma_da_pasta(&arq, raiz) {
                    Some(p) if p.id == "arcade" => (Some(p), false),
                    _ => (plataformas::identificar_dentro(&nomes_do_zip(&arq)), true),
                }
            } else {
                (plataformas::identificar(&arq, raiz), false)
            };
            let Some(plat) = plat else { continue };
            let pasta = pasta_vortex.join(nome_de_pasta(plat));
            feitos.insert(arq.clone());
            if do_zip {
                if simulacao {
                    rel.organizados.push(Item { origem: arq.clone(), destino: pasta.clone(), plataforma: plat.id.into(), extraido: true });
                    continue;
                }
                match extrair(&arq, &pasta, plat) {
                    Ok(dest) => {
                        let _ = fs::remove_file(&arq);
                        let it = Item { origem: arq.clone(), destino: dest, plataforma: plat.id.into(), extraido: true };
                        reg.movimentos.push(it.clone());
                        rel.organizados.push(it);
                    }
                    Err(e) => rel.falhas.push(e),
                }
                continue;
            }
            let mut grupo = vec![arq.clone()];
            grupo.extend(acompanhantes(&arq));
            let pasta_do_jogo = if grupo.len() > 1 { pasta.join(arq.file_stem().and_then(|s| s.to_str()).unwrap_or("jogo")) } else { pasta.clone() };
            for g in &grupo {
                feitos.insert(g.clone());
            }
            let destino = livre(pasta_do_jogo.join(arq.file_name().unwrap_or_default()));
            if simulacao {
                rel.organizados.push(Item { origem: arq.clone(), destino, plataforma: plat.id.into(), extraido: false });
                continue;
            }
            let mut ok = true;
            for g in &grupo {
                let d = if *g == arq { destino.clone() } else { livre(pasta_do_jogo.join(g.file_name().unwrap_or_default())) };
                if let Err(e) = mover_arquivo(g, &d) {
                    rel.falhas.push(e);
                    ok = false;
                    break;
                }
                reg.movimentos.push(Item { origem: g.clone(), destino: d, plataforma: plat.id.into(), extraido: false });
            }
            if ok {
                rel.organizados.push(Item { origem: arq, destino, plataforma: plat.id.into(), extraido: false });
            }
        }
    }
    (rel, reg)
}

/// Desfaz o que o organizador fez: devolve cada arquivo ao lugar de origem (zips descompactados não voltam; o jogo fica onde está).
pub fn desfazer(reg: &Registro) -> (usize, Vec<String>) {
    let mut n = 0;
    let mut falhas = Vec::new();
    for m in reg.movimentos.iter().rev().filter(|m| !m.extraido) {
        if m.origem.exists() {
            falhas.push(format!("{} já existe; deixei o jogo em {}.", m.origem.display(), m.destino.display()));
            continue;
        }
        match mover_arquivo(&m.destino, &m.origem) {
            Ok(()) => n += 1,
            Err(e) => falhas.push(e),
        }
    }
    (n, falhas)
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::io::Write;

    fn zip_com(caminho: &Path, itens: &[(&str, &str)]) {
        let mut w = zip::ZipWriter::new(fs::File::create(caminho).unwrap());
        for (n, c) in itens {
            w.start_file(*n, zip::write::SimpleFileOptions::default()).unwrap();
            w.write_all(c.as_bytes()).unwrap();
        }
        w.finish().unwrap();
    }

    #[test]
    fn organiza_solto_descompacta_e_agrupa_disco() {
        let t = tempfile::tempdir().unwrap();
        let dl = t.path().join("Downloads");
        fs::create_dir_all(dl.join("lixo")).unwrap();
        fs::write(dl.join("Super Mario World (USA).sfc"), "a").unwrap();
        zip_com(&dl.join("Contra.zip"), &[("Contra (USA).nes", "b")]);
        zip_com(&dl.join("foto.zip"), &[("ferias.jpg", "c")]);
        fs::write(dl.join("lixo/relatorio.pdf"), "d").unwrap();
        fs::create_dir_all(dl.join("psx")).unwrap();
        fs::write(dl.join("psx/Crash.cue"), "FILE \"Crash.bin\" BINARY\n  TRACK 01 MODE2/2352\n").unwrap();
        fs::write(dl.join("psx/Crash.bin"), "e").unwrap();
        let vortex = t.path().join("Vortex/Jogos");

        let (sim, reg_sim) = organizar(&[dl.clone()], &vortex, true);
        assert!(sim.simulacao && sim.organizados.len() == 3 && reg_sim.movimentos.is_empty());
        assert!(dl.join("Super Mario World (USA).sfc").exists(), "simulação não mexe em nada");

        let (r, reg) = organizar(&[dl.clone()], &vortex, false);
        assert_eq!(r.organizados.len(), 3, "{:?}", r.falhas);
        assert!(vortex.join("Super Nintendo/Super Mario World (USA).sfc").is_file());
        assert!(r.organizados.iter().any(|i| i.plataforma == "nes" && i.extraido && i.destino.is_file() && i.destino.ends_with("Contra (USA).nes")));
        assert!(!dl.join("Contra.zip").exists(), "zip já descompactado sai da pasta de origem");
        assert!(dl.join("foto.zip").exists() && dl.join("lixo/relatorio.pdf").exists(), "o que não é jogo fica quieto");
        let cue = r.organizados.iter().find(|i| i.plataforma == "ps1").expect("disco do PlayStation");
        assert!(cue.destino.is_file() && cue.destino.with_file_name("Crash.bin").is_file(), "cue e bin andam juntos");

        // rodar de novo não faz nada
        let (r2, _) = organizar(&[dl.clone(), vortex.clone()], &vortex, false);
        assert!(r2.organizados.is_empty());

        // desfazer devolve os arquivos soltos (o zip descompactado fica)
        let (n, f) = desfazer(&reg);
        assert!(f.is_empty(), "{f:?}");
        assert_eq!(n, 3);
        assert!(dl.join("Super Mario World (USA).sfc").is_file() && dl.join("psx/Crash.bin").is_file());
    }

    #[test]
    fn zip_com_varios_arquivos_ganha_subpasta_e_arcade_fica_fechado() {
        let t = tempfile::tempdir().unwrap();
        let o = t.path().join("origem");
        fs::create_dir_all(o.join("arcade")).unwrap();
        zip_com(&o.join("sf2.zip"), &[("a.nes", "1"), ("leia.txt", "2")]);
        zip_com(&o.join("arcade/sf2.zip"), &[("sf2.rom", "3")]);
        let v = t.path().join("V");
        let (r, _) = organizar(&[o.clone()], &v, false);
        assert_eq!(r.organizados.len(), 2, "{:?}", r.falhas);
        let arc = r.organizados.iter().find(|i| i.plataforma == "arcade").unwrap();
        assert!(!arc.extraido && arc.destino.is_file() && arc.destino.extension().unwrap() == "zip", "zip de arcade vai fechado para a pasta do console");
        let nes = r.organizados.iter().find(|i| i.plataforma == "nes").unwrap();
        assert!(nes.destino.ends_with("a.nes") && nes.destino.parent().unwrap().ends_with("sf2"), "zip com vários arquivos ganha subpasta");
    }

    #[test]
    fn zip_malicioso_nao_escapa_da_pasta() {
        let t = tempfile::tempdir().unwrap();
        let o = t.path().join("o");
        fs::create_dir_all(&o).unwrap();
        zip_com(&o.join("m.zip"), &[("../fora.nes", "x"), ("b.nes", "y")]);
        let v = t.path().join("V");
        organizar(&[o], &v, false);
        assert!(!t.path().join("fora.nes").exists());
    }

    #[test]
    fn candidatos_so_existentes() {
        let t = tempfile::tempdir().unwrap();
        fs::create_dir_all(t.path().join("Downloads")).unwrap();
        assert_eq!(candidatos(t.path(), false), vec![t.path().join("Downloads")]);
    }

    #[test]
    fn zerado_e_zip_quebrado_vao_para_corrompidos() {
        let t = tempfile::tempdir().unwrap();
        let o = t.path().join("origem");
        fs::create_dir_all(&o).unwrap();
        fs::write(o.join("Vazio (USA).nes"), "").unwrap();
        fs::write(o.join("quebrado.zip"), "isso nao e um zip").unwrap();
        let vortex = t.path().join("Vortex/Jogos");
        let (r, _) = organizar(&[o.clone()], &vortex, false);
        assert_eq!(r.descartados.len(), 2, "{:?}", r.descartados);
        assert!(vortex.join("Corrompidos/Vazio (USA).nes").is_file() && vortex.join("Corrompidos/quebrado.zip").is_file());
        assert!(!o.join("Vazio (USA).nes").exists());
    }
}
