#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."   # raiz do repo
REPO_DIR="$(pwd)"
INSTALL_DIR="${REPO_DIR}/selfhost"

mkdir -p "$INSTALL_DIR"

command -v docker >/dev/null 2>&1 || { echo "Docker não encontrado no PATH." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "'Docker compose' indisponível." >&2; exit 1; }

echo "=== Rodando a wizard oficial do LearnHouse (via container descartável) ==="

docker run --rm -it \
  -v "${REPO_DIR}:${REPO_DIR}" \
  -v "${INSTALL_DIR}:/root/.learnhouse" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -w "${REPO_DIR}" \
  node:22-alpine \
  sh -c "apk add --no-cache docker-cli docker-cli-compose >/dev/null && npx learnhouse@latest setup"

echo ""
echo "=== Corrigindo dono dos arquivos gerados (container rodou como root) ==="
docker run --rm -v "${INSTALL_DIR}:/data" alpine chown -R "$(id -u):$(id -g)" /data

echo ""
echo "=== Localizando e achatando os arquivos gerados ==="
GENERATED_COMPOSE="$(find "$INSTALL_DIR" -mindepth 2 -maxdepth 2 -name docker-compose.yml | head -n1)"
[[ -n "$GENERATED_COMPOSE" ]] || {
    echo "error: nenhum docker-compose.yml encontrado dentro de ${INSTALL_DIR}." >&2; exit 1;
}
GENERATED_DIR="$(dirname "$GENERATED_COMPOSE")"

shopt -s dotglob
mv "${GENERATED_DIR}"/* "$INSTALL_DIR"/
rmdir "$GENERATED_DIR"
shopt -u dotglob

COMPOSE_FILE="${INSTALL_DIR}/docker-compose.yml"
[[ -f "$COMPOSE_FILE" ]] || {
    echo "error: ${COMPOSE_FILE} não foi gerado." >&2; exit 1;
}
echo ""
echo "=== Ajustando ${COMPOSE_FILE} para buildar deste fork ==="
python3 - "$COMPOSE_FILE" <<'PYEOF'
import re, sys, pathlib
path = pathlib.Path(sys.argv[1])
text = path.read_text()
pattern = re.compile(r'^(\s*)image:\s*.*learnhouse.*$', re.MULTILINE)
replacement = (
    r'\1build:\n'
    r'\1  context: ..\n'
    r'\1  dockerfile: Dockerfile\n'
    r'\1  args:\n'
    r'\1    LEARNHOUSE_PUBLIC: "true"'
)
new_text, count = pattern.subn(replacement, text, count=1)
if count == 0:
    print("linha 'image:' esperada não encontrada, edite manualmente.", file=sys.stderr)
else:
    path.write_text(new_text)
    print(f"Substituída a linha de imagem por build: (context: ..).")
PYEOF

echo ""
echo "=== Subindo os serviços (build local) ==="
cd "$INSTALL_DIR"
docker compose build learnhouse-app
docker compose up -d
echo ""
echo "   Config editável em: ${INSTALL_DIR}/.env"
echo "   Compose em:         ${INSTALL_DIR}/docker-compose.yml"
echo "   Logs:                cd ${INSTALL_DIR} && docker compose logs -f"
