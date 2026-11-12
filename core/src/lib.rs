//! Motor do Vortex (Vetorial Tech). Tudo que varre o disco, identifica jogos e guarda a biblioteca mora aqui,
//! com a mesma interface JSON para o app de Windows (Tauri) e para os testes. O Android implementa a ponte nativa.
pub mod hash;
pub mod plataformas;
pub mod titulo;
pub mod midia;
pub mod biblioteca;
pub mod api;
pub mod emuladores;
pub mod modo_jogo;
