//! Jogos de PC que já estão instalados: Steam e Epic Games (lidos dos arquivos dos próprios lançadores, sem senha)
//! e programas escolhidos à mão. Cada um vira um atalho (.url ou .lnk) na pasta "Jogos PC" do Vortex, e o
//! escaneamento normal da biblioteca faz o resto. Só abre pelo lançador oficial: nada é copiado nem baixado.

use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq)]
pub struct JogoDePc {
    pub titulo: String,
    /// endereço que o Windows abre (steam://… ou com.epicgames.launcher://…)
    pub alvo: String,
    pub origem: &'static str,
}

/// Valor de uma linha `"chave"  "valor"` dos arquivos da Steam.
fn valor_vdf(linha: &str, chave: &str) -> Option<String> {
    let t = linha.trim();
    let resto = t.strip_prefix('"')?.strip_prefix(chave)?.strip_prefix('"')?;
    let v = resto.trim().strip_prefix('"')?;
    let fim = v.rfind('"')?;
    Some(v[..fim].replace("\\\\", "\\"))
}

/// Pastas de biblioteca da Steam (a principal mais as que a pessoa criou em outros discos).
pub fn pastas_da_steam(raiz: &Path) -> Vec<PathBuf> {
    let mut l = vec![raiz.join("steamapps")];
    if let Ok(t) = fs::read_to_string(raiz.join("steamapps").join("libraryfolders.vdf")) {
        for linha in t.lines() {
            if let Some(p) = valor_vdf(linha, "path") {
                let c = PathBuf::from(p).join("steamapps");
                if !l.contains(&c) {
                    l.push(c);
                }
            }
        }
    }
    l
}

/// Ferramentas da Steam que não são jogos.
fn ferramenta_da_steam(id: &str, nome: &str) -> bool {
    let n = nome.to_lowercase();
    id == "228980" || n.contains("steamworks") || n.contains("redistributable") || n.starts_with("proton ") || n.starts_with("steam linux runtime") || n == "steam"
}

pub fn jogos_da_steam(raiz: &Path) -> Vec<JogoDePc> {
    let mut v = Vec::new();
    for pasta in pastas_da_steam(raiz) {
        let Ok(it) = fs::read_dir(&pasta) else { continue };
        for e in it.filter_map(Result::ok) {
            let n = e.file_name().to_string_lossy().to_string();
            if !(n.starts_with("appmanifest_") && n.ends_with(".acf")) {
                continue;
            }
            let Ok(t) = fs::read_to_string(e.path()) else { continue };
            let (mut id, mut nome) = (None, None);
            for linha in t.lines() {
                id = id.or_else(|| valor_vdf(linha, "appid"));
                nome = nome.or_else(|| valor_vdf(linha, "name"));
            }
            if let (Some(id), Some(nome)) = (id, nome) {
                if id.chars().all(|c| c.is_ascii_digit()) && !id.is_empty() && !ferramenta_da_steam(&id, &nome) {
                    v.push(JogoDePc { titulo: nome, alvo: format!("steam://rungameid/{id}"), origem: "Steam" });
                }
            }
        }
    }
    v.sort_by(|a, b| a.titulo.cmp(&b.titulo));
    v.dedup_by(|a, b| a.alvo == b.alvo);
    v
}

/// Jogos da Epic: lê os `.item` que o lançador deixa em ProgramData.
pub fn jogos_da_epic(manifestos: &Path) -> Vec<JogoDePc> {
    let mut v = Vec::new();
    let Ok(it) = fs::read_dir(manifestos) else { return v };
    for e in it.filter_map(Result::ok) {
        if e.path().extension().and_then(|x| x.to_str()) != Some("item") {
            continue;
        }
        let Ok(t) = fs::read_to_string(e.path()) else { continue };
        let Ok(j) = serde_json::from_str::<serde_json::Value>(&t) else { continue };
        let nome = j.get("DisplayName").and_then(|x| x.as_str()).unwrap_or("");
        let app = j.get("AppName").and_then(|x| x.as_str()).unwrap_or("");
        let so_jogos = j.get("AppCategories").and_then(|x| x.as_array()).map(|c| c.iter().any(|x| x.as_str() == Some("games"))).unwrap_or(true);
        if nome.is_empty() || app.is_empty() || !so_jogos || !app.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
            continue;
        }
        v.push(JogoDePc { titulo: nome.to_string(), alvo: format!("com.epicgames.launcher://apps/{app}?action=launch&silent=true"), origem: "Epic Games" });
    }
    v.sort_by(|a, b| a.titulo.cmp(&b.titulo));
    v
}

/// Nome de arquivo seguro para o Windows.
pub fn nome_de_arquivo(t: &str) -> String {
    let s: String = t.chars().map(|c| if "<>:\"/\\|?*".contains(c) || c.is_control() { ' ' } else { c }).collect();
    let s = s.split_whitespace().collect::<Vec<_>>().join(" ");
    let s = s.trim_matches('.').to_string();
    if s.is_empty() { "Jogo".into() } else { s.chars().take(80).collect() }
}

/// Cria os atalhos que ainda não existem. Devolve quantos são novos.
pub fn escrever_atalhos(destino: &Path, jogos: &[JogoDePc]) -> Result<usize, String> {
    fs::create_dir_all(destino).map_err(|e| format!("Não consegui criar a pasta dos jogos de PC: {e}"))?;
    let mut novos = 0;
    for j in jogos {
        let arq = destino.join(format!("{} ({}).url", nome_de_arquivo(&j.titulo), j.origem));
        let texto = format!("[InternetShortcut]\r\nURL={}\r\n", j.alvo);
        if fs::read_to_string(&arq).ok().as_deref() == Some(texto.as_str()) {
            continue;
        }
        fs::write(&arq, texto).map_err(|e| format!("Não consegui criar o atalho de {}: {e}", j.titulo))?;
        novos += 1;
    }
    Ok(novos)
}

/// Onde costumam ficar a Steam e a Epic neste computador.
pub fn raiz_da_steam(program_files_x86: Option<&Path>) -> Option<PathBuf> {
    let c = program_files_x86.map(|p| p.join("Steam"))?;
    c.join("steamapps").is_dir().then_some(c)
}

#[cfg(test)]
mod testes {
    use super::*;

    fn pasta(n: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!("vortex-pc-{n}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn le_jogos_da_steam_em_varios_discos() {
        let r = pasta("steam");
        let outro = pasta("steam2");
        fs::create_dir_all(r.join("steamapps")).unwrap();
        fs::create_dir_all(outro.join("steamapps")).unwrap();
        fs::write(r.join("steamapps/libraryfolders.vdf"), format!("\"libraryfolders\"\n{{\n\t\"0\"\n\t{{\n\t\t\"path\"\t\t\"{}\"\n\t}}\n}}", outro.to_string_lossy().replace('\\', "\\\\"))).unwrap();
        fs::write(r.join("steamapps/appmanifest_620.acf"), "\"AppState\"\n{\n\t\"appid\"\t\t\"620\"\n\t\"name\"\t\t\"Portal 2\"\n}").unwrap();
        fs::write(r.join("steamapps/appmanifest_228980.acf"), "\"AppState\"\n{\n\t\"appid\"\t\t\"228980\"\n\t\"name\"\t\t\"Steamworks Common Redistributables\"\n}").unwrap();
        fs::write(outro.join("steamapps/appmanifest_730.acf"), "\"AppState\"\n{\n\t\"appid\"\t\t\"730\"\n\t\"name\"\t\t\"Counter-Strike 2\"\n}").unwrap();
        let j = jogos_da_steam(&r);
        assert_eq!(j.iter().map(|x| x.titulo.as_str()).collect::<Vec<_>>(), ["Counter-Strike 2", "Portal 2"]);
        assert_eq!(j[1].alvo, "steam://rungameid/620");
    }

    #[test]
    fn le_jogos_da_epic_e_ignora_o_que_nao_e_jogo() {
        let m = pasta("epic");
        fs::write(m.join("a.item"), r#"{"DisplayName":"Fortnite","AppName":"Fortnite","AppCategories":["public","games","applications"]}"#).unwrap();
        fs::write(m.join("b.item"), r#"{"DisplayName":"Unreal Engine","AppName":"UE_5","AppCategories":["public","applications"]}"#).unwrap();
        fs::write(m.join("c.item"), r#"{"DisplayName":"Mau","AppName":"a&calc","AppCategories":["games"]}"#).unwrap();
        let j = jogos_da_epic(&m);
        assert_eq!(j.len(), 1);
        assert_eq!(j[0].alvo, "com.epicgames.launcher://apps/Fortnite?action=launch&silent=true");
    }

    #[test]
    fn atalhos_sao_criados_uma_vez_so() {
        let d = pasta("atalhos");
        let jogos = vec![JogoDePc { titulo: "Portal: 2?".into(), alvo: "steam://rungameid/620".into(), origem: "Steam" }];
        assert_eq!(escrever_atalhos(&d, &jogos).unwrap(), 1);
        assert_eq!(escrever_atalhos(&d, &jogos).unwrap(), 0);
        assert!(d.join("Portal 2 (Steam).url").is_file());
    }
}
