#!/usr/bin/env bash
# Assina o APK com a chave permanente deste repositório, guardada no servidor da Vênus (cifrada).
# Na primeira compilação a chave é criada e guardada; nas seguintes é reaproveitada: assim cada versão instala por cima da anterior.
# A identidade vem do token OIDC do GitHub Actions (precisa de "permissions: id-token: write"); não há segredo para cadastrar.
set -u
APK="$1"
URL="https://venus-servidor.tonysantquees95.workers.dev/ci/assinatura"
KS="assinatura.keystore"
aviso() { echo "::error::$1 Sem a chave permanente o APK não atualizaria por cima do instalado; compilação interrompida."; exit 1; }

[ -n "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ] || aviso "Faltou a permissão id-token neste trabalho."
TK=$(curl -fsS --retry 5 --retry-delay 10 -m 60 -H "Authorization: Bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=venus-assinatura" | jq -r .value) || aviso "Não consegui o token do GitHub."

pegar() {
  local r; r=$(curl -fsS --retry 6 --retry-delay 15 --retry-all-errors -m 60 -H "Authorization: Bearer $TK" "$URL") || return 1
  [ "$(echo "$r" | jq -r .existe)" = "true" ] || return 2
  echo "$r" | jq -r .keystore | base64 -d > "$KS"
  SENHA=$(echo "$r" | jq -r .senha)
}

pegar; rc=$?
if [ $rc -eq 2 ]; then
  SENHA=$(openssl rand -hex 24)
  keytool -genkeypair -keystore "$KS" -storetype PKCS12 -alias venus -keyalg RSA -keysize 4096 -validity 10000 \
    -storepass "$SENHA" -keypass "$SENHA" -dname "CN=Vetorial Tech, O=Vetorial Tech, L=Porto Alegre, ST=RS, C=BR" >/dev/null 2>&1 || aviso "Não consegui criar a chave."
  CORPO=$(jq -n --arg k "$(base64 -w0 "$KS")" --arg s "$SENHA" '{keystore:$k,senha:$s}')
  CODIGO=$(curl -sS -o /dev/null -w '%{http_code}' -X PUT -H "Authorization: Bearer $TK" -H 'content-type: application/json' -d "$CORPO" "$URL")
  if [ "$CODIGO" = "409" ]; then pegar || aviso "Outra compilação criou a chave ao mesmo tempo e não consegui ler."
  elif [ "$CODIGO" != "201" ]; then aviso "O servidor não guardou a chave ($CODIGO)."
  else echo "Chave de assinatura criada e guardada no servidor."; fi
elif [ $rc -ne 0 ]; then
  aviso "O servidor da Vênus não respondeu."
fi
echo "::add-mask::$SENHA"

BT=$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -n 1)
export SENHA
java -jar "$BT/lib/apksigner.jar" sign --ks "$KS" --ks-key-alias venus --ks-pass env:SENHA --key-pass env:SENHA "$APK" || { rm -f "$KS"; echo "::error::Falha ao assinar."; exit 1; }
java -jar "$BT/lib/apksigner.jar" verify --print-certs "$APK" | grep -E "SHA-256|Signer #1 certificate DN" | head -2
rm -f "$KS" "$APK.idsig"
