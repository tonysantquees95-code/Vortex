//! Motor embutido: o Vortex baixa sozinho o RetroArch portátil e o núcleo do console (do repositório oficial da Libretro), só na primeira vez.
//! A pessoa nunca instala emulador: tudo fica na pasta de dados do Vortex.
use crate::plataformas::Plataforma;
use std::fs;
use std::path::{Path, PathBuf};

const BASE: &str = "https://buildbot.libretro.com/nightly/windows/x86_64";

pub type Baixar<'a> = &'a dyn Fn(&str, &Path) -> Result<(), String>;

pub fn pasta_do_motor(dados: &Path) -> PathBuf {
    dados.join("retroarch")
}

pub fn exe_do_motor(dados: &Path) -> PathBuf {
    pasta_do_motor(dados).join("retroarch.exe")
}

pub fn url_do_retroarch() -> String {
    format!("{BASE}/RetroArch.7z")
}

pub fn url_do_nucleo(nucleo: &str) -> String {
    format!("{BASE}/latest/{nucleo}.dll.zip")
}

/// O melhor núcleo do console: o primeiro da lista do catálogo (ordenada do mais preciso/rápido para o reserva).
pub fn melhor_nucleo(pl: &Plataforma) -> Option<&'static str> {
    pl.nucleos.first().copied()
}

#[derive(Debug, PartialEq)]
pub struct Preparo {
    pub nucleo: String,
    /// true quando precisou baixar algo agora
    pub baixou: bool,
}

fn extrair_zip(zipado: &Path, destino: &Path) -> Result<(), String> {
    let f = fs::File::open(zipado).map_err(|e| e.to_string())?;
    let mut z = zip::ZipArchive::new(f).map_err(|e| format!("Pacote do núcleo inválido: {e}"))?;
    fs::create_dir_all(destino).map_err(|e| e.to_string())?;
    for i in 0..z.len() {
        let mut e = z.by_index(i).map_err(|e| e.to_string())?;
        let Some(rel) = e.enclosed_name() else { continue };
        if e.is_dir() {
            continue;
        }
        let alvo = destino.join(rel.file_name().unwrap_or_default());
        let mut s = fs::File::create(&alvo).map_err(|e| e.to_string())?;
        std::io::copy(&mut e, &mut s).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Garante RetroArch + núcleo do console na pasta de dados. `baixar(url, arquivo)` faz o download (nos testes é falso).
pub fn preparar(dados: &Path, pl: &Plataforma, baixar: Baixar) -> Result<Preparo, String> {
    let nucleo = melhor_nucleo(pl).ok_or_else(|| format!("{} ainda não tem motor embutido no Vortex.", pl.nome))?;
    let motor = pasta_do_motor(dados);
    let tmp = dados.join("baixando");
    fs::create_dir_all(&tmp).map_err(|e| format!("Não consegui criar a pasta de dados: {e}"))?;
    let mut baixou = false;
    if !exe_do_motor(dados).is_file() {
        let arq = tmp.join("RetroArch.7z");
        baixar(&url_do_retroarch(), &arq).map_err(|e| format!("Não consegui baixar o motor do Vortex: {e}"))?;
        fs::create_dir_all(&motor).map_err(|e| e.to_string())?;
        sevenz_rust::decompress_file(&arq, &motor).map_err(|e| format!("Não consegui abrir o motor baixado: {e}"))?;
        let _ = fs::remove_file(&arq);
        // o pacote traz tudo dentro de uma pasta "RetroArch-Win64": sobe um nível se for o caso
        if !exe_do_motor(dados).is_file() {
            if let Some(sub) = fs::read_dir(&motor).map_err(|e| e.to_string())?.flatten().map(|e| e.path()).find(|p| p.join("retroarch.exe").is_file()) {
                for e in fs::read_dir(&sub).map_err(|e| e.to_string())?.flatten() {
                    let _ = fs::rename(e.path(), motor.join(e.file_name()));
                }
            }
        }
        if !exe_do_motor(dados).is_file() {
            return Err("O motor baixado veio incompleto. Tente de novo.".into());
        }
        baixou = true;
    }
    let dll = motor.join("cores").join(format!("{nucleo}.dll"));
    if !dll.is_file() {
        let arq = tmp.join(format!("{nucleo}.dll.zip"));
        baixar(&url_do_nucleo(nucleo), &arq).map_err(|e| format!("Não consegui baixar o núcleo de {}: {e}", pl.nome))?;
        extrair_zip(&arq, &motor.join("cores"))?;
        let _ = fs::remove_file(&arq);
        if !dll.is_file() {
            return Err(format!("O núcleo de {} veio incompleto. Tente de novo.", pl.nome));
        }
        baixou = true;
    }
    Ok(Preparo { nucleo: nucleo.to_string(), baixou })
}

/// Download de verdade (HTTPS), gravando em arquivo. Só aceita o repositório oficial da Libretro.
pub fn baixar_da_libretro(url: &str, destino: &Path) -> Result<(), String> {
    if !url.starts_with("https://buildbot.libretro.com/") {
        return Err("Endereço não permitido.".into());
    }
    let r = ureq::get(url).timeout(std::time::Duration::from_secs(600)).call().map_err(|e| e.to_string())?;
    let mut leitor = r.into_reader();
    let mut f = fs::File::create(destino).map_err(|e| e.to_string())?;
    std::io::copy(&mut leitor, &mut f).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::plataformas;
    use std::cell::RefCell;
    use std::io::Write;

    #[test]
    fn urls_e_melhor_nucleo() {
        assert_eq!(url_do_nucleo("snes9x_libretro"), "https://buildbot.libretro.com/nightly/windows/x86_64/latest/snes9x_libretro.dll.zip");
        assert!(url_do_retroarch().ends_with("/RetroArch.7z"));
        let snes = plataformas::por_id("snes").unwrap();
        assert_eq!(melhor_nucleo(snes), Some("snes9x_libretro"));
        assert!(plataformas::por_id("switch").map(melhor_nucleo).unwrap().is_none());
        assert!(baixar_da_libretro("https://exemplo.com/x", Path::new("/tmp/x")).is_err());
    }

    #[test]
    fn baixa_so_o_que_falta() {
        let t = tempfile::tempdir().unwrap();
        let pedidos: RefCell<Vec<String>> = RefCell::new(vec![]);
        let falso = |url: &str, dest: &Path| -> Result<(), String> {
            pedidos.borrow_mut().push(url.to_string());
            if url.ends_with(".7z") {
                let orig = tempfile::tempdir().unwrap();
                fs::create_dir_all(orig.path().join("RetroArch-Win64")).unwrap();
                fs::write(orig.path().join("RetroArch-Win64/retroarch.exe"), "exe").unwrap();
                sevenz_rust::compress_to_path(orig.path(), dest).map_err(|e| e.to_string())?;
            } else {
                let mut w = zip::ZipWriter::new(fs::File::create(dest).unwrap());
                w.start_file("snes9x_libretro.dll", zip::write::SimpleFileOptions::default()).unwrap();
                w.write_all(b"dll").unwrap();
                w.finish().unwrap();
            }
            Ok(())
        };
        let snes = plataformas::por_id("snes").unwrap();
        let r = preparar(t.path(), snes, &falso).unwrap();
        assert_eq!(r, Preparo { nucleo: "snes9x_libretro".into(), baixou: true });
        assert!(exe_do_motor(t.path()).is_file(), "motor sobe da subpasta");
        assert!(pasta_do_motor(t.path()).join("cores/snes9x_libretro.dll").is_file());
        assert_eq!(pedidos.borrow().len(), 2);
        // segunda vez: nada para baixar
        let r2 = preparar(t.path(), snes, &falso).unwrap();
        assert!(!r2.baixou && pedidos.borrow().len() == 2);
        // console sem motor embutido
        assert!(preparar(t.path(), plataformas::por_id("switch").unwrap(), &falso).is_err());
    }

    #[test]
    fn falha_de_rede_vira_mensagem_clara() {
        let t = tempfile::tempdir().unwrap();
        let sem_rede = |_: &str, _: &Path| -> Result<(), String> { Err("sem conexão".into()) };
        let e = preparar(t.path(), plataformas::por_id("nes").unwrap(), &sem_rede).unwrap_err();
        assert!(e.contains("Não consegui baixar o motor") && e.contains("sem conexão"));
    }
}
