# SkilLet — Skill Tree Learning Platform

Интерактивная платформа для обучения в формате RPG skill-tree. Превращайте изучение новых навыков в увлекательную игру с визуальными деревьями прогресса.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-blue)

[![GitHub Repo stars](https://img.shields.io/github/stars/Ilyat9/SkilLet?style=social)](https://github.com/Ilyat9/SkilLet)
[![GitHub followers](https://img.shields.io/github/followers/Ilyat9?style=social)](https://github.com/Ilyat9)

---

## 👤 Автор

**Илья** — Backend Developer & AI Builder

Backend-разработчик и создатель AI-систем, специализирующийся на быстрой сборке рабочих сервисов в продакшн.

- 🔗 [GitHub](https://github.com/Ilyat9)
- 💼 [CogniWeb Agent](https://github.com/Ilyat9/CogniWeb_Agent)
- 🏰 [Fortress API](https://github.com/Ilyat9/fortress-api)
- ⚡ [AI Summary](https://github.com/Ilyat9/ai-summary)
- 📧 Email: afrom205@gmail.com
- 💬 Telegram: [@NeIlyat9](https://t.me/NeIlyat9)

### Стек технологий автора

**Backend & Infra:** FastAPI · PostgreSQL · Redis · Celery · Docker · GitHub Actions
**AI & Automation:** LLM APIs (OpenRouter, Gemini) · Playwright · Prompt Engineering · Web Scraping
**Frontend & UI:** JavaScript (ES6+) · React · Tailwind

---

## Что это

SkilLet — это современное веб-приложение для создания и изучения skill-деревьев (деревьев навыков) в формате RPG. Вы можете:

- Создавать интерактивные деревья навыков с визуальными связями
- Отмечать навыки как пройденные и отслеживать прогресс
- Создавать собственные деревья или использовать готовые от сообщества
- Учитесь в игровой форме с наградами и прогресс-барами

## Стек технологий

- **Frontend:** Next.js 15, React 19, TypeScript 5
- **UI библиотека:** Tailwind CSS 4
- **База данных:** PostgreSQL + Prisma ORM
- **Аутентификация:** NextAuth.js v5 (GitHub OAuth)
- **Визуализация:** ReactFlow (@xyflow/react)
- **Типизация:** Zod schemas

## Быстрый старт

### Предварительные требования

- Node.js 20+ установлен
- PostgreSQL (локально или через Supabase)
- GitHub аккаунт для авторизации (автор: [@Ilyat9](https://github.com/Ilyat9))

### Установка

1. **Клонируйте репозиторий:**
```bash
git clone <your-repo-url>
cd SkilLet
```

2. **Установите зависимости:**
```bash
npm install
```

3. **Настройте переменные окружения:**
```bash
cp .env.example .env.local
```

Заполните `.env.local` следующими значениями:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/skillet"
AUTH_SECRET="сгенерируй-через-openssl-rand-base64-32"
AUTH_GITHUB_ID="твой_github_oauth_app_id"
AUTH_GITHUB_SECRET="твой_github_oauth_app_secret"
NEXTAUTH_URL="http://localhost:3000"
```

Для `AUTH_SECRET` используйте команду:
```bash
openssl rand -base64 32
```

4. **Создайте и заполните базу данных:**
```bash
npx prisma migrate dev
```

5. **Запустите seed (начальные данные):**
```bash
npx prisma db seed
```

6. **Запустите разработочный сервер:**
```bash
npm run dev
```

Откройте http://localhost:3000 в браузере.

## Деплой

### Вариант 1: Vercel (рекомендуется для MVP)

1. **Создайте репозиторий на GitHub** — [github.com/Ilyat9/SkilLet](https://github.com/Ilyat9/SkilLet)
2. **Учтите Vercel** в репозитории
3. **Deploy!**

Vercel автоматически настроит:
- Next.js build
- Production runtime
- Environment variables
- Environment preview deployments

### Вариант 2: Docker

```bash
docker compose up --build
```

### Вариант 3: Ручной деплой

1. **Создайте репозиторий на GitHub** — [github.com/Ilyat9/SkilLet](https://github.com/Ilyat9/SkilLet)
2. **Настройте Vercel** или выберите другой PaaS (Render, Railway и т.д.)
3. **Deploy!**

Vercel автоматически настроит:
- Next.js build
- Production runtime
- Environment variables
- Environment preview deployments

### Supabase (PostgreSQL)

1. Создайте проект на [supabase.com](https://supabase.com)
2. Получите строку подключения в Database Settings
3. Добавьте `DATABASE_URL` в Vercel environment variables
4. Настройте SSL: Production (require)

## Структура проекта

```
src/
├── app/              # Next.js App Router
│   ├── layout.tsx    # корневой layout
│   ├── page.tsx      # лендинг
│   ├── login/        # страница входа
│   ├── dashboard/    # список деревьев пользователя
│   └── tree/         # просмотр и создание деревьев
├── entities/         # бизнес-сущности
│   ├── tree/         # модель дерева
│   ├── node/         # модель узла
│   └── user/         # модель пользователя
├── features/         # фичи (действия пользователя)
│   ├── auth/         # аутентификация
│   ├── progress-tracker/  # трекинг прогресса
│   └── tree-builder/  # конструктор деревьев
├── widgets/          # сборные блоки страниц
├── shared/           # переиспользуемые компоненты
│   ├── lib/          # утилиты и конфигурация
│   ├── ui/           # базовые UI компоненты
│   └── constants/    # константы приложения
└── types/            # расширения типов
```

## Основные страницы

- `/` — главная страница с описанием платформы
- `/login` — страница авторизации через GitHub
- `/dashboard` — список ваших деревьев навыков
- `/tree/[id]` — просмотр и изучение конкретного дерева
- `/tree/new` — создание нового дерева

## Роадмап

### P0 — MVP (реализовано ✅)
- ✅ Авторизация через GitHub
- ✅ Просмотр дерева навыков (ReactFlow)
- ✅ Отметка узла как пройденного
- ✅ Полоска прогресса по дереву
- ✅ Список деревьев пользователя
- ✅ Seed данные (Frontend дерево с 16 узлами)

### P1 — Следующая итерация
- [ ] Конструктор деревьев (drag & drop)
- [ ] Публичные деревья с каталогом
- [ ] Ресурсы на узле (видео/статьи)

### P2 — Будущее
- [ ] AI генерация дерева
- [ ] Форки деревьев
- [ ] Комментарии к узлам
- [ ] Рейтинг и лайки

## Разработка

### Команды

```bash
npm run dev        # dev сервер
npm run build      # production build
npm start          # запустить production build
npm run lint       # проверка кода
npx prisma migrate dev  # создать миграцию
npx prisma db seed      # заполнить БД начальными данными
```

### Требования к коду

- TypeScript strict mode включён
- Zero-Any Policy: избегайте `any` типов
- Server/Client boundaries соблюдены
- FSD (Feature-Sliced Design) структура
- ReactFlow state в custom hook
- API responses с типизацией и ошибками

### Pre-commit hooks

Для автоматического форматирования и проверки кода при git commit:

```bash
# Установить pre-commit (если нужно)
pip install pre-commit

# Активировать hooks для проекта
pre-commit install

# Или использовать локальные hooks без установки
npx pre-commit install
```

Автоматически запускаются:
- **Prettier** — форматирование кода
- **ESLint** — проверка кода

После установки hooks:
```bash
# Git commit автоматически выполнит проверки
git commit -m "Add new feature"

# Если проверки пройдут — commit создастся
# Если нет — нужно исправить ошибки и попробовать снова
```

## Лицензия

Этот проект распространяется под лицензией [MIT License](LICENSE).

### Почему MIT?

- ✅ Прозрачность — полный доступ к исходному коду
- ✅ Свобода — можно использовать в любых проектах
- ✅ Коммерция — можно монетизировать модификации
- ✅ Поддержка — легко понять и доработать

### Что разрешено

- ⬜ Использовать в коммерческих проектах
- ⬜ Модифицировать и распространять
- ⬜ Вносить изменения и публиковать

### Что нужно указывать

При использовании этого кода в своём проекте нужно указывать автора:
- В комментариях в коде
- В документации
- В репозитории (GitHub stars, forks)
- В README (ссылка на оригинал)

## Поддержка

Если у вас есть вопросы, предложения или нашли баг — создайте issue в репозитории:

[🔗 Создать Issue](https://github.com/Ilyat9/SkilLet/issues/new)

### Контакты

- 💬 [Telegram](https://t.me/NeIlyat9) — вопросы и обсуждение
- 📧 Email: afrom205@gmail.com
- 🔗 [GitHub](https://github.com/Ilyat9)

### Как внести вклад

1. Fork репозиторий
2. Создайте ветку (`git checkout -b feature/amazing-feature`)
3. Сделайте коммит (`git commit -m 'Add amazing feature'`)
4. Запушьте ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

### Визуальное влияние

⭐ Звёзды на GitHub помогают развитию проекта!

---

## Спасибо

Благодарю всех участников проекта за участие и вклад.

---

*Создано с ❤️ командой SkilLet*
*Автор: [Илья](https://github.com/Ilyat9)*
