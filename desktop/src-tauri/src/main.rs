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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![motor, instalar_atualizacao])
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
