//! Instalador de emuladores próprios: para os consoles em que o emulador de verdade é melhor que o núcleo do RetroArch (PS2, PS3, PSP…),
//! o Vortex baixa sozinho a versão oficial mais nova do GitHub do projeto e guarda na pasta de dados dele. O arquivo certo é achado
//! na lista de arquivos da versão (por nome), conferido pelo SHA-256 que o GitHub informa e extraído sem sair da pasta do emulador.
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// De onde baixar um emulador do catálogo (`emuladores::EMULADORES`).
pub struct Fonte {
    /// id no catálogo de emuladores
    pub catalogo: &'static str,
    pub repo: &'static str,
    /// o nome do arquivo precisa conter todos estes pedaços (minúsculos)
    pub contem: &'static [&'static str],
    /// e nenhum destes
    pub nao_contem: &'static [&'static str],
    pub extensoes: &'static [&'static str],
    /// consoles em que este emulador é o preferido
    pub consoles: &'static [&'static str],
}

pub const FONTES: &[Fonte] = &[
    Fonte { catalogo: "pcsx2", repo: "PCSX2/pcsx2", contem: &["windows"], nao_contem: &["arm", "symbols", "debug", "wine"], extensoes: &["7z", "zip"], consoles: &["ps2"] },
    Fonte { catalogo: "duckstation", repo: "stenzek/duckstation", contem: &["windows", "x64"], nao_contem: &["arm", "symbols", "debug"], extensoes: &["zip", "7z"], consoles: &["ps1"] },
    Fonte { catalogo: "ppsspp", repo: "hrydgard/ppsspp", contem: &["windows", "x64"], nao_contem: &["arm", "uwp", "symbols"], extensoes: &["zip", "7z"], consoles: &["psp"] },
    Fonte { catalogo: "melonds", repo: "melonDS-emu/melonDS", contem: &["win", "x64"], nao_contem: &["arm", "symbols"], extensoes: &["zip", "7z"], consoles: &["nds"] },
    Fonte { catalogo: "flycast", repo: "flyinghead/flycast", contem: &["windows", "x86_64"], nao_contem: &["arm", "symbols", "debug"], extensoes: &["zip", "7z"], consoles: &["dreamcast"] },
    Fonte { catalogo: "lime3ds", repo: "azahar-emu/azahar", contem: &["windows"], nao_contem: &["arm", "symbols", "installer"], extensoes: &["zip", "7z"], consoles: &["3ds"] },
    Fonte { catalogo: "rpcs3", repo: "RPCS3/rpcs3-binaries-win", contem: &["win64"], nao_contem: &["arm", "symbols"], extensoes: &["7z", "zip"], consoles: &["ps3"] },
];

pub fn fonte_para(console: &str) -> Option<&'static Fonte> {
    FONTES.iter().find(|f| f.consoles.contains(&console))
}

#[derive(Debug, Clone, PartialEq)]
pub struct Arquivo {
    pub nome: String,
    pub url: String,
    pub bytes: u64,
    /// "sha256:…" quando o GitHub informa
    pub digest: Option<String>,
}

pub fn arquivos_da_versao(json: &Value) -> Vec<Arquivo> {
    json.get("assets")
        .and_then(|a| a.as_array())
        .into_iter()
        .flatten()
        .filter_map(|a| {
            Some(Arquivo {
                nome: a.get("name")?.as_str()?.to_string(),
                url: a.get("browser_download_url")?.as_str()?.to_string(),
                bytes: a.get("size").and_then(|x| x.as_u64()).unwrap_or(0),
                digest: a.get("digest").and_then(|x| x.as_str()).map(String::from),
            })
        })
        .collect()
}

/// O arquivo que serve: contém tudo de `contem`, nada de `nao_contem`, extensão certa; entre vários, o de nome mais curto (o "padrão").
pub fn escolher<'a>(f: &Fonte, arquivos: &'a [Arquivo]) -> Option<&'a Arquivo> {
    let mut v: Vec<&Arquivo> = arquivos
        .iter()
        .filter(|a| {
            let n = a.nome.to_lowercase();
            f.contem.iter().all(|c| n.contains(c)) && !f.nao_contem.iter().any(|c| n.contains(c)) && f.extensoes.iter().any(|e| n.ends_with(&format!(".{e}")))
        })
        .collect();
    v.sort_by_key(|a| a.nome.len());
    v.first().copied()
}

pub fn pasta_do_emulador(dados: &Path, catalogo: &str) -> PathBuf {
    dados.join("emuladores").join(catalogo)
}

fn sha256_arquivo(p: &Path) -> Result<String, String> {
    let mut f = fs::File::open(p).map_err(|e| e.to_string())?;
    let mut h = Sha256::new();
    std::io::copy(&mut f, &mut h).map_err(|e| e.to_string())?;
    Ok(h.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

fn extrair_zip_inteiro(zipado: &Path, destino: &Path) -> Result<(), String> {
    let f = fs::File::open(zipado).map_err(|e| e.to_string())?;
    let mut z = zip::ZipArchive::new(f).map_err(|e| format!("Pacote do emulador inválido: {e}"))?;
    for i in 0..z.len() {
        let mut e = z.by_index(i).map_err(|e| e.to_string())?;
        let Some(rel) = e.enclosed_name() else { continue }; // nome que sai da pasta é ignorado
        let alvo = destino.join(rel);
        if e.is_dir() {
            fs::create_dir_all(&alvo).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(p) = alvo.parent() {
            fs::create_dir_all(p).map_err(|e| e.to_string())?;
        }
        let mut s = fs::File::create(&alvo).map_err(|e| e.to_string())?;
        std::io::copy(&mut e, &mut s).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Acha o programa dentro da pasta instalada (até 3 níveis).
pub fn achar_programa(pasta: &Path, exes: &[&str]) -> Option<PathBuf> {
    WalkDir::new(pasta).max_depth(3).into_iter().filter_map(Result::ok).filter(|e| e.file_type().is_file()).find(|e| {
        let n = e.file_name().to_string_lossy().to_lowercase();
        exes.iter().any(|x| x.to_lowercase() == n)
    }).map(|e| e.path().to_path_buf())
}

/// Baixa e instala. `api(url)` devolve o JSON da versão mais nova; `baixar(url, arquivo)` faz o download (nos testes são falsos).
pub fn instalar(dados: &Path, f: &Fonte, exes: &[&str], api: &dyn Fn(&str) -> Result<Value, String>, baixar: &dyn Fn(&str, &Path) -> Result<(), String>) -> Result<PathBuf, String> {
    let versao = api(&format!("https://api.github.com/repos/{}/releases/latest", f.repo)).map_err(|e| format!("Não consegui consultar a versão mais nova: {e}"))?;
    let arquivos = arquivos_da_versao(&versao);
    let a = escolher(f, &arquivos).ok_or_else(|| format!("Não achei o arquivo para Windows na versão mais nova de {}. Instale o emulador à mão e o Vortex o encontra.", f.catalogo))?;
    if !a.url.starts_with("https://github.com/") {
        return Err("Endereço de download não permitido.".into());
    }
    let tmp = dados.join("baixando");
    fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;
    let arq = tmp.join(&a.nome);
    baixar(&a.url, &arq).map_err(|e| format!("Não consegui baixar {}: {e}", f.catalogo))?;
    if let Some(esperado) = a.digest.as_deref().and_then(|d| d.strip_prefix("sha256:")) {
        if !sha256_arquivo(&arq)?.eq_ignore_ascii_case(esperado) {
            let _ = fs::remove_file(&arq);
            return Err("O arquivo baixado não confere com o SHA-256 do GitHub. Tente de novo.".into());
        }
    }
    let pasta = pasta_do_emulador(dados, f.catalogo);
    let _ = fs::remove_dir_all(&pasta);
    fs::create_dir_all(&pasta).map_err(|e| e.to_string())?;
    if a.nome.to_lowercase().ends_with(".7z") {
        sevenz_rust::decompress_file(&arq, &pasta).map_err(|e| format!("Não consegui abrir o emulador baixado: {e}"))?;
    } else {
        extrair_zip_inteiro(&arq, &pasta)?;
    }
    let _ = fs::remove_file(&arq);
    achar_programa(&pasta, exes).ok_or_else(|| "O emulador baixado veio incompleto. Tente de novo.".to_string())?;
    Ok(pasta)
}

/// Consulta à API do GitHub (só api.github.com).
pub fn api_github(url: &str) -> Result<Value, String> {
    if !url.starts_with("https://api.github.com/repos/") {
        return Err("Endereço não permitido.".into());
    }
    let r = ureq::get(url).set("user-agent", "Vortex").set("accept", "application/vnd.github+json").timeout(std::time::Duration::from_secs(30)).call().map_err(|e| e.to_string())?;
    let mut t = String::new();
    std::io::Read::read_to_string(&mut std::io::Read::take(r.into_reader(), 4 * 1024 * 1024), &mut t).map_err(|e| e.to_string())?;
    serde_json::from_str(&t).map_err(|e| e.to_string())
}

/// Download de um arquivo de versão do GitHub (o endereço de download redireciona para o armazenamento do GitHub).
pub fn baixar_do_github(url: &str, destino: &Path) -> Result<(), String> {
    if !url.starts_with("https://github.com/") {
        return Err("Endereço não permitido.".into());
    }
    let r = ureq::get(url).set("user-agent", "Vortex").timeout(std::time::Duration::from_secs(900)).call().map_err(|e| e.to_string())?;
    let mut f = fs::File::create(destino).map_err(|e| e.to_string())?;
    std::io::copy(&mut r.into_reader(), &mut f).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, serde::Serialize, PartialEq)]
pub struct LinhaCentral {
    pub id: String,
    pub nome: String,
    pub jogos: usize,
    /// "pronto" (já dá para jogar), "baixa" (o Vortex baixa na primeira vez) ou "instalar" (precisa de um emulador instalado pela pessoa)
    pub estado: String,
    pub emulador: String,
    pub aviso: Option<String>,
}

fn aviso_do_console(id: &str) -> Option<&'static str> {
    match id {
        "ps1" => Some("Alguns jogos pedem a BIOS do PlayStation (arquivos SCPH) na pasta system do RetroArch."),
        "ps2" => Some("O PCSX2 precisa da BIOS do seu próprio PS2."),
        "ps3" => Some("O RPCS3 precisa do firmware oficial do PS3, que se baixa no site da Sony."),
        "saturn" | "segacd" | "dreamcast" => Some("Pode pedir BIOS do console na pasta system do RetroArch."),
        "switch" => Some("Precisa de chaves e firmware do seu próprio Switch."),
        _ => None,
    }
}

/// O que cada console da biblioteca vai usar e se já está pronto. `consoles`: (id, jogos).
pub fn central(instalados: &[crate::emuladores::Instalado], dados: &Path, consoles: &[(String, usize)]) -> Vec<LinhaCentral> {
    use crate::emuladores::Modelo;
    use crate::plataformas::{por_id, Tipo};
    let mut v = Vec::new();
    for (id, jogos) in consoles {
        let Some(p) = por_id(id) else { continue };
        if matches!(p.tipo, Tipo::Pc | Tipo::Android) {
            continue;
        }
        let proprio = instalados.iter().find(|i| i.modelo == Modelo::Proprio && i.plataformas.iter().any(|x| x == id));
        let nucleo = p.nucleos.first().copied();
        let nucleo_pronto = nucleo.is_some_and(|n| dados.join("retroarch").join("cores").join(format!("{n}.dll")).is_file() || instalados.iter().any(|i| i.nucleos.iter().any(|x| x == n)));
        let (estado, emulador) = if let Some(i) = proprio {
            ("pronto", i.nome.clone())
        } else if let Some(f) = fonte_para(id) {
            ("baixa", f.catalogo.to_string())
        } else if nucleo_pronto {
            ("pronto", format!("RetroArch ({})", nucleo.unwrap_or("")))
        } else if let Some(n) = nucleo {
            ("baixa", format!("RetroArch ({n})"))
        } else {
            ("instalar", String::new())
        };
        v.push(LinhaCentral { id: id.clone(), nome: p.nome.to_string(), jogos: *jogos, estado: estado.into(), emulador, aviso: aviso_do_console(id).map(String::from) });
    }
    v
}

#[cfg(test)]
mod testes {
    use super::*;
    use serde_json::json;
    use std::io::Write;

    fn versao() -> Value {
        json!({"assets": [
            {"name": "pcsx2-v2.4.0-windows-arm64-Qt.7z", "browser_download_url": "https://github.com/x/a", "size": 1},
            {"name": "pcsx2-v2.4.0-windows-x64-Qt.7z", "browser_download_url": "https://github.com/x/b", "size": 2},
            {"name": "pcsx2-v2.4.0-windows-x64-Qt-symbols.7z", "browser_download_url": "https://github.com/x/c", "size": 3},
            {"name": "pcsx2-v2.4.0-linux-AppImage-x64-Qt.AppImage", "browser_download_url": "https://github.com/x/d", "size": 4}
        ]})
    }

    #[test]
    fn escolhe_o_arquivo_certo() {
        let a = arquivos_da_versao(&versao());
        let f = fonte_para("ps2").unwrap();
        assert_eq!(escolher(f, &a).unwrap().url, "https://github.com/x/b");
        assert!(fonte_para("switch").is_none());
        assert!(escolher(f, &[]).is_none());
    }

    fn zip_falso(dest: &Path, interno: &str) {
        let mut w = zip::ZipWriter::new(fs::File::create(dest).unwrap());
        w.start_file(interno, zip::write::SimpleFileOptions::default()).unwrap();
        w.write_all(b"exe").unwrap();
        w.finish().unwrap();
    }

    #[test]
    fn instala_confere_hash_e_acha_o_programa() {
        let t = tempfile::tempdir().unwrap();
        let f = fonte_para("psp").unwrap();
        let api = |_: &str| -> Result<Value, String> {
            Ok(json!({"assets": [{"name": "PPSSPP-v1.20-Windows-x64.zip", "browser_download_url": "https://github.com/h/p.zip", "size": 1}]}))
        };
        let baixar = |_: &str, d: &Path| -> Result<(), String> { zip_falso(d, "PPSSPP/PPSSPPWindows64.exe"); Ok(()) };
        let pasta = instalar(t.path(), f, &["PPSSPPWindows64.exe"], &api, &baixar).unwrap();
        assert!(achar_programa(&pasta, &["PPSSPPWindows64.exe"]).is_some());
        // hash errado é recusado
        let api_ruim = |_: &str| -> Result<Value, String> {
            Ok(json!({"assets": [{"name": "PPSSPP-v1.20-Windows-x64.zip", "browser_download_url": "https://github.com/h/p.zip", "size": 1, "digest": "sha256:00"}]}))
        };
        let e = instalar(t.path(), f, &["PPSSPPWindows64.exe"], &api_ruim, &baixar).unwrap_err();
        assert!(e.contains("SHA-256"));
        // endereço de fora do GitHub é recusado
        let api_fora = |_: &str| -> Result<Value, String> { Ok(json!({"assets": [{"name": "PPSSPP-Windows-x64.zip", "browser_download_url": "https://exemplo.com/p.zip", "size": 1}]})) };
        assert!(instalar(t.path(), f, &["x.exe"], &api_fora, &baixar).is_err());
        assert!(api_github("https://exemplo.com/x").is_err() && baixar_do_github("https://exemplo.com/x", Path::new("/tmp/x")).is_err());
    }

    #[test]
    fn pacote_que_foge_da_pasta_nao_escapa() {
        let t = tempfile::tempdir().unwrap();
        let z = t.path().join("m.zip");
        zip_falso(&z, "../fora.txt");
        let destino = t.path().join("dentro");
        fs::create_dir_all(&destino).unwrap();
        extrair_zip_inteiro(&z, &destino).unwrap();
        assert!(!t.path().join("fora.txt").exists());
    }

    #[test]
    fn central_diz_o_que_cada_console_usa() {
        let t = tempfile::tempdir().unwrap();
        let c = central(&[], t.path(), &[("snes".into(), 3), ("ps2".into(), 1), ("switch".into(), 2), ("windows".into(), 9)]);
        let e = |id: &str| c.iter().find(|l| l.id == id).map(|l| l.estado.clone());
        assert_eq!(e("snes").as_deref(), Some("baixa"));
        assert_eq!(e("ps2").as_deref(), Some("baixa"));
        assert_eq!(e("switch").as_deref(), Some("instalar"));
        assert!(c.iter().find(|l| l.id == "ps2").unwrap().aviso.is_some());
    }
}
