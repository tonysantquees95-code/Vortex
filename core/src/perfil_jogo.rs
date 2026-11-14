//! Perfil por jogo: ajustes do emulador escolhidos para o aparelho (a IA sugere, aqui tudo é validado). Hoje vale para o Dolphin
//! (GameCube e Wii) no computador: os ajustes vão na linha de comando (-C Sistema.Seção.Chave=Valor) e nada é gravado nos arquivos do emulador.
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

/// Únicas chaves aceitas, com o que é permitido em cada uma.
const PERMITIDOS: &[(&str, Regra)] = &[
    ("GFX.Settings.InternalResolution", Regra::Faixa(1, 6)),
    ("GFX.Settings.MSAA", Regra::Valores(&[1, 2, 4, 8])),
    ("GFX.Enhancements.MaxAnisotropy", Regra::Faixa(0, 4)),
    ("GFX.Settings.ShaderCompilationMode", Regra::Faixa(0, 3)),
    ("GFX.Settings.WaitForShadersBeforeStarting", Regra::Booleano),
    ("GFX.Hardware.VSync", Regra::Booleano),
    ("GFX.Settings.BackendMultithreading", Regra::Booleano),
    ("Dolphin.Core.CPUThread", Regra::Booleano),
    ("Dolphin.Core.SyncOnSkipIdle", Regra::Booleano),
];

pub fn plataforma_aceita(id: &str) -> bool {
    id == "gamecube" || id == "wii"
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct Perfil {
    /// chave → valor já em texto ("2", "True")
    pub ajustes: BTreeMap<String, String>,
    pub motivo: String,
    /// "ia" ou "manual"
    pub origem: String,
}

/// Deixa só chaves permitidas com valores dentro da faixa.
pub fn validar(entrada: &Value) -> BTreeMap<String, String> {
    let mut r = BTreeMap::new();
    let Some(m) = entrada.as_object() else { return r };
    for (k, v) in m {
        let Some((_, regra)) = PERMITIDOS.iter().find(|(c, _)| c == k) else { continue };
        let texto = match regra {
            Regra::Booleano => v.as_bool().map(|b| if b { "True" } else { "False" }.to_string()),
            Regra::Faixa(a, b) => v.as_i64().filter(|n| n >= a && n <= b).map(|n| n.to_string()),
            Regra::Valores(l) => v.as_i64().filter(|n| l.contains(n)).map(|n| n.to_string()),
        };
        if let Some(t) = texto {
            r.insert(k.clone(), t);
        }
    }
    r
}

/// Argumentos extras do Dolphin para o perfil: `-C Sistema.Seção.Chave=Valor`.
pub fn argumentos(p: &Perfil) -> Vec<String> {
    p.ajustes.iter().filter(|(k, _)| PERMITIDOS.iter().any(|(c, _)| c == k)).flat_map(|(k, v)| ["-C".to_string(), format!("{k}={v}")]).collect()
}

fn arquivo(dados: &Path) -> PathBuf {
    dados.join("perfis_jogo.json")
}

fn tudo(dados: &Path) -> BTreeMap<String, Perfil> {
    fs::read_to_string(arquivo(dados)).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

pub fn ler(dados: &Path, id: &str) -> Option<Perfil> {
    tudo(dados).remove(id)
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

#[cfg(test)]
mod testes {
    use super::*;
    use serde_json::json;

    #[test]
    fn valida_faixas_e_chaves() {
        let v = validar(&json!({"GFX.Settings.InternalResolution": 3, "GFX.Settings.MSAA": 3, "Dolphin.Core.CPUThread": true, "Perigosa.Chave": 1, "GFX.Hardware.VSync": 1}));
        assert_eq!(v.len(), 2);
        assert_eq!(v["GFX.Settings.InternalResolution"], "3");
        assert_eq!(v["Dolphin.Core.CPUThread"], "True");
    }

    #[test]
    fn guarda_le_e_limpa() {
        let t = tempfile::tempdir().unwrap();
        let p = Perfil { ajustes: validar(&json!({"GFX.Settings.InternalResolution": 2})), motivo: "x".into(), origem: "ia".into() };
        salvar(t.path(), "abc", p.clone()).unwrap();
        assert_eq!(ler(t.path(), "abc"), Some(p.clone()));
        assert_eq!(argumentos(&p), vec!["-C", "GFX.Settings.InternalResolution=2"]);
        limpar(t.path(), "abc").unwrap();
        assert!(ler(t.path(), "abc").is_none());
    }
}
