//! Capas, descrições e dados extras de cada jogo, sem precisar de internet:
//!  - `gamelist.xml` (formato EmulationStation / ES-DE / Batocera) ao lado das ROMs;
//!  - imagens com o mesmo nome do jogo (ou em pastas como media/, images/, covers/, Named_Boxarts/);
//!  - textos de descrição `<nome>.txt`.
//! Quando não há capa local, o app pode baixar da Libretro pelo endereço montado por `capa_online`.
use crate::plataformas::Plataforma;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Info {
    pub nome: Option<String>,
    pub descricao: Option<String>,
    pub desenvolvedor: Option<String>,
    pub editora: Option<String>,
    pub ano: Option<u32>,
    pub genero: Option<String>,
    pub jogadores: Option<String>,
    pub capa: Option<PathBuf>,
}

const EXT_IMAGEM: &[&str] = &["png", "jpg", "jpeg", "webp"];
const PASTAS_DE_CAPA: &[&str] = &[
    "", "media", "images", "image", "imgs", "covers", "cover", "boxart", "boxarts", "Named_Boxarts", "media/boxart", "media/covers", "media/box2d", "media/images", "downloaded_images", "box2d", "box",
];

fn decodificar(texto: &str) -> String {
    let t = texto.trim();
    let t = t.strip_prefix("<![CDATA[").and_then(|x| x.strip_suffix("]]>")).unwrap_or(t);
    t.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&amp;", "&").trim().to_string()
}

fn campo(bloco: &str, tag: &str) -> Option<String> {
    let abre = format!("<{tag}>");
    let fecha = format!("</{tag}>");
    let i = bloco.find(&abre)? + abre.len();
    let f = bloco[i..].find(&fecha)? + i;
    let v = decodificar(&bloco[i..f]);
    if v.is_empty() {
        None
    } else {
        Some(v)
    }
}

/// "19940121T000000" ou "1994-01-21" → 1994
fn ano_de(data: &str) -> Option<u32> {
    let digitos: String = data.chars().take_while(|c| c.is_ascii_digit()).collect();
    let a: u32 = digitos.get(..4)?.parse().ok()?;
    if (1950..=2100).contains(&a) {
        Some(a)
    } else {
        None
    }
}

fn resolver(base: &Path, relativo: &str) -> PathBuf {
    let r = relativo.trim().trim_start_matches("./");
    let p = Path::new(r);
    if p.is_absolute() {
        p.to_path_buf()
    } else {
        base.join(r)
    }
}

/// Lê o gamelist.xml de uma pasta. A chave é o nome do arquivo da ROM (sem a pasta), em minúsculas.
pub fn ler_gamelist(pasta: &Path) -> HashMap<String, Info> {
    let mut m = HashMap::new();
    let Ok(xml) = fs::read_to_string(pasta.join("gamelist.xml")) else { return m };
    for bloco in xml.split("<game").skip(1) {
        let bloco = bloco.split("</game>").next().unwrap_or("");
        let Some(caminho) = campo(bloco, "path") else { continue };
        let Some(arquivo) = Path::new(&caminho.replace('\\', "/")).file_name().and_then(|n| n.to_str()).map(str::to_lowercase) else { continue };
        m.insert(
            arquivo,
            Info {
                nome: campo(bloco, "name"),
                descricao: campo(bloco, "desc"),
                desenvolvedor: campo(bloco, "developer"),
                editora: campo(bloco, "publisher"),
                ano: campo(bloco, "releasedate").and_then(|d| ano_de(&d)),
                genero: campo(bloco, "genre"),
                jogadores: campo(bloco, "players"),
                capa: campo(bloco, "image").or_else(|| campo(bloco, "thumbnail")).map(|i| resolver(pasta, &i)).filter(|p| p.is_file()),
            },
        );
    }
    m
}

/// Procura uma imagem com o nome da ROM (ou "<nome>-image/-thumb") em volta dela.
pub fn capa_local(rom: &Path, plataforma: &Plataforma) -> Option<PathBuf> {
    let stem = rom.file_stem()?.to_str()?;
    let pasta = rom.parent()?;
    let mut bases = vec![pasta.to_path_buf()];
    if let Some(pai) = pasta.parent() {
        bases.push(pai.to_path_buf());
        bases.push(pai.join("downloaded_media").join(plataforma.id));
        bases.push(pai.join("media").join(plataforma.id));
    }
    bases.push(pasta.join("downloaded_media").join(plataforma.id));
    for base in &bases {
        for sub in PASTAS_DE_CAPA {
            let dir = if sub.is_empty() { base.clone() } else { base.join(sub) };
            if !dir.is_dir() {
                continue;
            }
            for nome in [stem.to_string(), format!("{stem}-image"), format!("{stem}-thumb"), format!("{stem}-boxart")] {
                for ext in EXT_IMAGEM {
                    for e in [ext.to_string(), ext.to_uppercase()] {
                        let c = dir.join(format!("{nome}.{e}"));
                        if c.is_file() {
                            return Some(c);
                        }
                    }
                }
            }
        }
    }
    None
}

/// Descrição em texto: `<nome>.txt` ao lado da ROM (primeiros 2000 caracteres).
pub fn descricao_local(rom: &Path) -> Option<String> {
    let t = fs::read_to_string(rom.with_extension("txt")).ok()?;
    let t: String = t.trim().chars().take(2000).collect();
    if t.is_empty() {
        None
    } else {
        Some(t)
    }
}

fn codificar(texto: &str) -> String {
    let mut s = String::new();
    for b in texto.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~' | b'(' | b')' | b'!' | b'\'') {
            s.push(b as char);
        } else {
            s.push_str(&format!("%{b:02X}"));
        }
    }
    s
}

/// Endereço da capa no repositório de capas da Libretro (nome do arquivo da ROM sem extensão).
/// Os caracteres proibidos `&*/:`<>?\|` viram "_", como a Libretro faz.
pub fn capa_online(plataforma: &Plataforma, stem: &str) -> Option<String> {
    if plataforma.libretro.is_empty() || stem.trim().is_empty() {
        return None;
    }
    let nome: String = stem.chars().map(|c| if "&*/:`<>?\\|\"".contains(c) { '_' } else { c }).collect();
    Some(format!("https://thumbnails.libretro.com/{}/Named_Boxarts/{}.png", codificar(plataforma.libretro), codificar(&nome)))
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::plataformas::por_id;

    #[test]
    fn le_gamelist_com_cdata_entidades_e_ano() {
        let t = tempfile::tempdir().unwrap();
        fs::write(t.path().join("capa.png"), b"x").unwrap();
        fs::write(
            t.path().join("gamelist.xml"),
            r#"<?xml version="1.0"?><gameList>
            <game id="1"><path>./Super Mario World (USA).sfc</path><name>Super Mario World</name><desc><![CDATA[Salve a Princesa & os amigos.]]></desc>
            <image>./capa.png</image><releasedate>19901121T000000</releasedate><developer>Nintendo</developer><publisher>Nintendo</publisher><genre>Plataforma</genre><players>1-2</players></game>
            <game><path>./Outro.sfc</path><name>Outro &amp; Mais</name><image>./nao_existe.png</image></game></gameList>"#,
        )
        .unwrap();
        let m = ler_gamelist(t.path());
        let a = &m["super mario world (usa).sfc"];
        assert_eq!(a.nome.as_deref(), Some("Super Mario World"));
        assert_eq!(a.descricao.as_deref(), Some("Salve a Princesa & os amigos."));
        assert_eq!(a.ano, Some(1990));
        assert_eq!(a.jogadores.as_deref(), Some("1-2"));
        assert_eq!(a.capa, Some(t.path().join("capa.png")));
        let b = &m["outro.sfc"];
        assert_eq!(b.nome.as_deref(), Some("Outro & Mais"));
        assert!(b.capa.is_none());
        assert!(ler_gamelist(&t.path().join("nada")).is_empty());
    }

    #[test]
    fn acha_capa_ao_lado_e_em_pastas_comuns() {
        let t = tempfile::tempdir().unwrap();
        let snes = por_id("snes").unwrap();
        let rom = t.path().join("snes/Zelda.sfc");
        fs::create_dir_all(t.path().join("snes/media/boxart")).unwrap();
        fs::write(&rom, b"r").unwrap();
        assert!(capa_local(&rom, snes).is_none());
        fs::write(t.path().join("snes/media/boxart/Zelda.png"), b"i").unwrap();
        assert_eq!(capa_local(&rom, snes), Some(t.path().join("snes/media/boxart/Zelda.png")));
        fs::write(t.path().join("snes/Zelda.jpg"), b"i").unwrap();
        assert_eq!(capa_local(&rom, snes), Some(t.path().join("snes/Zelda.jpg"))); // ao lado vence
    }

    #[test]
    fn acha_capa_no_estilo_es_de() {
        let t = tempfile::tempdir().unwrap();
        let nes = por_id("nes").unwrap();
        let rom = t.path().join("roms/nes/Contra.nes");
        fs::create_dir_all(rom.parent().unwrap()).unwrap();
        fs::write(&rom, b"r").unwrap();
        fs::create_dir_all(t.path().join("roms/downloaded_media/nes/covers")).unwrap();
        fs::write(t.path().join("roms/downloaded_media/nes/covers/Contra.png"), b"i").unwrap();
        assert!(capa_local(&rom, nes).is_some());
    }

    #[test]
    fn descricao_em_txt() {
        let t = tempfile::tempdir().unwrap();
        let rom = t.path().join("a.nes");
        assert!(descricao_local(&rom).is_none());
        fs::write(t.path().join("a.txt"), "  Um clássico.  \n").unwrap();
        assert_eq!(descricao_local(&rom).as_deref(), Some("Um clássico."));
    }

    #[test]
    fn endereco_da_capa_da_libretro() {
        let snes = por_id("snes").unwrap();
        assert_eq!(
            capa_online(snes, "Legend of Zelda, The - A Link to the Past (USA)").unwrap(),
            "https://thumbnails.libretro.com/Nintendo%20-%20Super%20Nintendo%20Entertainment%20System/Named_Boxarts/Legend%20of%20Zelda%2C%20The%20-%20A%20Link%20to%20the%20Past%20(USA).png"
        );
        assert!(capa_online(snes, "Q*bert & Co: 2").unwrap().contains("Q_bert%20_%20Co_%202"));
        assert!(capa_online(por_id("android").unwrap(), "x").is_none());
        assert!(capa_online(snes, "  ").is_none());
    }
}
