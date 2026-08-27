# Деплой SkilLet

Инструкция для продуктивного запуска на 1–2 пользователей («домашний прод»),
но с честной эксплуатационной базой: health-check, бэкапы, security-заголовки,
rate-limiting.

---

## Выбранный способ деплоя

**Основной сценарий: self-hosted через Docker (`output: 'standalone'`) + управляемый Postgres (Neon).**

Почему так:

- В проекте уже есть минимальный `Dockerfile` (multi-stage, standalone-сборка) и `docker-compose.yml`
  (postgres + one-off сервис миграций) — это готовая основа.
- `output: 'standalone'` рассчитан именно на self-hosted/контейнер. Для Vercel serverless он не нужен:
  если решите ехать через Vercel — уберите строку `output: 'standalone'` из `next.config.ts`
  (файл `vercel.json` уже подготовлен), а БД возьмите ту же Neon/Vercel Postgres.

### База данных: Neon (managed Postgres)

- Бесплатного тарифа достаточно для 1–2 пользователей.
- Автоматические ежедневные бэкапы и point-in-time recovery — из коробки, отдельный cron не нужен.
- Альтернатива при полном self-hosted: контейнер Postgres из docker-compose — тогда см. раздел «Бэкапы» ниже.

---

## Чеклист переменных окружения (production)

| Переменная | Значение |
|---|---|
| `DATABASE_URL` | строка подключения к managed Postgres (Neon: `postgresql://…?sslmode=require`) |
| `AUTH_SECRET` | `openssl rand -base64 32` (новый секрет для прода, не девовский!) |
| `NEXTAUTH_URL` | реальный домен, например `https://skillet.example.com` |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | **отдельное GitHub OAuth App для прода**, callback URL: `https://<домен>/api/auth/callback/github` |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` | опционально, только если нужна AI-генерация деревьев |

В GitHub OAuth App для production обязательно укажите homepage URL и callback на боевой домен.

---

## Сценарий A: Docker + Neon

```bash
# 1. Собрать образ
docker build -t skillet .

# 2. Применить схему и сиды к managed Postgres (однократно)
DATABASE_URL="<neon-url>" npx prisma db push
DATABASE_URL="<neon-url>" npx prisma db seed   # необязательно

# 3. Запустить
docker run -d --name skillet \
  -p 3000:3000 \
  -e DATABASE_URL="<neon-url>" \
  -e AUTH_SECRET="<openssl rand -base64 32>" \
  -e NEXTAUTH_URL="https://<домен>" \
  -e AUTH_GITHUB_ID="..." -e AUTH_GITHUB_SECRET="..." \
  --restart unless-stopped \
  skillet
```

HTTPS терминируется реверс-прокси перед контейнером (Caddy/Nginx/Traefik) —
Next Auth v5 требует HTTPS вне localhost.

## Сценарий B: всё в Docker Compose (включая Postgres)

```bash
docker-compose up --build -d        # postgres + миграции + приложение
```

Миграции выполняет one-off сервис `migrate` (`npx prisma db push && npx prisma db seed`).

## Сценарий C: Vercel (альтернатива)

1. Убрать `output: 'standalone'` из `next.config.ts`.
2. Импортировать репозиторий в Vercel (`vercel.json` уже есть).
3. Выставить переменные из чеклиста в Project Settings → Environment Variables.
4. Применить схему локально: `DATABASE_URL=<prod> npx prisma db push`.
5. Добавить prod callback URL в GitHub OAuth App.

---

## Health-check и мониторинг

- Эндпоинт: `GET /api/health` → `200 {"status":"ok","db":"ok",...}` или `503` при недоступности БД.
- Бесплатный мониторинг аптайма: UptimeRobot → HTTP(s) монитор на `https://<домен>/api/health`,
  интервал 5 минут, алерт на email.
- Логи ошибок API пишутся единым JSON-форматом (`level/type/route/timestamp/message/stack`)
  через `src/shared/lib/logger.ts` — при появлении внешнего error-tracking подключается одной точкой.

---

## Rate limiting

Публичные мутирующие API-роуты защищены in-memory sliding-window лимитом
(`src/shared/lib/rateLimit.ts`): создание деревьев (~20/мин), шаблоны (~7/мин),
узлы/рёбра/прогресс (60–120/мин). Превышение — HTTP 429 + `Retry-After`.

Лимитер хранит состояние в памяти процесса — этого достаточно для одного инстанса
на 1–2 пользователей. При горизонтальном масштабировании заменить на Redis.

---

## Security

Базовые заголовки настроены в `next.config.ts → headers()`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## Бэкапы

**Neon (рекомендуется):** автоматические ежедневные бэкапы и PITR включены тарифом —
восстановление через консоль Neon, ничего настраивать не нужно.

**Self-hosted Postgres:** ежедневный дамп по cron:

```bash
# crontab -e — ежедневно в 03:15, храним 14 дней
15 3 * * * docker exec skillet-db pg_dump -U postgres skillet | gzip > /var/backups/skillet-$(date +\%F).sql.gz
15 4 * * * find /var/backups -name 'skillet-*.sql.gz' -mtime +14 -delete
```

Восстановление:

```bash
gunzip -c /var/backups/skillet-2026-08-27.sql.gz | docker exec -i skillet-db psql -U postgres skillet
```

Обязательно один раз проверьте восстановление на тестовой базе — бэкап, который не
восстанавливали, не считается бэкапом.

---

## Обновления

```bash
git pull
docker build -t skillet .
docker stop skillet && docker rm skillet
# повторить шаги 2–3 из Сценария A (prisma db push идемпотентен)
```

Даунтайм при таком апдейте — секунды; для 1–2 пользователей более чем приемлемо.
