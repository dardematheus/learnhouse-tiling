#!/usr/bin/env bash
# =============================================================================
# LearnHouse — setup interativo para servidor só com Docker.
# Substitui `npx learnhouse setup` + `npx learnhouse start` SEM precisar de
# npm/npx/bun. Gera o .env (com segredos) e, opcionalmente, sobe os serviços.
#
# Uso interativo:
#   ./setup.sh
#
# Uso não-interativo (CI/automação) — defina as variáveis e pule os prompts:
#   LH_DOMAIN=learnhouse.exemplo.com LH_ADMIN_EMAIL=admin@exemplo.com \
#   LH_ADMIN_PASSWORD='senha-forte' ./setup.sh
#
# Variáveis opcionais (com defaults): LH_HTTP_PORT (80), LH_DB_PASSWORD (gerada),
# LH_ORG_NAME ("Default Organization"), LH_ORG_SLUG ("default"), LH_NO_START=1.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

# ---------- helpers ----------
rand_b64() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32
  else
    head -c 32 /dev/urandom | base64
  fi
}

# ask <varname> <default> <prompt>  (respeita valor já em $varname para CI)
ask() {
  local var="$1" def="$2" prompt="$3" val cur
  cur="${!var:-}"
  def="${cur:-$def}"
  read -rp "$prompt [$def]: " val || val=""
  val="${val:-$def}"
  printf -v "$var" '%s' "$val"
}

# ---------- pré-requisitos ----------
command -v docker >/dev/null 2>&1 || { echo "❌ docker não encontrado no PATH." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "❌ 'docker compose' (plugin) indisponível." >&2; exit 1; }

echo "=== LearnHouse setup ==="
echo "Cenário: HTTPS terminado no Caddy da borda; aqui roda HTTP puro."
echo ""

# ---------- prompts ----------
ask LH_DOMAIN "" "Domínio público (ex: learnhouse.exemplo.com)"
ask LH_HTTP_PORT "80" "Porta do host que esta VM expõe (Caddy da borda aponta pra cá)"
ask LH_ADMIN_EMAIL "" "E-mail do admin inicial"

# senha do admin (com confirmação) — a menos que já venha via LH_ADMIN_PASSWORD
if [[ -z "${LH_ADMIN_PASSWORD:-}" ]]; then
  while true; do
    read -rsp "Senha do admin inicial: " p1; echo
    read -rsp "Confirme a senha: " p2; echo
    if [[ -n "$p1" && "$p1" == "$p2" ]]; then LH_ADMIN_PASSWORD="$p1"; break; fi
    echo "⚠️  Senhas vazias ou não conferem. Tente novamente." >&2
  done
fi

ask LH_DB_PASSWORD "" "Senha do banco (vazio = gerar aleatoriamente)"
[[ -z "${LH_DB_PASSWORD:-}" ]] && LH_DB_PASSWORD="$(rand_b64)"

ask LH_ORG_NAME "Default Organization" "Nome da organização"
ask LH_ORG_SLUG "default" "Slug da organização"

# ---------- validação ----------
[[ -n "$LH_DOMAIN" ]]       || { echo "❌ Domínio é obrigatório." >&2; exit 1; }
[[ -n "$LH_ADMIN_EMAIL" ]]  || { echo "❌ E-mail do admin é obrigatório." >&2; exit 1; }

# ---------- derivados ----------
DOMAIN="$LH_DOMAIN"
if [[ "$DOMAIN" == "localhost" ]]; then
  TOP_DOMAIN="localhost"
  COOKIE_DOMAIN=".localhost"
else
  TOP_DOMAIN="$(awk -F. 'BEGIN{OFS="."}{n=NF; if(n>=2) print $(n-1),$n; else print $0}' <<<"$DOMAIN")"
  COOKIE_DOMAIN=".$TOP_DOMAIN"
fi
BASE_URL="https://$DOMAIN"        # TLS na borda (443, sem sufixo de porta)
COLLAB_URL="wss://$DOMAIN/collab"

NEXTAUTH_SECRET="$(rand_b64)"
JWT_SECRET="$(rand_b64)"
COLLAB_KEY="$(rand_b64)"

POSTGRES_USER="learnhouse"
POSTGRES_DB="learnhouse"
DB_CONN="postgresql://${POSTGRES_USER}:${LH_DB_PASSWORD}@db:5432/${POSTGRES_DB}"

# ---------- escreve .env ----------
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "host")"
(
  umask 077
  cat > .env <<EOF
# LearnHouse — gerado por setup.sh em ${TS}
# NÃO versione este arquivo (contém segredos).

# ===== Domain & Hosting =====
LEARNHOUSE_DOMAIN=${DOMAIN}
HTTP_PORT=${LH_HTTP_PORT}

# ===== Frontend (NEXT_PUBLIC_*) =====
NEXT_PUBLIC_LEARNHOUSE_API_URL=${BASE_URL}/api/v1/
NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL=${BASE_URL}/
NEXT_PUBLIC_LEARNHOUSE_DOMAIN=${DOMAIN}
NEXT_PUBLIC_LEARNHOUSE_TOP_DOMAIN=${TOP_DOMAIN}
NEXT_PUBLIC_LEARNHOUSE_MULTI_ORG=False
NEXT_PUBLIC_LEARNHOUSE_DEFAULT_ORG=${LH_ORG_SLUG}
NEXT_PUBLIC_LEARNHOUSE_HTTPS=True

# ===== NextAuth =====
NEXTAUTH_URL=${BASE_URL}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# ===== Backend =====
LEARNHOUSE_SQL_CONNECTION_STRING=${DB_CONN}
LEARNHOUSE_REDIS_CONNECTION_STRING=redis://redis:6379/learnhouse
LEARNHOUSE_REDIS_URL=redis://redis:6379
LEARNHOUSE_COOKIE_DOMAIN=${COOKIE_DOMAIN}
LEARNHOUSE_PORT=9000

# ===== Security =====
LEARNHOUSE_AUTH_JWT_SECRET_KEY=${JWT_SECRET}
LEARNHOUSE_INITIAL_ADMIN_EMAIL=${LH_ADMIN_EMAIL}
LEARNHOUSE_INITIAL_ADMIN_PASSWORD=${LH_ADMIN_PASSWORD}
LEARNHOUSE_INITIAL_ORG_NAME=${LH_ORG_NAME}
LEARNHOUSE_INITIAL_ORG_SLUG=${LH_ORG_SLUG}

# ===== Collaboration Server =====
COLLAB_INTERNAL_KEY=${COLLAB_KEY}
NEXT_PUBLIC_COLLAB_URL=${COLLAB_URL}

# ===== General =====
LEARNHOUSE_DEVELOPMENT_MODE=False
LEARNHOUSE_LOGFIRE_ENABLED=False
LEARNHOUSE_IS_AI_ENABLED=False
LEARNHOUSE_CONTENT_DELIVERY_TYPE=filesystem

# ===== Postgres (serviço db) =====
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${LH_DB_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
EOF
)
chmod 600 .env

echo ""
echo "✅ .env gerado com sucesso."
echo "   URL pública    : ${BASE_URL}"
echo "   Admin          : ${LH_ADMIN_EMAIL}"
echo "   Banco          : container 'db' (senha guardada em .env)"
echo "   Pasta host:porta: ${LH_HTTP_PORT} -> aponte o Caddy da borda para http://<ip>:${LH_HTTP_PORT}"
echo ""

# ---------- subir ----------
if [[ -z "${LH_NO_START:-}" ]]; then
  read -rp "Subir agora com 'docker compose up -d'? [S/n]: " yn
  if [[ ! "${yn:-S}" =~ ^[Nn]$ ]]; then
    docker compose pull
    docker compose up -d
    echo ""
    echo "✅ Serviços subindo. Acompanhe:  docker compose logs -f"
    echo "   Status:  docker compose ps"
    echo "   Saúde:   curl http://localhost:${LH_HTTP_PORT}/api/v1/health"
  else
    echo "Para subir depois:  docker compose up -d"
  fi
fi
