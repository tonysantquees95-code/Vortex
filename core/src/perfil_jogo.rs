//! Perfil por jogo: ajustes gráficos escolhidos para o aparelho (a IA sugere, aqui tudo é validado). A IA escolhe ajustes neutros
//! (resolução, MSAA…) e cada emulador recebe a tradução: Dolphin (-C Sistema.Seção.Chave=Valor) e PPSSPP (--resolution-scale, --msaa)
//! pela linha de comando, RetroArch pelas opções do núcleo. Nada é gravado nos arquivos dos emuladores da pessoa.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

enum Regra {
    Faixa(i64, i64),
    Valores(&'static [i64]),
    Booleano,
}

/// Ajustes neutros aceitos. Qualquer outra chave é descartada.
const PERMITIDOS: &[(&str, Regra)] = &[
    ("resolucao", Regra::Faixa(1, 6)),
    ("msaa", Regra::Valores(&[0, 2, 4, 8])),
    ("anisotropia", Regra::Faixa(0, 4)),
    ("vsync", Regra::Booleano),
    ("sombreadores", Regra::Faixa(0, 3)),
];

pub fn plataforma_aceita(id: &str) -> bool {
    matches!(id, "gamecube" | "wii" | "psp")
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct Perfil {
    /// chave neutra → valor em texto ("2", "true")
    pub ajustes: BTreeMap<String, String>,
    pub motivo: String,
    /// "ia", "manual" ou "seguro" (a IA errou a mão e o jogo fechou logo: ajustes mínimos)
    pub origem: String,
    /// quantas vezes o jogo fechou logo com erro depois de abrir com este perfil
    #[serde(default)]
    pub falhas: u32,
    /// depois de duas falhas o perfil é desligado (o jogo abre com a configuração do emulador) e a IA não é chamada de novo
    #[serde(default)]
    pub desativado: bool,
}

/// Deixa só chaves permitidas com valores dentro da faixa.
pub fn validar(entrada: &Value) -> BTreeMap<String, String> {
    let mut r = BTreeMap::new();
    let Some(m) = entrada.as_object() else { return r };
    for (k, v) in m {
        let Some((_, regra)) = PERMITIDOS.iter().find(|(c, _)| c == k) else { continue };
        let texto = match regra {
            Regra::Booleano => v.as_bool().map(|b| b.to_string()),
            Regra::Faixa(a, b) => v.as_i64().filter(|n| n >= a && n <= b).map(|n| n.to_string()),
            Regra::Valores(l) => v.as_i64().filter(|n| l.contains(n)).map(|n| n.to_string()),
        };
        if let Some(t) = texto {
            r.insert(k.clone(), t);
        }
    }
    r
}

fn num(p: &Perfil, k: &str) -> Option<i64> {
    p.ajustes.get(k).and_then(|v| v.parse().ok())
}
fn booleano(p: &Perfil, k: &str) -> Option<bool> {
    p.ajustes.get(k).and_then(|v| v.parse().ok())
}

/// Dolphin: `-C Sistema.Seção.Chave=Valor` na linha de comando.
pub fn args_dolphin(p: &Perfil) -> Vec<String> {
    let mut v: Vec<(&str, String)> = Vec::new();
    if let Some(n) = num(p, "resolucao") {
        v.push(("GFX.Settings.InternalResolution", n.to_string()));
    }
    if let Some(n) = num(p, "msaa") {
        v.push(("GFX.Settings.MSAA", n.max(1).to_string()));
    }
    if let Some(n) = num(p, "anisotropia") {
        v.push(("GFX.Enhancements.MaxAnisotropy", n.to_string()));
    }
    if let Some(b) = booleano(p, "vsync") {
        v.push(("GFX.Hardware.VSync", if b { "True" } else { "False" }.to_string()));
    }
    if let Some(n) = num(p, "sombreadores") {
        v.push(("GFX.Settings.ShaderCompilationMode", n.to_string()));
    }
    v.into_iter().flat_map(|(k, x)| ["-C".to_string(), format!("{k}={x}")]).collect()
}

/// PPSSPP: opções de linha de comando que valem só para esta abertura.
pub fn args_ppsspp(p: &Perfil) -> Vec<String> {
    let mut v = Vec::new();
    if let Some(n) = num(p, "resolucao") {
        v.push(format!("--resolution-scale={n}"));
    }
    if let Some(n) = num(p, "msaa") {
        // PPSSPP: 0 = desligado, 1 = 2x, 2 = 4x, 3 = 8x
        v.push(format!("--msaa={}", match n { 2 => 1, 4 => 2, 8 => 3, _ => 0 }));
    }
    v
}

/// RetroArch: (texto do arquivo .opt do núcleo, linhas extras do retroarch.cfg).
pub fn opcoes_retroarch(nucleo: &str, p: &Perfil) -> (String, String) {
    let mut opt = String::new();
    let mut cfg = String::new();
    match nucleo {
        "dolphin_libretro" => {
            if let Some(n) = num(p, "resolucao") {
                opt.push_str(&format!("dolphin_efb_scale = \"x{n} ({} x {})\"\n", n * 640, n * 528));
            }
        }
        "ppsspp_libretro" => {
            if let Some(n) = num(p, "resolucao") {
                opt.push_str(&format!("ppsspp_internal_resolution = \"{}x{}\"\n", 480 * n, 272 * n));
            }
        }
        _ => {}
    }
    if let Some(b) = booleano(p, "vsync") {
        cfg.push_str(&format!("video_vsync = \"{b}\"\n"));
    }
    (opt, cfg)
}

fn arquivo(dados: &Path) -> PathBuf {
    dados.join("perfis_jogo.json")
}

fn tudo(dados: &Path) -> BTreeMap<String, Perfil> {
    fs::read_to_string(arquivo(dados)).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

/// None se não há perfil ou se ele veio do formato antigo (sem nenhuma chave de hoje): aí o app pede de novo.
pub fn ler(dados: &Path, id: &str) -> Option<Perfil> {
    tudo(dados).remove(id).filter(|p| p.desativado || p.ajustes.keys().any(|k| PERMITIDOS.iter().any(|(c, _)| c == k)))
}

/// O jogo fechou logo com erro depois de abrir com o perfil: na 1ª vez volta aos ajustes mínimos, na 2ª desliga o perfil.
pub fn registrar_falha(dados: &Path, id: &str) {
    let Some(mut p) = ler(dados, id) else { return };
    if p.desativado {
        return;
    }
    p.falhas += 1;
    if p.falhas >= 2 {
        p.desativado = true;
        p.ajustes.clear();
        p.motivo = "Desligado: o jogo fechou logo duas vezes com estes ajustes.".into();
    } else {
        p.ajustes = validar(&serde_json::json!({ "resolucao": 1, "msaa": 0, "anisotropia": 0 }));
        p.origem = "seguro".into();
        p.motivo = "Ajustes mínimos: o jogo fechou logo com os da IA.".into();
    }
    let _ = salvar(dados, id, p);
}

pub fn salvar(dados: &Path, id: &str, p: Perfil) -> Result<(), String> {
    let mut t = tudo(dados);
    t.insert(id.to_string(), p);
    fs::create_dir_all(dados).map_err(|e| e.to_string())?;
    let tmp = arquivo(dados).with_extension("tmp");
    fs::write(&tmp, serde_json::to_string_pretty(&t).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::rename(&tmp, arquivo(dados)).map_err(|e| e.to_string())
}

pub fn limpar(dados: &Path, id: &str) -> Result<(), String> {
    let mut t = tudo(dados);
    if t.remove(id).is_some() {
        fs::write(arquivo(dados), serde_json::to_string_pretty(&t).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Aplica o perfil ao plano de lançamento, conforme o emulador que vai abrir o jogo.
pub fn aplicar(plano: &mut crate::emuladores::Lancamento, p: &Perfil, dados: &Path, id: &str) {
    if p.desativado {
        return;
    }
    match plano.emulador.as_str() {
        "dolphin" => plano.args.extend(args_dolphin(p)),
        "ppsspp" => plano.args.extend(args_ppsspp(p)),
        "retroarch" => {
            let (Some(nucleo), Some(cfg)) = (plano.nucleo.clone(), plano.configuracao.clone()) else { return };
            let (opt, extra) = opcoes_retroarch(&nucleo, p);
            let mut linhas = extra;
            if !opt.is_empty() {
                let arq = dados.join("retroarch").join("perfis").join(format!("{id}.opt"));
                if let Some(d) = arq.parent() {
                    let _ = fs::create_dir_all(d);
                }
                if fs::write(&arq, opt).is_ok() {
                    linhas.push_str(&format!("core_options_path = \"{}\"\n", arq.to_string_lossy().replace('\\', "/")));
                }
            }
            if !linhas.is_empty() {
                if let Ok(mut t) = fs::read_to_string(&cfg) {
                    t.push('\n');
                    t.push_str(&linhas);
                    let _ = fs::write(&cfg, t);
                }
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod testes {
    use super::*;
    use serde_json::json;

    fn perfil() -> Perfil {
        Perfil { ajustes: validar(&json!({"resolucao": 2, "msaa": 4, "vsync": true, "anisotropia": 2, "perigosa": 1})), motivo: "x".into(), origem: "ia".into(), ..Default::default() }
    }

    #[test]
    fn valida_faixas_e_chaves() {
        let v = validar(&json!({"resolucao": 7, "msaa": 3, "vsync": 1, "Outra.Chave": 1, "sombreadores": 3}));
        assert_eq!(v.len(), 1);
        assert_eq!(v["sombreadores"], "3");
    }

    #[test]
    fn traduz_para_cada_emulador() {
        let p = perfil();
        assert_eq!(p.ajustes.len(), 4);
        let d = args_dolphin(&p);
        assert!(d.contains(&"GFX.Settings.InternalResolution=2".to_string()) && d.contains(&"GFX.Settings.MSAA=4".to_string()) && d.contains(&"GFX.Hardware.VSync=True".to_string()));
        assert_eq!(args_ppsspp(&p), vec!["--resolution-scale=2", "--msaa=2"]);
        let (opt, cfg) = opcoes_retroarch("dolphin_libretro", &p);
        assert!(opt.contains("dolphin_efb_scale = \"x2 (1280 x 1056)\""));
        assert!(cfg.contains("video_vsync = \"true\""));
        assert!(opcoes_retroarch("ppsspp_libretro", &p).0.contains("960x544"));
        assert!(opcoes_retroarch("outro_libretro", &p).0.is_empty());
    }

    #[test]
    fn aplica_no_retroarch_e_no_ppsspp() {
        let t = tempfile::tempdir().unwrap();
        let cfg = t.path().join("r.cfg");
        fs::write(&cfg, "a = \"b\"\n").unwrap();
        let mut plano = crate::emuladores::Lancamento { emulador: "retroarch".into(), programa: "x".into(), args: vec![], diretorio: None, configuracao: Some(cfg.clone()), nucleo: Some("dolphin_libretro".into()) };
        aplicar(&mut plano, &perfil(), t.path(), "jogo1");
        let texto = fs::read_to_string(&cfg).unwrap();
        assert!(texto.contains("core_options_path") && texto.contains("video_vsync"));
        assert!(t.path().join("retroarch/perfis/jogo1.opt").is_file());
        let mut psp = crate::emuladores::Lancamento { emulador: "ppsspp".into(), programa: "x".into(), args: vec!["rom".into()], diretorio: None, configuracao: None, nucleo: None };
        aplicar(&mut psp, &perfil(), t.path(), "jogo1");
        assert_eq!(psp.args, vec!["rom", "--resolution-scale=2", "--msaa=2"]);
    }

    #[test]
    fn falhas_seguidas_voltam_ao_seguro_e_depois_desligam() {
        let t = tempfile::tempdir().unwrap();
        salvar(t.path(), "j", perfil()).unwrap();
        registrar_falha(t.path(), "j");
        let p = ler(t.path(), "j").unwrap();
        assert_eq!((p.origem.as_str(), p.falhas, p.ajustes["resolucao"].as_str(), p.ajustes["msaa"].as_str()), ("seguro", 1, "1", "0"));
        registrar_falha(t.path(), "j");
        let p = ler(t.path(), "j").unwrap();
        assert!(p.desativado && p.ajustes.is_empty(), "continua existindo para a IA não ser chamada de novo");
        let mut plano = crate::emuladores::Lancamento { emulador: "ppsspp".into(), programa: "x".into(), args: vec![], diretorio: None, configuracao: None, nucleo: None };
        aplicar(&mut plano, &p, t.path(), "j");
        assert!(plano.args.is_empty());
    }

    #[test]
    fn guarda_le_e_limpa_e_ignora_perfil_antigo() {
        let t = tempfile::tempdir().unwrap();
        salvar(t.path(), "abc", perfil()).unwrap();
        assert_eq!(ler(t.path(), "abc"), Some(perfil()));
        let antigo = Perfil { ajustes: [("GFX.Settings.InternalResolution".to_string(), "2".to_string())].into(), ..Default::default() };
        salvar(t.path(), "velho", antigo).unwrap();
        assert!(ler(t.path(), "velho").is_none(), "perfil no formato antigo é refeito");
        limpar(t.path(), "abc").unwrap();
        assert!(ler(t.path(), "abc").is_none());
    }
}
