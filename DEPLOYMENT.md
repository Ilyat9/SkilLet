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

## Чеклист переменных окружения по средам

| Переменная | dev (`.env`) | production |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/skillet` | managed Postgres (Neon: `postgresql://…?sslmode=require`). Для serverless-деплоя добавить `?connection_limit=5&pool_timeout=10` (см. `.env.example`) |
| `AUTH_SECRET` | любой сгенерированный (`openssl rand -base64 32`) | **уникальный для прода**, не совпадающий с dev (см. «Ротация секретов») |
| `NEXTAUTH_URL` | `http://localhost:3000` | реальный домен: `https://skillet.example.com` |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | девовское GitHub OAuth App (callback `http://localhost:3000/api/auth/callback/github`) | **отдельное OAuth App для прода**, callback: `https://<домен>/api/auth/callback/github` |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` | опционально | опционально, только если нужна AI-генерация |
| `SENTRY_DSN` | не задан (трекинг выключен, ошибки в stdout) | опционально: DSN Sentry — необработанные ошибки API уходят в трекинг с route/userId/requestId |

Staging-окружение для этого масштаба не выделяется: достаточно dev + prod;
«предпродовой» проверкой служит CI (lint, типы, сборка, интеграционные тесты
на реальном Postgres) и локальный прогон образа через docker-compose.

В GitHub OAuth App для production обязательно укажите homepage URL и callback на боевой домен.

---

## Сценарий A: Docker + Neon

```bash
# 1. Собрать образ
docker build -t skillet .

# 2. Применить схему и сиды к managed Postgres (однократно)
DATABASE_URL="<neon-url>" npx prisma migrate deploy
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

Миграции выполняет one-off сервис `migrate` (`npx prisma migrate deploy && npx prisma db seed`).

## Сценарий C: Vercel (альтернатива)

1. Убрать `output: 'standalone'` из `next.config.ts`.
2. Импортировать репозиторий в Vercel (`vercel.json` уже есть).
3. Выставить переменные из чеклиста в Project Settings → Environment Variables.
4. Применить схему локально: `DATABASE_URL=<prod> npx prisma migrate deploy`.
5. Добавить prod callback URL в GitHub OAuth App.

---

## Health-check и мониторинг

- Эндпоинт: `GET /api/health` → `200 {status, db, latencyMs, version, uptimeSeconds, timestamp}`
  или `503` при недоступности БД. Каждый ответ несёт `X-Request-Id`.
- Бесплатный мониторинг аптайма: UptimeRobot → HTTP(s) монитор на `https://<домен>/api/health`,
  интервал 5 минут, алерт на email. Рост `latencyMs` по истории — ранний сигнал деградации БД.
- Логи ошибок API — единый JSON-формат (`timestamp/level/type/route/userId/requestId/message/stack`)
  через `src/shared/lib/logger.ts`. Каждый запрос имеет `requestId` (генерируется в
  `src/middleware.ts`, возвращается клиенту в `X-Request-Id`) — по нему все логи
  одного запроса собираются в цепочку.
- Бизнес-события (`type: 'business_event'`): `tree_created`, `ai_tree_generated`,
  `progress_marked`, `achievement_unlocked` — задел под аналитику без отдельной инфраструктуры.
- Error tracking: при заданном `SENTRY_DSN` необработанные исключения API и ошибки
  Prisma отправляются в Sentry (лёгкий envelope-транспорт без SDK, `src/shared/lib/errorTracking.ts`).

### Чеклист первых 10 минут после деплоя

1. `curl https://<домен>/api/health` — статус `ok`, `db: ok`, версия соответствует релизу.
2. UptimeRobot-монитор зелёный (или добавить его, если первый деплой).
3. Войти в приложение через GitHub → создать тестовое дерево → добавить узел →
   отметить прогресс. Каждое действие — без 5xx.
4. `docker logs skillet --since 10m` (или `docker-compose logs app`) — поискать
   `"level":"error"`; JSON-строки с `type: 'api_error'` разбирать по `requestId`.
5. Если подключён Sentry — в дашборде нет новых issues от этого релиза.
6. Проверить, что `prisma migrate deploy` применил все миграции:
   `DATABASE_URL=<prod> npx prisma migrate status` → «Database schema is up to date».

---

## Миграции БД

Схема применяется **только через миграции** (`prisma/migrations/`), история
коммитится в репозиторий. `prisma db push` в проде не используется.

- **Локальная разработка:** после изменения `schema.prisma` —
  `npm run db:migrate` (= `prisma migrate dev --name <имя>`), коммит папки
  `prisma/migrations` вместе с изменением схемы.
- **Прод (и любая не-dev БД):** только `prisma migrate deploy` — идемпотентная
  команда, применяет неприменённые миграции и ничего не трогает при повторном
  запуске. В docker-compose это делает one-off сервис `migrate` до старта приложения.
- **Никогда не запускать** `prisma migrate dev` на прод-БД: он может выполнить
  reset и сравнивает схему с датамоделем, а не только применяет историю.
- CI на каждый PR проверяет дрейф: `prisma validate` + `prisma migrate diff`
  между `prisma/migrations` и `schema.prisma` — рассинхрон ловится до мержа.

Порядок деплоя с миграцией: сначала `migrate deploy` (миграции пишутся
обратно-совместимо: сначала добавить колонку/таблицу, перейти, и только в
следующем релизе удалить старое), затем новая версия приложения.

## Откат деплоя

1. **Откат приложения:** запустить предыдущий образ
   (`docker run ... skillet:<предыдущий тег>` / в compose — `git checkout <пред. тег> && docker-compose up --build -d`).
   Откат на предыдущий релиз безопасен, если миграции нового релиза были
   обратно-совместимы (см. выше) — старый код работает с новой схемой.
2. **Если миграция уже применилась:** `prisma migrate deploy` не откатывает
   миграции — для этого нужен обратный down-мигрейт. На практике:
   - данные не пострадали → написать новую миграцию, возвращающую схему
     (`prisma migrate dev --name rollback_x` локально, затем `migrate deploy` в прод);
   - миграция применилась частично/упала → `prisma migrate resolve --rolled-back <имя>`
     после исправления, либо `--applied`, если изменения уже соответствуют состоянию БД;
   - крайний случай (только dev/тест): `prisma migrate reset` — стирает данные.
3. После отката — сверить `prisma migrate status` и health-check.

## Ротация секретов (AUTH_SECRET)

Сессии приложения — **JWT** (`session: { strategy: 'jwt' }` в
`src/shared/lib/auth.ts`): подписанный cookie, состояние в самом токене, БД для
валидации сессии не нужна.

Что произойдёт при смене `AUTH_SECRET`:

- все существующие сессии мгновенно становятся невалидными (подпись не сходится) —
  пользователи разлогинятся и просто войдут заново через GitHub; данные не
  затрагиваются, даунтайма для сервиса нет, только переавторизация;
- активные OAuth-сессии GitHub со стороны провайдера не ломаются — новый вход
  проходит тем же OAuth App.

Процедура (без даунтайма):

1. Сгенерировать новый секрет: `openssl rand -base64 32`.
2. Обновить `AUTH_SECRET` в окружении и перезапустить контейнер — единая точка
   смены, dual-secret поддержка в текущей версии не реализована (при таком
   масштабе переавторизация пользователей — приемлемая цена; «без даунтайма»
   возможно только с поддержкой двух ключей верификации — см. ARCHITECTURE.md,
   компромиссы).
3. После ротации проверить health-check и выполнить контрольный вход.

---

## Rate limiting

Мутирующие API-роуты защищены fixed-window лимитом за интерфейсом `RateLimiter`
(`src/shared/lib/rateLimit.ts`), текущая реализация — in-memory. Пресеты
(`RATE_LIMITS`): деревья 10/мин, шаблоны 5/мин, узлы/рёбра 60–120/мин,
прогресс 60/2 мин, AI-генерация 3/мин. Превышение — HTTP 429 + `Retry-After`.

Лимитер хранит состояние в памяти процесса — корректно для одного инстанса.
При горизонтальном масштабировании добавить Redis-backed реализацию `RateLimiter`
в `getRateLimiter()` — вызывающий код менять не нужно (см. ARCHITECTURE.md).

## Security

Заголовки настроены в `next.config.ts → headers()` (построчное обоснование
источников CSP — в комментариях там же):

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'` в CSP
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy`: `default-src 'self'`; script/style `'self' 'unsafe-inline'`
  (обязательные для Next.js App Router inline bootstrap и inline style ReactFlow);
  `img-src` допускает `api.dicebear.com` (аватары); сторонние origin больше нигде не открыты.

CSRF: сессионная cookie NextAuth v5 — `SameSite=Lax` по умолчанию, поэтому
кросс-сайтовые POST/PATCH/DELETE из чужих origin не несут сессию; NextAuth-эндпоинты
дополнительно защищены встроенным CSRF-токеном. CORS-политика не открывалась:
`Access-Control-Allow-Origin` нигде не выставляется.

Удаления (дерево/узел) — hard-delete с каскадом, на фронте требуют явного
confirm-диалога с перечислением того, что удалится каскадно.

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
# повторить шаги 2–3 из Сценария A (prisma migrate deploy идемпотентен)
```

Даунтайм при таком апдейте — секунды; для 1–2 пользователей более чем приемлемо.
