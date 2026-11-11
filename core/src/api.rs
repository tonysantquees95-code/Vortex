//! Interface única (JSON) do motor, usada pelo app de Windows (Tauri) e pelos testes. O Android implementa o mesmo contrato.
//! Todo comando recebe `biblioteca` (caminho do arquivo JSON da biblioteca) e devolve JSON.
use crate::biblioteca::{Biblioteca, Filtro, OpcoesEscaneamento};
use crate::plataformas::PLATAFORMAS;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn texto<'a>(v: &'a Value, campo: &str) -> Result<&'a str, String> {
    v.get(campo).and_then(|x| x.as_str()).filter(|s| !s.trim().is_empty()).ok_or_else(|| format!("Faltou informar: {campo}."))
}

fn arquivo_da_biblioteca(v: &Value) -> Result<PathBuf, String> {
    Ok(PathBuf::from(texto(v, "biblioteca")?))
}

fn agora(v: &Value) -> u64 {
    v.get("agora").and_then(|x| x.as_u64()).unwrap_or_else(|| SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0))
}

fn para<T: serde::Serialize>(x: T) -> Result<Value, String> {
    serde_json::to_value(x).map_err(|e| e.to_string())
}

pub fn executar(comando: &str, args: &Value) -> Result<Value, String> {
    if comando == "plataformas_catalogo" {
        return para(PLATAFORMAS);
    }
    let arquivo = arquivo_da_biblioteca(args)?;
    let mut b = Biblioteca::carregar(&arquivo);
    let t = agora(args);
    let mut mudou = false;
    let r = match comando {
        "pastas" => para(&b.pastas),
        "adicionar_pasta" => {
            b.adicionar_pasta(&PathBuf::from(texto(args, "pasta")?))?;
            mudou = true;
            para(&b.pastas)
        }
        "remover_pasta" => {
            let n = b.remover_pasta(&PathBuf::from(texto(args, "pasta")?));
            mudou = true;
            Ok(json!({ "jogos_removidos": n }))
        }
        "escanear" => {
            b.limpar_sessoes_velhas(t);
            let r = b.escanear(t, OpcoesEscaneamento { crc32: args.get("crc32").and_then(|x| x.as_bool()).unwrap_or(false) });
            mudou = true;
            para(r)
        }
        "listar" => {
            let f: Filtro = serde_json::from_value(args.get("filtro").cloned().unwrap_or(json!({}))).map_err(|e| format!("Filtro inválido: {e}"))?;
            para(b.buscar(&f))
        }
        "continuar" => para(b.continuar(args.get("limite").and_then(|x| x.as_u64()).unwrap_or(10) as usize)),
        "plataformas" => para(b.plataformas()),
        "estatisticas" => para(b.estatisticas()),
        "jogo" => b.jogos.get(texto(args, "id")?).map(para).unwrap_or_else(|| Err("Esse jogo não está mais na biblioteca.".into())),
        "favoritar" => {
            b.favoritar(texto(args, "id")?, args.get("favorito").and_then(|x| x.as_bool()).unwrap_or(true))?;
            mudou = true;
            Ok(json!({ "ok": true }))
        }
        "sessao_iniciar" => {
            b.iniciar_sessao(texto(args, "id")?, t)?;
            mudou = true;
            Ok(json!({ "ok": true, "inicio": t }))
        }
        "sessao_encerrar" => {
            let d = b.encerrar_sessao(texto(args, "id")?, t);
            mudou = true;
            Ok(json!({ "duracao_s": d }))
        }
        "registrar_tempo" => {
            let d = b.registrar_tempo(texto(args, "id")?, args.get("inicio").and_then(|x| x.as_u64()).unwrap_or(t), args.get("duracao_s").and_then(|x| x.as_u64()).unwrap_or(0));
            mudou = true;
            Ok(json!({ "duracao_s": d }))
        }
        "historico" => {
            let n = args.get("limite").and_then(|x| x.as_u64()).unwrap_or(50) as usize;
            para(b.historico.iter().rev().take(n).collect::<Vec<_>>())
        }
        outro => Err(format!("Comando desconhecido: {outro}")),
    };
    if mudou && r.is_ok() {
        b.salvar(&arquivo)?;
    }
    r
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::fs;

    #[test]
    fn fluxo_completo_pela_api() {
        let t = tempfile::tempdir().unwrap();
        fs::create_dir_all(t.path().join("roms/nes")).unwrap();
        fs::write(t.path().join("roms/nes/Contra (USA).nes"), "x").unwrap();
        fs::write(t.path().join("roms/nes/Zelda (USA).nes"), "y").unwrap();
        let bib = t.path().join("dados/biblioteca.json").to_string_lossy().to_string();
        let a = |extra: Value| {
            let mut o = json!({ "biblioteca": bib, "agora": 1000 });
            for (k, v) in extra.as_object().unwrap() {
                o[k] = v.clone();
            }
            o
        };
        assert!(executar("escanear", &a(json!({}))).is_ok() && executar("pastas", &a(json!({}))).unwrap().as_array().unwrap().is_empty());
        executar("adicionar_pasta", &a(json!({ "pasta": t.path().join("roms") }))).unwrap();
        let r = executar("escanear", &a(json!({}))).unwrap();
        assert_eq!(r["novos"], 2);
        let lista = executar("listar", &a(json!({ "filtro": { "texto": "contra" } }))).unwrap();
        assert_eq!(lista.as_array().unwrap().len(), 1);
        let id = lista[0]["id"].as_str().unwrap().to_string();
        assert_eq!(lista[0]["plataforma"], "nes");
        executar("favoritar", &a(json!({ "id": id }))).unwrap();
        assert_eq!(executar("jogo", &a(json!({ "id": id }))).unwrap()["favorito"], true);
        executar("sessao_iniciar", &a(json!({ "id": id, "agora": 2000 }))).unwrap();
        assert_eq!(executar("sessao_encerrar", &a(json!({ "id": id, "agora": 2300 }))).unwrap()["duracao_s"], 300);
        assert_eq!(executar("continuar", &a(json!({}))).unwrap().as_array().unwrap().len(), 1);
        assert_eq!(executar("estatisticas", &a(json!({}))).unwrap()["tempo_total_s"], 300);
        assert_eq!(executar("historico", &a(json!({}))).unwrap().as_array().unwrap().len(), 1);
        assert_eq!(executar("plataformas", &a(json!({}))).unwrap()[0]["total"], 2);
        assert!(executar("plataformas_catalogo", &json!({})).unwrap().as_array().unwrap().len() > 40);
        // persistiu no disco
        assert!(std::path::Path::new(&bib).is_file());
        assert_eq!(executar("remover_pasta", &a(json!({ "pasta": t.path().join("roms") }))).unwrap()["jogos_removidos"], 2);
    }

    #[test]
    fn erros_claros() {
        assert!(executar("listar", &json!({})).unwrap_err().contains("biblioteca"));
        let t = tempfile::tempdir().unwrap();
        let bib = t.path().join("b.json").to_string_lossy().to_string();
        assert!(executar("nada", &json!({ "biblioteca": bib })).unwrap_err().contains("desconhecido"));
        assert!(executar("favoritar", &json!({ "biblioteca": bib, "id": "x" })).unwrap_err().contains("não está"));
        assert!(executar("adicionar_pasta", &json!({ "biblioteca": bib, "pasta": "/nao/existe" })).is_err());
        assert!(executar("listar", &json!({ "biblioteca": bib, "filtro": { "ordem": "inventada" } })).unwrap_err().contains("Filtro"));
        assert!(!t.path().join("b.json").exists()); // erro não cria arquivo
    }
}
