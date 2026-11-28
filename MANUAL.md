# Manual — Vortex

> Escrito para a Vetorial Tech. Não contém segredos: só diz ONDE ficam. Visão de todos os apps: Manual da Vetorial Tech (Drive).

Emulador de jogos retrô, grátis, que só abre com o Vetorial ID. Contém o Voxix embutido.

## Onde fica cada coisa
- `core/src/*.rs` (Windows): `emuladores.rs` (RetroArch), `biblioteca.rs`, `nucleos.rs`, `nuvem.rs` (saves), `plataformas.rs`, `modo_jogo.rs`.
- `android/src/`: `JogoActivity.java`, `GameBar.java` (estados, voltar no tempo, filtros), `NucleosAndroid.java`, `VortexPlugin.java`, `VoxixActivity.java`.
- `app/src/` interface; `app/voxix.html` + `src/voxix/` = Voxix embutido. `catalogo/`: jogos e núcleos.

## Regras
- Estados salvos e fotos ficam só no aparelho. O APK só compila no GitHub; só se testa de verdade no aparelho.

## Padrão da suíte (vale para este app)
- `novidades.ts` / `Novidades.kt`: tela "O que há de novo"; `apresentacao.ts`: tour e termos (`VERSAO_DOS_TERMOS`).
- `teste/` (lógica) e `teste/seguranca.test.mjs` (segurança; se falha, a publicação para); `teste-visual/` (7 tamanhos).
- `FeedbackDoApp`: "Enviar feedback / Reportar erro" abre a página do servidor.
- Atualização por dentro: o app pergunta ao servidor `/atualizacao`, que olha as publicações (tags) deste repositório.
- A chave de assinatura dos APKs não está aqui: o fluxo pede ao servidor (`REPOS_PERMITIDOS`).


## Como voltar atrás se algo quebrar
- No GitHub: aba **Actions** mostra o fluxo vermelho; **Code › Commits** mostra o commit culpado; abra o commit e toque em **⋯ › Revert** (cria um commit novo que desfaz o anterior).
- O número da versão sempre sobe: a versão boa volta como número novo, nunca se republica um número antigo.
- Banco de dados e dados dos usuários não voltam com o código (migrações só andam para frente).

## Movimentações importantes
Uma linha por mudança que valha lembrar (a mais nova em cima). O Painel Dev também mostra os últimos commits automaticamente.

| Data | O que mudou | Onde |
| --- | --- | --- |
| 2026-11-28 | Emojis usados como ícone de tela viraram desenhos no padrão de ícones do app (apresentação, permissões e botões). Regra: ícone novo nunca é emoji; o teclado de emojis do chat continua. | `app/src/icones.tsx` e telas |
| 2026-11-27 | Manual criado | `MANUAL.md` |
