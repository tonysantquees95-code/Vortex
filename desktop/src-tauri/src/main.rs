#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use std::process::Command;
use tauri::Manager;

/// Acrescenta o arquivo da biblioteca (na pasta de dados do app) aos argumentos que a tela mandou.
fn com_biblioteca(args: Value, biblioteca: &std::path::Path, jogos: Option<&std::path::Path>) -> Value {
    let mut a = if args.is_object() { args } else { json!({}) };
    a["biblioteca"] = json!(biblioteca.to_string_lossy());
    if let Some(j) = jogos {
        if a.get("pasta_vortex").is_none() {
            a["pasta_vortex"] = json!(j.to_string_lossy());
        }
    }
    a
}

/// Ponte única entre a interface e o motor. Roda em outra thread para a janela não travar durante varreduras.
#[tauri::command]
async fn motor(app: tauri::AppHandle, comando: String, args: Value) -> Result<Value, String> {
    let pasta = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&pasta).map_err(|e| format!("Não consegui criar a pasta de dados: {e}"))?;
    // a pasta dos jogos organizados fica em Documentos\Vortex\Jogos, à vista da pessoa
    let jogos = app.path().document_dir().ok().map(|d| d.join("Vortex").join("Jogos"));
    let args = com_biblioteca(args, &pasta.join("biblioteca.json"), jogos.as_deref());
    tauri::async_runtime::spawn_blocking(move || vortex_core::api::executar(&comando, &args))
        .await
        .map_err(|e| e.to_string())?
}

/// Atualização do próprio Vortex no Windows: baixa o instalador (só do GitHub), confere o SHA-256, instala em silêncio e reabre.
#[tauri::command]
fn instalar_atualizacao(url: String, sha256: String) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("A atualização automática é só para Windows.".into());
    }
    let host_ok = url.strip_prefix("https://").and_then(|r| r.split('/').next()).map(|h| h == "github.com" || h.ends_with(".github.com") || h.ends_with(".githubusercontent.com")).unwrap_or(false);
    if !host_ok || url.chars().any(|c| c.is_whitespace() || c == '"' || c == '\'' || c == '`' || c == '$') {
        return Err("Endereço de atualização não permitido.".into());
    }
    if !sha256.is_empty() && !(sha256.len() == 64 && sha256.chars().all(|c| c.is_ascii_hexdigit())) {
        return Err("Assinatura da atualização inválida.".into());
    }
    let destino = std::env::temp_dir().join("VortexSetup-atualizacao.exe");
    let atual = std::env::current_exe().map_err(|e| e.to_string())?;
    // Tudo roda num PowerShell separado, para continuar depois que este app fechar. Os valores vão por variáveis de ambiente (sem montar texto de comando com eles).
    let roteiro = "$ErrorActionPreference='Stop'; \
        [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; \
        Invoke-WebRequest -Uri $env:V_URL -OutFile $env:V_SAIDA -UseBasicParsing; \
        if ($env:V_SHA -ne '' -and (Get-FileHash -Algorithm SHA256 $env:V_SAIDA).Hash -ne $env:V_SHA) { Remove-Item $env:V_SAIDA -Force; exit 3 }; \
        Start-Process -FilePath $env:V_SAIDA -ArgumentList '/S' -Wait; \
        Remove-Item $env:V_SAIDA -Force -ErrorAction SilentlyContinue; \
        Start-Process -FilePath $env:V_APP";
    Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-Command", roteiro])
        .env("V_URL", &url)
        .env("V_SAIDA", &destino)
        .env("V_SHA", sha256.to_uppercase())
        .env("V_APP", &atual)
        .spawn()
        .map_err(|e| format!("Não consegui iniciar a atualização: {e}"))?;
    // dá um respiro para o PowerShell começar e fecha o Vortex (o instalador também fecharia, mas assim não trava)
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_secs(20));
        std::process::exit(0);
    });
    Ok(())
}

// ---- Atualização em duas etapas (igual à Vênus): baixar com barra de andamento e, depois, instalar quando a pessoa escolher.
struct Baixando {
    filho: std::process::Child,
    saida: std::path::PathBuf,
    total: u64,
}
static BAIXANDO: std::sync::Mutex<Option<Baixando>> = std::sync::Mutex::new(None);
static BAIXADA: std::sync::Mutex<Option<std::path::PathBuf>> = std::sync::Mutex::new(None);

#[derive(serde::Serialize)]
struct ProgressoAtualizacao {
    /// "parada", "baixando", "pronta" ou "erro"
    estado: String,
    feitos: u64,
    total: u64,
    erro: String,
}

fn url_de_atualizacao_permitida(url: &str) -> bool {
    let host_ok = url.strip_prefix("https://").and_then(|r| r.split('/').next()).map(|h| h == "github.com" || h.ends_with(".github.com") || h.ends_with(".githubusercontent.com")).unwrap_or(false);
    host_ok && !url.chars().any(|c| c.is_whitespace() || c == '"' || c == '\'' || c == '`' || c == '$')
}

/// Começa a baixar o instalador (só do GitHub) numa tarefa separada. O andamento sai de `progresso_atualizacao`.
#[tauri::command]
fn baixar_atualizacao(url: String, sha256: String, tamanho: u64) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("A atualização automática é só para Windows.".into());
    }
    if !url_de_atualizacao_permitida(&url) {
        return Err("Endereço de atualização não permitido.".into());
    }
    if !sha256.is_empty() && !(sha256.len() == 64 && sha256.chars().all(|c| c.is_ascii_hexdigit())) {
        return Err("Assinatura da atualização inválida.".into());
    }
    let mut g = BAIXANDO.lock().map_err(|_| "Estado da atualização indisponível.".to_string())?;
    if g.is_some() {
        return Err("Já estou baixando a atualização.".into());
    }
    let saida = std::env::temp_dir().join("VortexSetup-atualizacao.exe");
    let _ = std::fs::remove_file(&saida);
    let roteiro = "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; \
        [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; \
        Invoke-WebRequest -Uri $env:V_URL -OutFile $env:V_SAIDA -UseBasicParsing; \
        if ($env:V_SHA -ne '' -and (Get-FileHash -Algorithm SHA256 $env:V_SAIDA).Hash -ne $env:V_SHA) { Remove-Item $env:V_SAIDA -Force; exit 3 }";
    let filho = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-Command", roteiro])
        .env("V_URL", &url)
        .env("V_SAIDA", &saida)
        .env("V_SHA", sha256.to_uppercase())
        .spawn()
        .map_err(|e| format!("Não consegui começar o download: {e}"))?;
    *g = Some(Baixando { filho, saida, total: tamanho });
    if let Ok(mut b) = BAIXADA.lock() {
        *b = None;
    }
    Ok(())
}

#[tauri::command]
fn progresso_atualizacao() -> ProgressoAtualizacao {
    let parado = |estado: &str, erro: &str| ProgressoAtualizacao { estado: estado.into(), feitos: 0, total: 0, erro: erro.into() };
    let Ok(mut g) = BAIXANDO.lock() else { return parado("erro", "Estado da atualização indisponível.") };
    let Some(b) = g.as_mut() else {
        return if BAIXADA.lock().map(|x| x.is_some()).unwrap_or(false) { parado("pronta", "") } else { parado("parada", "") };
    };
    let feitos = std::fs::metadata(&b.saida).map(|m| m.len()).unwrap_or(0);
    match b.filho.try_wait() {
        Ok(None) => ProgressoAtualizacao { estado: "baixando".into(), feitos, total: b.total, erro: String::new() },
        Ok(Some(st)) if st.success() && b.saida.is_file() => {
            let total = feitos;
            if let Ok(mut baixada) = BAIXADA.lock() {
                *baixada = Some(b.saida.clone());
            }
            *g = None;
            ProgressoAtualizacao { estado: "pronta".into(), feitos: total, total, erro: String::new() }
        }
        Ok(Some(st)) => {
            let erro = if st.code() == Some(3) { "O arquivo baixado não confere com o publicado. Nada foi instalado." } else { "Não consegui baixar a atualização. Confira a internet e tente de novo." };
            *g = None;
            parado("erro", erro)
        }
        Err(_) => {
            *g = None;
            parado("erro", "Não consegui acompanhar o download.")
        }
    }
}

/// Instala o que já foi baixado: instalador em silêncio e o Vortex abre de novo sozinho.
#[tauri::command]
fn instalar_atualizacao_baixada() -> Result<(), String> {
    let arquivo = BAIXADA.lock().map_err(|_| "Estado da atualização indisponível.".to_string())?.clone().ok_or("Ainda não há atualização baixada.")?;
    if !arquivo.is_file() {
        return Err("O arquivo baixado sumiu. Baixe de novo.".into());
    }
    let atual = std::env::current_exe().map_err(|e| e.to_string())?;
    let roteiro = "$ErrorActionPreference='Stop'; \
        Start-Process -FilePath $env:V_SAIDA -ArgumentList '/S' -Wait; \
        Remove-Item $env:V_SAIDA -Force -ErrorAction SilentlyContinue; \
        Start-Process -FilePath $env:V_APP";
    Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-Command", roteiro])
        .env("V_SAIDA", &arquivo)
        .env("V_APP", &atual)
        .spawn()
        .map_err(|e| format!("Não consegui iniciar a atualização: {e}"))?;
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_secs(20));
        std::process::exit(0);
    });
    Ok(())
}

/// Abre o Voxix numa janela própria, ao lado do Vortex (o Vortex continua rodando). Se já está aberta, só traz para a frente.
#[tauri::command]
fn abrir_voxix(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(j) = app.get_webview_window("voxix") {
        let _ = j.unminimize();
        let _ = j.show();
        return j.set_focus().map_err(|e| e.to_string());
    }
    tauri::WebviewWindowBuilder::new(&app, "voxix", tauri::WebviewUrl::App("voxix.html".into()))
        .title("Voxix · Gaming Chat")
        .inner_size(1000.0, 720.0)
        .min_inner_size(380.0, 560.0)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // quando o jogo fecha, o Vortex volta para a frente com o foco: sem isso o controle só volta a ser lido depois de um clique
            let h = app.handle().clone();
            vortex_core::api::definir_ao_fechar_jogo(move || {
                if let Some(j) = h.get_webview_window("main") {
                    let _ = j.unminimize();
                    let _ = j.show();
                    let _ = j.set_focus();
                    let _ = j.eval("window.focus(); window.dispatchEvent(new CustomEvent('vortex:jogo-fechou'));");
                }
            });
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![motor, instalar_atualizacao, baixar_atualizacao, progresso_atualizacao, instalar_atualizacao_baixada, abrir_voxix])
        .on_window_event(|janela, evento| {
            // fechar o Vortex fecha o Voxix junto; fechar só o Voxix não mexe no Vortex
            if janela.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { .. } = evento {
                    if let Some(v) = janela.app_handle().get_webview_window("voxix") { let _ = v.close(); }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("não foi possível iniciar o Vortex");
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn biblioteca_vai_junto_dos_argumentos() {
        let a = com_biblioteca(json!({ "id": "x" }), std::path::Path::new("/d/biblioteca.json"), Some(std::path::Path::new("/docs/Vortex/Jogos")));
        assert_eq!(a["pasta_vortex"], "/docs/Vortex/Jogos");
        assert_eq!(a["id"], "x");
        assert_eq!(a["biblioteca"], "/d/biblioteca.json");
        assert_eq!(com_biblioteca(Value::Null, std::path::Path::new("/d/b.json"), None)["biblioteca"], "/d/b.json");
    }
}
