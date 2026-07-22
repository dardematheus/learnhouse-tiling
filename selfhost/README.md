# LearnHouse — deploy Docker (sem npm/npx)

Bundle autossuficiente para subir o LearnHouse num servidor que **só tem Docker**
(sem Node/npm/npx/bun). Reproduz o que os comandos do CLI oficial fariam:

| CLI oficial (requer npm)         | Aqui (só Docker)                          |
| -------------------------------- | ----------------------------------------- |
| `npx learnhouse setup`           | `./setup.sh`                              |
| `npx learnhouse start`           | `docker compose up -d`                    |
| `npx learnhouse stop`            | `docker compose down`                     |
| `npx learnhouse logs`            | `docker compose logs -f`                  |
| `npx learnhouse update`          | `docker compose pull && docker compose up -d` |
| `npx learnhouse backup`          | `pg_dump` (ver §Backup)                   |

A imagem usada é a **pública e pré-compilada** `ghcr.io/learnhouse/app:latest` —
nada é buildado no servidor.

## Arquitetura neste cenário

```
Browser --https--> [ Caddy da borda (termina TLS) ] --http--> <VM>:${HTTP_PORT}
                                                                 |
                          contêiner learnhouse-app (nginx interno na :80)
                          ├─ /            -> Next.js (web)        :8000
                          ├─ /api/v1      -> FastAPI (backend)    :9000
                          ├─ /collab      -> collab (WebSocket)   :4000
                          ├─ /api/auth    -> FastAPI
                          └─ /content     -> FastAPI
                          depende de: db (pgvector) e redis
```

O TLS/HTTPS é terminado **na borda** pelo seu Caddy já existente. Aqui dentro
roda HTTP puro, mas as variáveis públicas (`NEXT_PUBLIC_LEARNHOUSE_HTTPS=True`,
URLs `https://`) fazem cookies seguros, redirects e o WebSocket do collab
funcionarem no navegador.

## Pré-requisitos

- Docker Engine + plugin **`docker compose`** (v2). Confira com `docker compose version`.
- Seu Caddy da borda conseguindo alcançar esta VM por HTTP na porta `HTTP_PORT`.

## Quick start

```bash
cd selfhost
./setup.sh                 # pergunta domínio/admin/etc, gera .env (com segredos)
                            # e pergunta se quer subir agora

# — ou, manualmente —
cp .env.example .env        # edite domínio, admin, e gere os 3 segredos com:
                            # openssl rand -base64 32
docker compose up -d
docker compose logs -f
```

Saúde:

```bash
curl http://localhost:${HTTP_PORT}/api/v1/health   # na própria VM
# pelo domínio público (já com TLS pelo Caddy):
curl https://learnhouse.exemplo.com/api/v1/health
```

No **primeiro boot** o app cria o schema e semeia a organização + admin a partir
de `LEARNHOUSE_INITIAL_ADMIN_*` / `LEARNHOUSE_INITIAL_ORG_*` (via `auto_install`).
Esses valores são usados **uma única vez**; depois disso, alterá-los no `.env`
não tem efeito. Faça login com o e-mail/senha do admin e troque a senha.

## Apontando o Caddy da borda

No seu Caddy (onde o TLS é terminado), adicione:

```caddyfile
learnhouse.exemplo.com {
    reverse_proxy <IP-DESTA-VM>:80
}
```

- O Caddy obtém/renova o certificado automaticamente.
- Ele já envia `X-Forwarded-Proto`, `X-Forwarded-For` e o `Host` original — é o
  que o app precisa para enxergar `https`.
- WebSocket do `/collab`: o Caddy e o nginx interno do app já tratam o upgrade
  (`wss://`) automaticamente.
- Se precisar de porta diferente de 80 nesta VM, troque `HTTP_PORT` no `.env`
  (ex: `HTTP_PORT=8090`) e use `reverse_proxy <IP>:8090`.

## Comandos do dia a dia

```bash
docker compose ps            # status
docker compose logs -f       # logs (todos)
docker compose logs -f learnhouse-app   # logs só do app
docker compose restart learnhouse-app   # reiniciar só o app
docker compose down          # parar (mantém volumes/dados)
docker compose down -v       # ⚠️ APAGA volumes (banco + conteúdo) — só para reset total
```

## Atualizar versão

```bash
docker compose pull          # baixa nova imagem
docker compose up -d         # recria com a nova imagem
```

Para **fixar versão** (recomendado em produção), defina no `.env`:

```env
APP_IMAGE=ghcr.io/learnhouse/app:1.0.1
```

> Migrações: deploys novos sobem o schema via `create_all` no primeiro boot.
> Ao **subir de versão** entre releases, podem ser necessárias migrações Alembic.
> Consulte as release notes; se preciso, rode dentro do contêiner:
> `docker compose exec learnhouse-app sh -c 'cd /app/api && uv run alembic upgrade head'`
> (faça backup do banco antes).

## Backup

Banco (formato compacto do `pg_dump`):

```bash
docker compose exec db pg_dump -U learnhouse learnhouse -Fc -f /tmp/dump \
  && docker compose cp db:/tmp/dump ./backup-$(date +%F).dump
```

Conteúdo enviado (volume `learnhouse_content`):

```bash
docker run --rm \
  -v "$(pwd)":/backup \
  -v learnhouse_learnhouse_content:/data \
  alpine tar czf /backup/content-$(date +%F).tar.gz -C /data .
```

Restore do banco:

```bash
docker compose cp ./backup-AAAA-MM-DD.dump db:/tmp/dump \
  && docker compose exec -T db pg_restore -U learnhouse -d learnhouse --clean --if-exists < /dev/null
# (preferencialmente com o app parado: docker compose stop learnhouse-app)
```

## Personalização

Tudo via `.env` (recrie/edite e rode `docker compose up -d`):

- **IA (Gemini):** `LEARNHOUSE_GEMINI_API_KEY=...` e `LEARNHOUSE_IS_AI_ENABLED=True`.
- **E-mail:** `LEARNHOUSE_EMAIL_PROVIDER=resend` + `LEARNHOUSE_RESEND_API_KEY=...`
  (ou `smtp` com `LEARNHOUSE_SMTP_HOST/PORT/...`).
- **S3 (em vez de filesystem):** `LEARNHOUSE_CONTENT_DELIVERY_TYPE=s3api` +
  `LEARNHOUSE_S3_API_BUCKET_NAME=...` (+ `LEARNHOUSE_S3_API_ENDPOINT_URL`). Ao
  usar S3, remova o volume `learnhouse_content` do `docker-compose.yml`.
- **OAuth Google:** `LEARNHOUSE_GOOGLE_CLIENT_ID/SECRET`.
- **Unsplash:** `NEXT_PUBLIC_UNSPLASH_ACCESS_KEY`.

### Banco / Redis externos

Para usar Postgres/Redis já existentes (fora do compose), remova (ou comente)
os serviços `db` e `redis` e o bloco `depends_on` do `learnhouse-app` no
`docker-compose.yml`, e ajuste no `.env`:

```env
LEARNHOUSE_SQL_CONNECTION_STRING=postgresql://user:pass@meu-host:5432/learnhouse
LEARNHOUSE_REDIS_CONNECTION_STRING=redis://meu-host:6379/learnhouse
LEARNHOUSE_REDIS_URL=redis://meu-host:6379
```

## Troubleshooting

- **`502` / healthcheck falha:** `docker compose logs learnhouse-app`. No primeiro
  boot aguarde o `start_period` (~90s) pela criação do schema.
- **Login não funciona / loop de redirect:** confira `NEXT_PUBLIC_LEARNHOUSE_HTTPS=True`,
  `NEXTAUTH_URL=https://<domínio>` e que o Caddy da borda está enviando
  `X-Forwarded-Proto: https` (padrão do Caddy).
- **WebSocket do editor não conecta:** confira `NEXT_PUBLIC_COLLAB_URL=wss://<domínio>/collab`
  e que o Caddy está fazendo `reverse_proxy` (não negando upgrade).
- **`413 Request Entity Too Large` em upload:** o limite interno é 6G; se aparecer
  na borda, suba `request_body { max_size 6GB }` no Caddy.
- **Reset completo (apaga tudo):** `docker compose down -v` e rode `./setup.sh` de novo.
