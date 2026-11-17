# Vortex · Launcher de jogos e Game Space (Vetorial Tech)

Central de jogos retrô para **Android** e **Windows**. Encontra os jogos que a pessoa já tem, organiza por console, mostra capas, abre cada jogo com o emulador certo (já com o controle e a configuração certos) e guarda os saves na nuvem com o Vetorial ID.

Os APKs e instaladores saem do GitHub Actions: cada push na `main` testa tudo e publica uma release `1.N` com `Vortex.apk` e `VortexSetup.exe`.

## O que já funciona

**Biblioteca**
- Escaneia as pastas escolhidas (e o cartão de memória), identifica o console de cada jogo, monta as coleções com capas e guarda favoritos, "continuar jogando" e tempo de jogo.
- Organizador: cria uma pasta por console e move os jogos, com opção de **desfazer**. Acha jogos soltos e descompacta **ZIP, 7z e RAR** (inclusive ZIP com o nome trocado). Os caminhos do arquivo são conferidos para nada ser gravado fora da pasta.
- Faxina de arquivos e sugestões da Vênus (IA) para organizar e escolher a configuração do jogo.

**Jogar**
- Android: motor próprio (libretro) embutido; baixa o núcleo de cada console quando precisa e abre o jogo já com os controles virtuais certos para o console (analógico, botões, layout salvo por perfil). Barra de jogo (Game Bar) durante a partida.
- Windows: usa o RetroArch e outros emuladores (central de emuladores, instalação e configuração automática), com perfis de botões que valem nos jogos.
- Modo jogo no Windows: dá prioridade ao jogo e deixa em segundo plano o que é seguro (nunca mexe em sistema, segurança, áudio nem drivers); só aparece o plano, sem surpresa, e dá para recuperar o que mudou.
- Controle: mostra o controle conectado, busca o driver, ensina os botões e usa o controle para navegar em tudo. No Windows, sem controle, o teclado também navega.

**Loja e Steam**
- Loja com jogos homebrew gratuitos (catálogo curado, com conferência de integridade SHA-256 de cada arquivo).
- Steam dentro do Vortex e lista de jogos do Android instalados no aparelho.

**Conta e nuvem**
- Vetorial ID: login e licença com selo assinado (Ed25519), que o app confere inclusive sem internet.
- Saves sincronizados na nuvem, com escolha entre o do aparelho e o da nuvem quando há conflito.
- Integração com o Vetorial Drive (documentos e ROMs).
- Trava de segurança, apresentação na primeira abertura, termos e tela "O que há de novo".

**Visual**
- Início em vórtice, logo com luz de cor escolhida, fundo e tema personalizáveis, atualização com barra de download.

## Como o código está organizado

- `core/` — motor em Rust: biblioteca, plataformas, emuladores, organizador, limpeza, modo jogo, nuvem e a API de comandos em JSON (`api.rs`).
- `app/` — interface (React 19, Vite, TypeScript), a mesma no Android (Capacitor) e no Windows (Tauri).
- `android/` — parte nativa do Android em Java: motor de jogos, organizador, descompactação, nuvem, controles virtuais, Game Bar.
- `desktop/` — casca do Windows (Tauri, instalador NSIS).
- `catalogo/` — catálogo da loja (jogos gratuitos).
- `.github/workflows/` — `nucleo.yml` testa o motor; `app.yml` testa a interface e o motor do Android, gera o instalador e o APK e publica a release.

## Testes

- Interface: `cd app && npm test && npm run typecheck`
- Motor (Rust): `cargo test -p vortex-core`
- Motor do Android (Java, no computador): compilado e rodado pelo `app.yml`

Estado em 2026-11-17: 48 testes da interface, 111 do motor em Rust e 150 verificações do motor do Android passando.

## Limites conhecidos

- Não foi feita ainda uma bateria de testes em aparelhos reais variados (cada celular e cada controle se comporta de um jeito); a cobertura automática não substitui isso.
- Os núcleos de emulador do Android são baixados do servidor oficial do libretro (versão "latest", sem hash fixo). O Vortex confere o formato (ELF), o processador e o tamanho antes de usar, mas não há assinatura criptográfica; para isso seria preciso hospedar núcleos já conferidos nas releases do próprio repositório.
- Jogos de console exigem que a pessoa tenha os próprios arquivos de jogo e, em alguns consoles, a BIOS; o Vortex não distribui jogos comerciais.
- Ainda não há versão para Mac, Linux nem iPhone.

## Próximos passos

- Testar o caminho completo em aparelhos reais: instalar, achar jogo, abrir, salvar na nuvem.
- Hospedar os núcleos nas releases do repositório com SHA-256 fixo.
- Mais jogos no catálogo da loja e voz da Vênus dentro do Vortex.

## Regras para quem mexe no código

Veja o `CLAUDE.md`: toda mudança visível ganha uma linha em `app/src/novidades.ts`, e função nova ou permissão nova entra no tour da primeira abertura.
