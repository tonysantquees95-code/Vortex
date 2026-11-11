//! Interface única (JSON) do motor, usada pelo app de Windows (Tauri) e pelos testes. O Android implementa o mesmo contrato.
//! Todo comando recebe `biblioteca` (caminho do arquivo JSON da biblioteca) e devolve JSON.
use crate::biblioteca::{Biblioteca, Filtro, OpcoesEscaneamento};
use crate::emuladores::{self, Ambiente, Configuracao, Lancamento, Preferido};
use crate::plataformas::PLATAFORMAS;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// Quem lê e grava a biblioteca (a tela e o vigia de jogo aberto) passa por aqui, uma de cada vez.
static BLOQUEIO: Mutex<()> = Mutex::new(());

fn agora_real() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn arquivo_de_configuracao(biblioteca: &Path) -> PathBuf {
    biblioteca.with_file_name("configuracao.json")
}

fn pasta_de_dados(biblioteca: &Path) -> PathBuf {
    biblioteca.parent().map(Path::to_path_buf).unwrap_or_default()
}

/// Abre o emulador e, quando ele fecha, soma o tempo jogado. Devolve o número do processo.
/// `relogio` dá a hora em segundos (nos testes é falso).
pub fn lancar_plano(plano: &Lancamento, biblioteca: PathBuf, id: String, relogio: impl Fn() -> u64 + Send + 'static) -> Result<u32, String> {
    let mut cmd = Command::new(&plano.programa);
    cmd.args(&plano.args).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    if let Some(d) = plano.diretorio.as_ref().filter(|d| d.is_dir()) {
        cmd.current_dir(d);
    }
    let mut filho = cmd.spawn().map_err(|e| format!("Não consegui abrir o emulador ({}): {e}", plano.programa.display()))?;
    let pid = filho.id();
    {
        let _g = BLOQUEIO.lock().unwrap_or_else(|e| e.into_inner());
        let mut b = Biblioteca::carregar(&biblioteca);
        b.iniciar_sessao(&id, relogio())?;
        b.salvar(&biblioteca)?;
    }
    std::thread::spawn(move || {
        let _ = filho.wait();
        let _g = BLOQUEIO.lock().unwrap_or_else(|e| e.into_inner());
        let mut b = Biblioteca::carregar(&biblioteca);
        b.encerrar_sessao(&id, relogio());
        let _ = b.salvar(&biblioteca);
    });
    Ok(pid)
}

fn plano_do_jogo(b: &Biblioteca, id: &str, biblioteca: &Path) -> Result<Lancamento, String> {
    let j = b.jogos.get(id).ok_or("Esse jogo não está mais na biblioteca.")?;
    let amb = Ambiente::atual();
    let cfg = Configuracao::carregar(&arquivo_de_configuracao(biblioteca));
    let instalados = emuladores::descobrir(&amb, &cfg);
    emuladores::planejar(&j.caminho, &j.plataforma, &instalados, &cfg, &amb, &pasta_de_dados(biblioteca))
}

fn texto<'a>(v: &'a Value, campo: &str) -> Result<&'a str, String> {
    v.get(campo).and_then(|x| x.as_str()).filter(|s| !s.trim().is_empty()).ok_or_else(|| format!("Faltou informar: {campo}."))
}

fn arquivo_da_biblioteca(v: &Value) -> Result<PathBuf, String> {
    Ok(PathBuf::from(texto(v, "biblioteca")?))
}

fn agora(v: &Value) -> u64 {
    v.get("agora").and_then(|x| x.as_u64()).unwrap_or_else(agora_real)
}

fn para<T: serde::Serialize>(x: T) -> Result<Value, String> {
    serde_json::to_value(x).map_err(|e| e.to_string())
}

pub fn executar(comando: &str, args: &Value) -> Result<Value, String> {
    if comando == "plataformas_catalogo" {
        return para(PLATAFORMAS);
    }
    let arquivo = arquivo_da_biblioteca(args)?;
    let _g = BLOQUEIO.lock().unwrap_or_else(|e| e.into_inner());
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
        "emuladores" => {
            let amb = Ambiente::atual();
            let cfg = Configuracao::carregar(&arquivo_de_configuracao(&arquivo));
            Ok(json!({ "instalados": emuladores::descobrir(&amb, &cfg), "configuracao": cfg, "android": emuladores::EMULADORES_ANDROID }))
        }
        "configurar" => {
            let ca = arquivo_de_configuracao(&arquivo);
            let mut c = Configuracao::carregar(&ca);
            if let Some(p) = args.get("retroarch") {
                c.retroarch = p.as_str().filter(|s| !s.trim().is_empty()).map(PathBuf::from);
            }
            if let Some(l) = args.get("pastas_extras").and_then(|x| x.as_array()) {
                c.pastas_extras = l.iter().filter_map(|x| x.as_str()).map(PathBuf::from).collect();
            }
            if let Some(v) = args.get("sem_shader").and_then(|x| x.as_bool()) {
                c.sem_shader = v;
            }
            if let Some(pl) = args.get("plataforma").and_then(|x| x.as_str()) {
                match args.get("emulador").and_then(|x| x.as_str()).filter(|s| !s.is_empty()) {
                    Some(e) => {
                        c.preferidos.insert(pl.to_string(), Preferido { emulador: e.to_string(), nucleo: args.get("nucleo").and_then(|x| x.as_str()).map(String::from) });
                    }
                    None => {
                        c.preferidos.remove(pl);
                    }
                }
            }
            c.salvar(&ca)?;
            para(c)
        }
        "plano_lancamento" => para(plano_do_jogo(&b, texto(args, "id")?, &arquivo)?),
        "lancar" => {
            let id = texto(args, "id")?.to_string();
            let plano = plano_do_jogo(&b, &id, &arquivo)?;
            drop(_g);
            let pid = lancar_plano(&plano, arquivo.clone(), id, agora_real)?;
            return Ok(json!({ "pid": pid, "emulador": plano.emulador, "nucleo": plano.nucleo }));
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
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;

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
    fn configurar_e_listar_emuladores() {
        let t = tempfile::tempdir().unwrap();
        let bib = t.path().join("d/biblioteca.json").to_string_lossy().to_string();
        let c = executar("configurar", &json!({ "biblioteca": bib, "plataforma": "snes", "emulador": "retroarch", "nucleo": "bsnes_libretro", "sem_shader": true })).unwrap();
        assert_eq!(c["preferidos"]["snes"]["nucleo"], "bsnes_libretro");
        assert_eq!(c["sem_shader"], true);
        let e = executar("emuladores", &json!({ "biblioteca": bib })).unwrap();
        assert_eq!(e["configuracao"]["preferidos"]["snes"]["emulador"], "retroarch");
        assert!(e["android"].as_array().unwrap().len() >= 10);
        let c = executar("configurar", &json!({ "biblioteca": bib, "plataforma": "snes", "emulador": "" })).unwrap();
        assert!(c["preferidos"].as_object().unwrap().is_empty());
        assert!(executar("plano_lancamento", &json!({ "biblioteca": bib, "id": "x" })).unwrap_err().contains("não está"));
    }

    #[cfg(unix)]
    #[test]
    fn lancar_registra_o_tempo_quando_o_emulador_fecha() {
        let t = tempfile::tempdir().unwrap();
        fs::create_dir_all(t.path().join("nes")).unwrap();
        fs::write(t.path().join("nes/Contra.nes"), "x").unwrap();
        let arquivo = t.path().join("biblioteca.json");
        let mut b = Biblioteca::default();
        b.adicionar_pasta(t.path()).unwrap();
        b.escanear(10, OpcoesEscaneamento::default());
        let id = b.jogos.keys().next().unwrap().clone();
        b.salvar(&arquivo).unwrap();
        let plano = Lancamento { emulador: "falso".into(), programa: PathBuf::from("sh"), args: vec!["-c".into(), "exit 0".into()], diretorio: Some(t.path().to_path_buf()), configuracao: None, nucleo: None };
        // relógio falso: a 1ª leitura é o início, as seguintes são o fim (100 s depois)
        let n = Arc::new(AtomicU64::new(0));
        let n2 = n.clone();
        lancar_plano(&plano, arquivo.clone(), id.clone(), move || if n2.fetch_add(1, Ordering::SeqCst) == 0 { 1000 } else { 1100 }).unwrap();
        for _ in 0..100 {
            std::thread::sleep(std::time::Duration::from_millis(50));
            if Biblioteca::carregar(&arquivo).jogos[&id].sessoes == 1 {
                break;
            }
        }
        let b = Biblioteca::carregar(&arquivo);
        assert_eq!(b.jogos[&id].tempo_total_s, 100);
        assert!(b.em_andamento.is_empty());
        let ruim = Lancamento { programa: PathBuf::from("programa-que-nao-existe-xyz"), ..plano };
        assert!(lancar_plano(&ruim, arquivo, id, || 1).unwrap_err().contains("Não consegui abrir"));
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
