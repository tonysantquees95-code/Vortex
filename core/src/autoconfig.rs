//! Grava o perfil de botões do Vortex como "autoconfig" do RetroArch: o RetroArch reconhece o controle sozinho (pelo código
//! do fabricante e do aparelho) e usa os botões que a pessoa ensinou. A numeração de botões e eixos vem do navegador e
//! costuma bater com a do RetroArch em controles genéricos; é um melhor esforço.
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

/// (botão do Vortex no padrão Xbox, nome do RetroPad). O RetroPad usa a posição: B embaixo, A à direita, Y à esquerda, X em cima.
const BOTOES: [(&str, &str); 12] = [
    ("A", "b"), ("B", "a"), ("X", "y"), ("Y", "x"), ("LB", "l"), ("RB", "r"),
    ("LT", "l2"), ("RT", "r2"), ("Select", "select"), ("Start", "start"), ("L3", "l3"), ("R3", "r3"),
];
const DIRECOES: [(&str, &str, &str); 4] = [("Cima", "up", "h0up"), ("Baixo", "down", "h0down"), ("Esquerda", "left", "h0left"), ("Direita", "right", "h0right")];

fn numero(v: &Value) -> Option<f64> {
    v.as_f64()
}

/// Uma entrada do perfil vira o texto do autoconfig: (é eixo?, valor). Botão "3"; eixo "+2"; setinha "h0up".
fn entrada(e: &Value, hat: Option<&str>) -> Option<(bool, String)> {
    match e.get("t").and_then(Value::as_str)? {
        "b" => Some((false, (numero(e.get("i")?)? as i64).to_string())),
        "e" => {
            let i = numero(e.get("i")?)? as i64;
            let v = numero(e.get("v")?)?;
            // a setinha vem do navegador como o eixo 9 com valores que não são -1 ou 1 puros
            if i == 9 && v.abs() <= 1.05 && hat.is_some() {
                return Some((false, hat?.to_string()));
            }
            Some((true, format!("{}{}", if v < 0.0 { "-" } else { "+" }, i)))
        }
        _ => None,
    }
}

/// Texto do arquivo .cfg para um controle. `vid` e `pid` chegam em hexadecimal ("045e"); o RetroArch quer decimal.
pub fn gerar(nome: &str, vid: &str, pid: &str, driver: &str, mapa: &Value) -> String {
    let mut s = String::new();
    let limpo: String = nome.chars().filter(|c| *c != '"' && !c.is_control()).collect();
    s.push_str(&format!("input_driver = \"{driver}\"\ninput_device = \"{limpo}\"\n"));
    if let (Ok(v), Ok(p)) = (u32::from_str_radix(vid, 16), u32::from_str_radix(pid, 16)) {
        s.push_str(&format!("input_vendor_id = \"{v}\"\ninput_product_id = \"{p}\"\n"));
    }
    for (xbox, ra) in BOTOES {
        if let Some((eixo, txt)) = mapa.get(xbox).and_then(|e| entrada(e, None)) {
            s.push_str(&format!("input_{ra}_{} = \"{txt}\"\n", if eixo { "axis" } else { "btn" }));
        }
    }
    for (nome_vortex, ra, hat) in DIRECOES {
        if let Some((eixo, txt)) = mapa.get(nome_vortex).and_then(|e| entrada(e, Some(hat))) {
            s.push_str(&format!("input_{ra}_{} = \"{txt}\"\n", if eixo { "axis" } else { "btn" }));
        }
    }
    // analógicos: o perfil não os mexe; os eixos 0-3 são o padrão da maioria dos controles
    s.push_str("input_l_x_plus_axis = \"+0\"\ninput_l_x_minus_axis = \"-0\"\ninput_l_y_plus_axis = \"+1\"\ninput_l_y_minus_axis = \"-1\"\n");
    s.push_str("input_r_x_plus_axis = \"+2\"\ninput_r_x_minus_axis = \"-2\"\ninput_r_y_plus_axis = \"+3\"\ninput_r_y_minus_axis = \"-3\"\n");
    s
}

fn nome_de_arquivo(nome: &str) -> String {
    let n: String = nome.chars().map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' { c } else { '_' }).collect();
    let n = n.trim();
    format!("Vortex - {}.cfg", if n.is_empty() { "Controle" } else { n })
}

/// Grava nas duas pastas de autoconfig do RetroArch (dinput e sdl2) e devolve os caminhos criados.
pub fn gravar(pasta_retroarch: &Path, nome: &str, vid: &str, pid: &str, mapa: &Value) -> Result<Vec<PathBuf>, String> {
    if !mapa.is_object() || mapa.as_object().is_some_and(|o| o.is_empty()) {
        return Err("O perfil está vazio: configure os botões primeiro.".into());
    }
    let mut criados = Vec::new();
    for driver in ["dinput", "sdl2"] {
        let pasta = pasta_retroarch.join("autoconfig").join(driver);
        fs::create_dir_all(&pasta).map_err(|e| format!("Não consegui criar a pasta do RetroArch: {e}"))?;
        let arq = pasta.join(nome_de_arquivo(nome));
        fs::write(&arq, gerar(nome, vid, pid, driver, mapa)).map_err(|e| format!("Não consegui gravar o perfil no RetroArch: {e}"))?;
        criados.push(arq);
    }
    Ok(criados)
}

#[cfg(test)]
mod testes {
    use super::*;
    use serde_json::json;

    #[test]
    fn gera_o_cfg_com_botoes_trocados_para_o_retropad() {
        let m = json!({ "A": {"t":"b","i":2}, "B": {"t":"b","i":1}, "LT": {"t":"e","i":4,"v":1.0}, "Cima": {"t":"e","i":9,"v":-1.0} , "Baixo": {"t":"b","i":13} });
        let t = gerar("Pad \"X\"", "045e", "028e", "dinput", &m);
        assert!(t.contains("input_driver = \"dinput\""));
        assert!(t.contains("input_device = \"Pad X\""));
        assert!(t.contains("input_vendor_id = \"1118\"") && t.contains("input_product_id = \"654\""));
        assert!(t.contains("input_b_btn = \"2\""), "A do Xbox é o B do RetroPad");
        assert!(t.contains("input_a_btn = \"1\""));
        assert!(t.contains("input_l2_axis = \"+4\""));
        assert!(t.contains("input_down_btn = \"13\""));
        assert!(t.contains("input_up_btn = \"h0up\""), "setinha vira h0up");
        assert!(!t.contains("input_x_btn"), "o que não foi mapeado não entra");
    }

    #[test]
    fn grava_nas_duas_pastas_e_recusa_perfil_vazio() {
        let d = std::env::temp_dir().join(format!("vortex-ac-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        assert!(gravar(&d, "Pad", "045e", "028e", &json!({})).is_err());
        let r = gravar(&d, "Pad/Estranho:1", "045e", "028e", &json!({"A": {"t":"b","i":0}})).unwrap();
        assert_eq!(r.len(), 2);
        assert!(r.iter().all(|p| p.is_file()));
        assert!(r[0].to_string_lossy().contains("Vortex - Pad_Estranho_1.cfg"));
        let _ = fs::remove_dir_all(&d);
    }
}
