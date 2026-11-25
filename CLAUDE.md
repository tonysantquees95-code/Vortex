# Vortex (Android + Windows) — notas para quem mexe no código

## Regra de ouro: toda mudança de função vai para a tela "O que há de novo"
- Qualquer melhoria que mude o que o app faz ou como se usa (função nova, fluxo melhorado, correção de erro visível) ganha uma linha em `app/src/novidades.ts`.
- `id` = o maior id existente + 1; `tipo` = `novo`, `melhoria` ou `correcao`; `titulo` curto; `texto` em português simples, dizendo o que mudou para a pessoa (não o que mudou no código).
- A tela aparece sozinha depois da atualização e mostra só o que a pessoa ainda não viu (não depende do número da versão). Na primeira instalação ela não aparece: quem explica é a apresentação.
- O teste `app/teste/novidades.test.mjs` confere ids, tipos e textos.

## Apresentação da primeira abertura
- Tour (`app/src/tour.ts`, `telas/Tour.tsx`) → termos (`termos.ts`, `telas/Termos.tsx`) → configuração com as permissões explicadas (`telas/Configuracao.tsx`).
- Função nova: acrescente (ou ajuste) um passo em `TOUR`. Permissão nova: explique o porquê antes de pedir. Mudou o texto dos termos: suba `VERSAO_DOS_TERMOS`.
- A apresentação e os termos também ficam em Ajustes › Sobre.

## Teste visual das telas
- `app/teste-visual/telas.mjs` (motor) + `config.mjs` (telas a visitar) — `npm run build && npm run test:visual` abre o app (motor de demonstração, sem celular) em 7 tamanhos (celular pequeno até janela do Windows) e confere se cada tela e janela cabe, não estoura para o lado e se todo botão dá para alcançar. Roda na publicação e guarda as fotos como artefato `fotos-das-telas`.
- Tela ou janela nova: acrescente um cenário em `config.mjs`.

## Feedback e relato de erro
- Ajustes › Sobre tem "Enviar feedback" e "Reportar um erro": abrem `telas/FeedbackDoApp.tsx` (página do servidor `/feedback?app=vortex&v=<versão>&p=<plataforma>` num iframe, com o visual do app). Os relatos chegam no Painel Dev › Feedback. Windows: o CSP do `tauri.conf.json` precisa de `frame-src` do servidor. Cenário `feedback` no teste visual.

## Temas prontos, conquistas, continuar e funções dentro do jogo
- Temas prontos (`TEMAS_PRONTOS` em `app/src/tema.ts`, tela em Ajustes › Visual): cada um é só um pacote de cor, fundo, formato, cartas, ícones, brilho e luz; `aplicarPronto` nunca mexe em foto, capa, botões do jogo nem controles; `prontoAtual` marca qual está em uso. Fundos novos: `crt`, `vidro` (usa a capa em foco, bem desfocada) e `preto` (OLED). Tema novo = uma linha em `TEMAS_PRONTOS` (o teste confere ids e fundos válidos).
- Conquistas (`app/src/conquistas.ts`, lógica pura e testada; tela em Ajustes › Conquistas): tudo é calculado da biblioteca (jogos de Android instalados não contam); só se guarda quais a pessoa já viu (`vortex.conquistas.vistas`). Na primeira vez nada é "novo" (sem chuva de avisos). Conquista nova = uma linha em `REGRAS`.
- Continuar: o cartão `.continuar-cartao` (capa + tempo) aparece na prévia do Início e leva ao último jogo.
- Windows (RetroArch): `Configuracao.filtro` ("", crt, lcd, suave, nenhum) e `sem_retroceder`; `extras_retroarch` (`core/src/emuladores.rs`) acrescenta retroceder só nos consoles leves (`aceita_retroceder`), avanço rápido 4x, miniatura nos estados e a pasta `capturas`. Os atalhos de teclado são os padrões do RetroArch (F2/F4/F6/F7/R/Espaço/F8); com controle, Start+Select abre o menu. A tela é `AjustesDoJogo` (Ajustes › Emuladores) e a ponte é `motor.ajustesDeJogo`.
- Android (Game Bar, `GameBar.java` + `JogoActivity.java`): estados salvos em 3 espaços (`files/states/<jogo>-<n>.state`), "voltar 3 s/6 s" (só consoles leves, `LEVES`; guarda uma foto do estado a cada 0,5 s na memória), foto da tela por `PixelCopy` (Imagens › Vortex) e filtro de imagem (0 padrão do núcleo, 1 nítido, 2 suave, 3 TV de tubo, 4 LCD, por `ShaderConfig` com reflexão). Toda leitura/gravação de estado roda na linha do vídeo do jogo (`naLinhaDoJogo`), nunca no meio de um quadro. Só dá para testar de verdade no aparelho; o APK só compila no GitHub Actions.
- Estados e fotos ficam só no aparelho (não vão para a nuvem de saves).

## Vortex é grátis (decisão de 2026-11-25)
- Porta de entrada da Vetorial Tech: abre e joga sem login e sem pagamento. `telas/Portao.tsx` agora só repassa o app (a trava antiga em `trava.ts` ficou sem uso). O Vetorial ID é opcional (Ajustes › Conta) para saves na nuvem e ponte com a Vênus; o servidor libera `/vortex/*` para qualquer conta. Termos na versão 2. Recurso extra pago só se o Toni pedir.
