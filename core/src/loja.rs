//! Loja do Vortex: catálogo de jogos que podem ser baixados legalmente (homebrew e jogos gratuitos liberados pelos autores).
//! Baixa em segundo plano, confere a assinatura (SHA-256), descompacta e guarda na pasta do console.
use crate::organizador::{self, Item};
use crate::plataformas;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

const CATALOGO: &str = include_str!("../../catalogo/catalogo.json");
/// Só baixa de endereços do catálogo, e só destes servidores.
const HOSPEDEIROS: &[&str] = &["raw.githubusercontent.com"];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Oferta {
    pub id: String,
    pub titulo: String,
    pub plataforma: String,
    pub autor: String,
    pub descricao: String,
    pub licenca: String,
    #[serde(default)]
    pub site: String,
    pub url: String,
    pub sha256: String,
    pub bytes: u64,
}

#[derive(Debug, Deserialize)]
struct Arquivo {
    jogos: Vec<Oferta>,
}

pub fn catalogo() -> Vec<Oferta> {
    serde_json::from_str::<Arquivo>(CATALOGO).map(|a| a.jogos).unwrap_or_default()
}

pub fn hospedeiro_permitido(url: &str) -> bool {
    url.strip_prefix("https://").and_then(|r| r.split('/').next()).is_some_and(|h| HOSPEDEIROS.contains(&h))
}

pub fn sha256_arquivo(p: &Path) -> Result<String, String> {
    let mut f = fs::File::open(p).map_err(|e| e.to_string())?;
    let mut h = Sha256::new();
    std::io::copy(&mut f, &mut h).map_err(|e| e.to_string())?;
    Ok(h.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

pub type Baixar<'a> = &'a dyn Fn(&str, &Path) -> Result<(), String>;

pub fn baixar_https(url: &str, destino: &Path) -> Result<(), String> {
    if !hospedeiro_permitido(url) {
        return Err("Endereço de download não permitido.".into());
    }
    let r = ureq::get(url).timeout(std::time::Duration::from_secs(600)).call().map_err(|e| format!("Sem conexão com o servidor do jogo ({e})."))?;
    let mut f = fs::File::create(destino).map_err(|e| e.to_string())?;
    std::io::copy(&mut r.into_reader(), &mut f).map_err(|e| e.to_string())?;
    Ok(())
}

/// Baixa, confere, descompacta e guarda o jogo em `pasta_vortex/<Console>/`. Devolve onde foi parar.
pub fn instalar(o: &Oferta, dados: &Path, pasta_vortex: &Path, baixar: Baixar) -> Result<Vec<Item>, String> {
    if !hospedeiro_permitido(&o.url) {
        return Err("Endereço de download não permitido.".into());
    }
    if plataformas::por_id(&o.plataforma).is_none() {
        return Err("Console desconhecido.".into());
    }
    let tmp: PathBuf = dados.join("loja").join(&o.id);
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp).map_err(|e| format!("Não consegui criar a pasta de downloads: {e}"))?;
    let resultado = (|| {
        let zip = tmp.join(format!("{}.zip", o.id));
        baixar(&o.url, &zip)?;
        if sha256_arquivo(&zip)? != o.sha256.to_lowercase() {
            return Err("O arquivo baixado não confere com o catálogo (pode estar corrompido). Tente de novo mais tarde.".to_string());
        }
        let (rel, reg) = organizador::organizar(&[tmp.clone()], pasta_vortex, false);
        if !rel.falhas.is_empty() {
            return Err(rel.falhas.join("; "));
        }
        if reg.movimentos.is_empty() {
            return Err("Não consegui identificar o jogo dentro do arquivo baixado.".into());
        }
        Ok(rel.organizados)
    })();
    let _ = fs::remove_dir_all(&tmp);
    resultado
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::io::Write;

    fn zip_nes(dest: &Path, conteudo: &[u8]) {
        let mut w = zip::ZipWriter::new(fs::File::create(dest).unwrap());
        w.start_file("Jogo.nes", zip::write::SimpleFileOptions::default()).unwrap();
        w.write_all(conteudo).unwrap();
        w.finish().unwrap();
    }

    #[test]
    fn catalogo_e_valido() {
        let c = catalogo();
        assert!(c.len() >= 15, "catálogo vazio ou ilegível");
        let mut ids: Vec<&str> = c.iter().map(|o| o.id.as_str()).collect();
        ids.sort();
        let n = ids.len();
        ids.dedup();
        assert_eq!(ids.len(), n, "ids repetidos");
        for o in &c {
            assert!(hospedeiro_permitido(&o.url), "{}: servidor não permitido", o.id);
            assert!(plataformas::por_id(&o.plataforma).is_some(), "{}: console inválido", o.id);
            assert!(o.sha256.len() == 64 && o.sha256.chars().all(|c| c.is_ascii_hexdigit()), "{}: sha256 inválido", o.id);
            assert!(!o.licenca.is_empty() && !o.autor.is_empty() && o.bytes > 0, "{}: faltam dados", o.id);
        }
    }

    #[test]
    fn so_baixa_de_servidor_permitido() {
        assert!(hospedeiro_permitido("https://raw.githubusercontent.com/x/y/z/a.zip"));
        assert!(!hospedeiro_permitido("http://raw.githubusercontent.com/x"));
        assert!(!hospedeiro_permitido("https://romsgames.net/x"));
        assert!(!hospedeiro_permitido("https://raw.githubusercontent.com.evil.com/x"));
        assert!(baixar_https("https://exemplo.com/x", Path::new("/tmp/x")).is_err());
    }

    #[test]
    fn instala_confere_assinatura_e_organiza() {
        let t = tempfile::tempdir().unwrap();
        let origem = t.path().join("servidor.zip");
        zip_nes(&origem, b"NES\x1a conteudo");
        let sha = sha256_arquivo(&origem).unwrap();
        let mut o = Oferta { id: "teste".into(), titulo: "Teste".into(), plataforma: "nes".into(), autor: "A".into(), descricao: "d".into(), licenca: "l".into(), site: String::new(), url: "https://raw.githubusercontent.com/x/y/z/Jogo.zip".into(), sha256: sha, bytes: 1 };
        let copia = |_: &str, dest: &Path| fs::copy(&origem, dest).map(|_| ()).map_err(|e| e.to_string());
        let dados = t.path().join("dados");
        let vortex = t.path().join("Vortex/Jogos");
        let itens = instalar(&o, &dados, &vortex, &copia).unwrap();
        assert_eq!(itens.len(), 1);
        assert!(itens[0].destino.is_file() && itens[0].destino.starts_with(&vortex) && itens[0].plataforma == "nes");
        assert!(!dados.join("loja/teste").exists(), "limpa a pasta de download");
        // assinatura errada: recusa e não deixa nada
        o.sha256 = "0".repeat(64);
        let vortex2 = t.path().join("V2");
        let e = instalar(&o, &dados, &vortex2, &copia).unwrap_err();
        assert!(e.contains("não confere") && !vortex2.exists());
        // falha de rede
        let sem = |_: &str, _: &Path| -> Result<(), String> { Err("sem conexão".into()) };
        assert!(instalar(&o, &dados, &vortex2, &sem).is_err());
    }
}
