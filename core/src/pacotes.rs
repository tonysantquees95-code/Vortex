//! Pacotes de jogos que não são ZIP "limpo": 7z, RAR e arquivos com a extensão trocada (um .rar renomeado para .zip).
//! O ZIP continua sendo lido direto pelo organizador; aqui ficam listar e descompactar os outros formatos.
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tipo {
    Zip,
    SevenZ,
    Rar,
}

/// O que o arquivo realmente é, pelos primeiros bytes (a extensão pode estar errada).
pub fn tipo_pelo_conteudo(caminho: &Path) -> Option<Tipo> {
    let mut b = [0u8; 8];
    let n = fs::File::open(caminho).ok()?.read(&mut b).ok()?;
    let b = &b[..n];
    if b.starts_with(b"PK\x03\x04") || b.starts_with(b"PK\x05\x06") {
        Some(Tipo::Zip)
    } else if b.starts_with(&[0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]) {
        Some(Tipo::SevenZ)
    } else if b.starts_with(b"Rar!\x1A\x07") {
        Some(Tipo::Rar)
    } else {
        None
    }
}

/// Nome de arquivo → caminho relativo seguro (sem "..", sem raiz). None se tentar sair da pasta.
fn seguro(nome: &str) -> Option<PathBuf> {
    let p = PathBuf::from(nome.replace('\\', "/"));
    let mut saida = PathBuf::new();
    for c in p.components() {
        match c {
            Component::Normal(x) => saida.push(x),
            Component::CurDir => {}
            _ => return None,
        }
    }
    if saida.as_os_str().is_empty() {
        None
    } else {
        Some(saida)
    }
}

/// Nomes dos arquivos (não das pastas) de um 7z ou RAR, até `max`. Vazio se não der para ler.
pub fn nomes(caminho: &Path, tipo: Tipo, max: usize) -> Vec<String> {
    match tipo {
        Tipo::SevenZ => match sevenz_rust::Archive::open(caminho) {
            Ok(ar) => ar.files.iter().filter(|e| !e.is_directory).map(|e| e.name().to_string()).take(max).collect(),
            Err(_) => Vec::new(),
        },
        Tipo::Rar => {
            let p = caminho.to_path_buf();
            let Ok(it) = unrar::Archive::new(&p).open_for_listing() else { return Vec::new() };
            it.flatten().filter(|e| !e.is_directory()).map(|e| e.filename.to_string_lossy().to_string()).take(max).collect()
        }
        Tipo::Zip => Vec::new(),
    }
}

/// Descompacta tudo em `destino` (criada se faltar) e devolve os arquivos criados. Caminhos inseguros são ignorados.
pub fn extrair_tudo(caminho: &Path, tipo: Tipo, destino: &Path) -> Result<Vec<PathBuf>, String> {
    fs::create_dir_all(destino).map_err(|e| e.to_string())?;
    let mut feitos: Vec<PathBuf> = Vec::new();
    match tipo {
        Tipo::SevenZ => {
            let mut sz = sevenz_rust::SevenZReader::open(caminho, sevenz_rust::Password::empty()).map_err(|e| format!("7z inválido: {e}"))?;
            sz.for_each_entries(|ent, leitor| {
                let nome = ent.name().to_string();
                let Some(rel) = seguro(&nome) else {
                    std::io::copy(leitor, &mut std::io::sink()).map_err(sevenz_rust::Error::io)?;
                    return Ok(true);
                };
                let alvo = destino.join(&rel);
                if ent.is_directory {
                    fs::create_dir_all(&alvo).map_err(sevenz_rust::Error::io)?;
                    return Ok(true);
                }
                if let Some(p) = alvo.parent() {
                    fs::create_dir_all(p).map_err(sevenz_rust::Error::io)?;
                }
                let mut s = fs::File::create(&alvo).map_err(sevenz_rust::Error::io)?;
                std::io::copy(leitor, &mut s).map_err(sevenz_rust::Error::io)?;
                feitos.push(alvo);
                Ok(true)
            })
            .map_err(|e| format!("Não consegui descompactar o 7z: {e}"))?;
        }
        Tipo::Rar => {
            let p = caminho.to_path_buf();
            let mut arq = unrar::Archive::new(&p).open_for_processing().map_err(|e| format!("RAR inválido: {e}"))?;
            while let Some(h) = arq.read_header().map_err(|e| format!("Não consegui ler o RAR: {e}"))? {
                let (nome, pasta) = {
                    let e = h.entry();
                    (e.filename.to_string_lossy().to_string(), e.is_directory())
                };
                let rel = if pasta { None } else { seguro(&nome) };
                arq = match rel {
                    Some(rel) => {
                        let alvo = destino.join(&rel);
                        if let Some(p) = alvo.parent() {
                            fs::create_dir_all(p).map_err(|e| e.to_string())?;
                        }
                        let proximo = h.extract_to(&alvo).map_err(|e| format!("Não consegui descompactar o RAR: {e}"))?;
                        feitos.push(alvo);
                        proximo
                    }
                    None => h.skip().map_err(|e| e.to_string())?,
                };
            }
        }
        Tipo::Zip => return Err("ZIP é descompactado pelo organizador.".into()),
    }
    Ok(feitos)
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn reconhece_pelo_conteudo_mesmo_com_extensao_trocada() {
        let t = tempfile::tempdir().unwrap();
        let f = t.path().join("jogo.zip");
        fs::write(&f, b"Rar!\x1A\x07\x01\x00resto").unwrap();
        assert_eq!(tipo_pelo_conteudo(&f), Some(Tipo::Rar));
        fs::write(&f, [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C, 0, 4]).unwrap();
        assert_eq!(tipo_pelo_conteudo(&f), Some(Tipo::SevenZ));
        fs::write(&f, b"PK\x03\x04resto").unwrap();
        assert_eq!(tipo_pelo_conteudo(&f), Some(Tipo::Zip));
        fs::write(&f, b"isso nao e pacote").unwrap();
        assert_eq!(tipo_pelo_conteudo(&f), None);
    }

    #[test]
    fn caminho_seguro_recusa_subir_pastas() {
        assert!(seguro("../fora.iso").is_none());
        assert!(seguro("/abs/jogo.iso").is_none());
        assert_eq!(seguro("pasta\\jogo.iso"), Some(PathBuf::from("pasta").join("jogo.iso")));
    }

    #[test]
    fn sete_z_de_verdade_e_descompactado() {
        let t = tempfile::tempdir().unwrap();
        let orig = t.path().join("orig");
        fs::create_dir_all(&orig).unwrap();
        fs::write(orig.join("Contra (USA).nes"), b"NES\x1Adados").unwrap();
        let sz = t.path().join("jogo.7z");
        sevenz_rust::compress_to_path(&orig, &sz).unwrap();
        assert_eq!(tipo_pelo_conteudo(&sz), Some(Tipo::SevenZ));
        let nomes = nomes(&sz, Tipo::SevenZ, 50);
        assert!(nomes.iter().any(|n| n.ends_with("Contra (USA).nes")), "{nomes:?}");
        let saida = t.path().join("saida");
        let feitos = extrair_tudo(&sz, Tipo::SevenZ, &saida).unwrap();
        assert_eq!(feitos.len(), 1);
        assert!(feitos[0].is_file());
    }
}
