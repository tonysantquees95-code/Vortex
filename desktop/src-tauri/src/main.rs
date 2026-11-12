#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use tauri::Manager;

/// Acrescenta o arquivo da biblioteca (na pasta de dados do app) aos argumentos que a tela mandou.
fn com_biblioteca(args: Value, biblioteca: &std::path::Path) -> Value {
    let mut a = if args.is_object() { args } else { json!({}) };
    a["biblioteca"] = json!(biblioteca.to_string_lossy());
    a
}

/// Ponte única entre a interface e o motor. Roda em outra thread para a janela não travar durante varreduras.
#[tauri::command]
async fn motor(app: tauri::AppHandle, comando: String, args: Value) -> Result<Value, String> {
    let pasta = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&pasta).map_err(|e| format!("Não consegui criar a pasta de dados: {e}"))?;
    let args = com_biblioteca(args, &pasta.join("biblioteca.json"));
    tauri::async_runtime::spawn_blocking(move || vortex_core::api::executar(&comando, &args))
        .await
        .map_err(|e| e.to_string())?
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![motor])
        .run(tauri::generate_context!())
        .expect("não foi possível iniciar o Vortex");
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn biblioteca_vai_junto_dos_argumentos() {
        let a = com_biblioteca(json!({ "id": "x" }), std::path::Path::new("/d/biblioteca.json"));
        assert_eq!(a["id"], "x");
        assert_eq!(a["biblioteca"], "/d/biblioteca.json");
        assert_eq!(com_biblioteca(Value::Null, std::path::Path::new("/d/b.json"))["biblioteca"], "/d/b.json");
    }
}
