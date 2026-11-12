//! Faxina da biblioteca: um jogo só por título (as outras cópias vão para a pasta "Duplicados") e nada de arquivo quebrado
//! (vai para "Corrompidos"). Nada é apagado: dá para devolver os arquivos à mão.
use crate::biblioteca::{melhor_do_grupo, referencias, Biblioteca, Jogo};
use crate::hash;
use crate::organizador::{acompanhantes, livre, mover_arquivo};
use crate::plataformas;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

pub const PASTA_DUPLICADOS: &str = "Duplicados";
pub const PASTA_CORROMPIDOS: &str = "Corrompidos";
const LIMITE_CRC: u64 = 64 * 1024 * 1024;

#[derive(Debug, Default, Serialize)]
pub struct RelatorioLimpeza {
    pub duplicados: Vec<String>,
    pub corrompidos: Vec<String>,
    pub falhas: Vec<String>,
    pub simulacao: bool,
}

/// Por que o arquivo não presta (None = parece bom). Só olha o que dá para saber sem abrir o jogo.
pub fn motivo_de_corrupcao(caminho: &Path) -> Option<String> {
    let ext = plataformas::extensao(caminho);
    let meta = fs::metadata(caminho).ok()?;
    if meta.len() == 0 {
        return Some("arquivo vazio".into());
    }
    let mut cabeca = [0u8; 16];
    let lidos = fs::File::open(caminho).ok().and_then(|mut f| f.read(&mut cabeca).ok()).unwrap_or(0);
    let c = &cabeca[..lidos];
    match ext.as_str() {
        "cue" => {
            let dir = caminho.parent().unwrap_or(Path::new("."));
            let refs = referencias(caminho);
            let existentes: Vec<String> = fs::read_dir(dir).map(|r| r.flatten().map(|e| e.file_name().to_string_lossy().to_lowercase()).collect()).unwrap_or_default();
            if refs.iter().any(|r| !existentes.contains(r)) {
                return Some("faltam arquivos do disco".into());
            }
        }
        "m3u" | "gdi" | "ccd" | "mds" | "sub" => {}
        "zip" if c.len() < 4 || &c[..2] != b"PK" => return Some("zip danificado".into()),
        "7z" if c.len() < 6 || c[..6] != [b'7', b'z', 0xBC, 0xAF, 0x27, 0x1C] => return Some("7z danificado".into()),
        "nes" if c.len() < 4 || c[..4] != [b'N', b'E', b'S', 0x1A] => return Some("cabeçalho NES inválido".into()),
        "z64" | "v64" | "n64" if !c.is_empty() && ![0x80, 0x37, 0x40].contains(&c[0]) => return Some("cabeçalho Nintendo 64 inválido".into()),
        _ => {
            if meta.len() < 512 {
                return Some("pequeno demais para ser um jogo".into());
            }
        }
    }
    if ext == "zip" {
        let ok = fs::File::open(caminho).ok().and_then(|f| zip::ZipArchive::new(f).ok()).is_some();
        if !ok {
            return Some("zip danificado".into());
        }
    }
    None
}

fn mover_com_acompanhantes(j: &Path, pasta: &Path, falhas: &mut Vec<String>) -> bool {
    let mut grupo = vec![j.to_path_buf()];
    grupo.extend(acompanhantes(j));
    for g in &grupo {
        let d = livre(pasta.join(g.file_name().unwrap_or_default()));
        if let Err(e) = mover_arquivo(g, &d) {
            falhas.push(e);
            return false;
        }
    }
    true
}

fn pasta_de(j: &Jogo, nome: &str) -> PathBuf {
    j.raiz.join(nome)
}

/// Move corrompidos e cópias repetidas para fora da biblioteca. Com `simulacao` só conta.
pub fn limpar(b: &mut Biblioteca, simulacao: bool) -> RelatorioLimpeza {
    let mut r = RelatorioLimpeza { simulacao, ..Default::default() };
    let mut saiu: Vec<String> = Vec::new();
    // 1) corrompidos
    let mut ids: Vec<String> = b.jogos.values().filter(|j| j.disponivel && j.caminho.is_file()).map(|j| j.id.clone()).collect();
    ids.sort();
    for id in &ids {
        let j = b.jogos[id].clone();
        if let Some(m) = motivo_de_corrupcao(&j.caminho) {
            r.corrompidos.push(format!("{} ({m})", j.caminho.display()));
            if simulacao || mover_com_acompanhantes(&j.caminho, &pasta_de(&j, PASTA_CORROMPIDOS), &mut r.falhas) {
                saiu.push(id.clone());
            }
        }
    }
    // 2) mesmo título em versões diferentes: fica a preferida
    b.marcar_duplicatas_publico();
    let escondidos: Vec<Jogo> = b.jogos.values().filter(|j| j.escondido && j.disponivel && !saiu.contains(&j.id)).cloned().collect();
    for j in escondidos {
        if !j.caminho.is_file() {
            continue;
        }
        r.duplicados.push(j.caminho.display().to_string());
        if simulacao || mover_com_acompanhantes(&j.caminho, &pasta_de(&j, PASTA_DUPLICADOS), &mut r.falhas) {
            saiu.push(j.id.clone());
        }
    }
    // 3) mesmo conteúdo com nomes diferentes (mesmo console, mesmo tamanho e mesmo CRC)
    let mut por_tamanho: HashMap<(String, u64), Vec<Jogo>> = HashMap::new();
    for j in b.jogos.values().filter(|j| j.disponivel && j.bytes > 0 && j.caminho.is_file() && !saiu.contains(&j.id) && !["cue", "m3u", "gdi"].contains(&plataformas::extensao(&j.caminho).as_str())) {
        por_tamanho.entry((j.plataforma.clone(), j.bytes)).or_default().push(j.clone());
    }
    for (_, grupo) in por_tamanho.into_iter().filter(|(_, g)| g.len() > 1) {
        let mut por_crc: HashMap<u32, Vec<Jogo>> = HashMap::new();
        for j in grupo {
            if let Ok(Some(c)) = hash::crc32_arquivo(&j.caminho, LIMITE_CRC) {
                por_crc.entry(c).or_default().push(j);
            }
        }
        for (_, mut iguais) in por_crc.into_iter().filter(|(_, g)| g.len() > 1) {
            iguais.sort_by(melhor_do_grupo);
            for j in iguais.into_iter().skip(1) {
                r.duplicados.push(j.caminho.display().to_string());
                if simulacao || mover_com_acompanhantes(&j.caminho, &pasta_de(&j, PASTA_DUPLICADOS), &mut r.falhas) {
                    saiu.push(j.id.clone());
                }
            }
        }
    }
    if !simulacao {
        for id in &saiu {
            b.jogos.remove(id);
        }
    }
    r
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::biblioteca::OpcoesEscaneamento;

    fn arq(base: &Path, rel: &str, conteudo: &[u8]) {
        let p = base.join(rel);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, conteudo).unwrap();
    }

    fn nes(extra: u8) -> Vec<u8> {
        let mut v = vec![b'N', b'E', b'S', 0x1A];
        v.resize(40_000, extra);
        v
    }

    #[test]
    fn duplicados_e_corrompidos_saem_da_biblioteca() {
        let t = tempfile::tempdir().unwrap();
        let raiz = t.path().join("roms");
        arq(&raiz, "nes/Contra (USA).nes", &nes(1));
        arq(&raiz, "nes/Contra (Japan).nes", &nes(2));
        arq(&raiz, "nes/Contra (USA) copia.nes", &nes(1)); // mesmo conteúdo, outro nome
        arq(&raiz, "nes/Quebrado.nes", b"isto nao e um jogo de verdade");
        arq(&raiz, "nes/Vazio.nes", b"");
        arq(&raiz, "nes/Mario (USA).nes", &nes(3));
        let mut b = Biblioteca::default();
        b.adicionar_pasta(&raiz).unwrap();
        b.escanear(100, OpcoesEscaneamento::default());

        let sim = limpar(&mut b, true);
        assert!(sim.simulacao && sim.corrompidos.len() == 2 && sim.duplicados.len() >= 1, "{sim:?}");
        assert!(raiz.join("nes/Quebrado.nes").exists(), "simulação não mexe em nada");

        let r = limpar(&mut b, false);
        assert!(r.falhas.is_empty(), "{:?}", r.falhas);
        assert_eq!(r.corrompidos.len(), 2);
        assert!(raiz.join("Corrompidos/Quebrado.nes").is_file() && raiz.join("Corrompidos/Vazio.nes").is_file());
        assert!(raiz.join("Duplicados").is_dir());
        assert!(raiz.join("nes/Contra (USA).nes").is_file(), "a versão preferida fica");
        assert!(raiz.join("nes/Mario (USA).nes").is_file());

        // rodar de novo e escanear: nada volta e nada mais sai
        b.escanear(200, OpcoesEscaneamento::default());
        assert_eq!(b.jogos.len(), 2, "{:?}", b.jogos.values().map(|j| &j.titulo).collect::<Vec<_>>());
        assert!(limpar(&mut b, false).duplicados.is_empty());
    }

    #[test]
    fn cue_sem_bin_e_corrompido() {
        let t = tempfile::tempdir().unwrap();
        arq(t.path(), "a.cue", b"FILE \"a.bin\" BINARY\n");
        assert!(motivo_de_corrupcao(&t.path().join("a.cue")).is_some());
        arq(t.path(), "a.bin", &vec![1u8; 2048]);
        assert!(motivo_de_corrupcao(&t.path().join("a.cue")).is_none());
    }
}
