# SkilLet — Skill Tree Learning Platform

**Преобразуйте изучение навыков в увлекательную игру с визуальными skill-деревьями**

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-blue)

[![GitHub Repo stars](https://img.shields.io/github/stars/Ilyat9/SkilLet?style=social)](https://github.com/Ilyat9/SkilLet)
[![GitHub followers](https://img.shields.io/github/followers/Ilyat9?style=social)](https://github.com/Ilyat9)

---

## 🌟 Что такое SkilLet

**SkilLet** — это интерактивная платформа для обучения навыков в формате RPG skill-tree. Превращайте скучное изучение новых технологий в увлекательную игру с визуальными деревьями прогресса, достижениями и системой наград.

### Ключевые возможности:

- 🎮 **Геймифицированное обучение** — изучайте навыки как RPG-персонажа
- 🌳 **Визуальные деревья** — интерактивные skill-деревья с ReactFlow
- 📊 **Прогресс-бары** — отслеживайте свой прогресс в реальном времени
- 🏆 **Система достижений** — награды за пройденные навыки
- 🔗 **Связи навыков** — понятная визуализация зависимостей
- 👥 **Публичные деревья** — вдохновляющие примеры от сообщества
- 🎯 **Умная фильтрация** — ищите нужные навыки по категориям

**Готово к использованию? Начните прямо сейчас!**

---

## 🚀 Начать пользоваться

### Шаг 1: Регистрация через GitHub

1. Запустите приложение локально (см. «Быстрый старт» ниже)
2. Нажмите **"Sign in with GitHub"**
3. Готово! Вы попадёте в дашборд с вашими деревьями

### Шаг 2: Создайте или выберите дерево

На странице **«Создать дерево»** доступны три способа:

- **Пустое дерево** — начните с чистого холста
- **Шаблоны** — Frontend / Backend / Data Science, импортируются одной транзакцией и становятся вашими
- **AI-генерация** — опишите тему, LLM построит готовое дерево из 8–20 узлов со связями и ресурсами

Либо откройте **Каталог** публичных деревьев сообщества.

### Шаг 3: Изучайте и отмечайте прогресс

1. Откройте дерево и выберите доступный узел
2. Изучите материал по ресурсу (видео/статья)
3. Отметьте узел пройденным — пререквизиты разблокируются
4. Получайте достижения 🏆 и поддерживайте streak 🔥

### Шаг 4: Отслеживайте статистику

На странице **Профиль**: суммарно пройдено узлов, создано деревьев,
серия дней изучения (текущая и рекордная) и все достижения.

---

## ✨ Функциональность MVP

Реализовано и работает:

- ✅ Авторизация через GitHub OAuth (NextAuth v5)
- ✅ Skill-деревья на ReactFlow с блокировкой узлов по пререквизитам (DAG без циклов)
- ✅ Полный CRUD деревьев, узлов и связей через REST API с zod-валидацией и проверкой прав
- ✅ Drag & Drop редактор: перетаскивание узлов с сохранением координат,
  панель узла (название, описание, сложность 1–10, ресурс видео/статья)
- ✅ Три способа создания дерева: вручную, из шаблона, AI-генерация по теме
  (OpenAI-совместимый API, ключ `OPENAI_API_KEY` в `.env`; без ключа фича
  предсказуемо недоступна)
- ✅ Достижения: «Первые шаги», «Дерево пройдено», «Марафонец», «Создатель»,
  «Архитектор связей» — проверяются на бэкенде при отметке прогресса
- ✅ Streak — серия дней изучения с логикой вчера/сегодня/сброс
- ✅ Публичный каталог `/explore` с поиском и сортировкой по популярности/дате
- ✅ Профиль пользователя со сводной статистикой
- ✅ Кнопка «Поделиться» (copy-to-clipboard) на публичных деревьях
- ✅ Оптимистичные обновления с откатом при ошибке сервера
- ✅ Адаптивная вёрстка: сайдбар прогресса превращается в bottom-sheet drawer на мобильных
- ✅ SEO-метаданные и Open Graph для страниц деревьев
- ✅ Юнит-тесты чистой бизнес-логики (`npm test`, vitest)

> 📸 **TODO: скриншот/GIF демо** — запланировано добавить автоматизированный
> screenshot через Playwright headless; сейчас актуальный вид проще всего
> оценить, запустив проект локально.

---

## 💻 Технологии

### Frontend Stack
- **Next.js 15** — современный React-фреймворк с App Router
- **React 19** — последние возможности React
- **TypeScript 5** — строгая типизация
- **Tailwind CSS 4** — utility-first CSS framework
- **ReactFlow** (@xyflow/react) — визуализация графов и деревьев

### Backend & Database
- **PostgreSQL** — реляционная база данных
- **Prisma ORM** — type-safe database client
- **NextAuth.js v5** — аутентификация через GitHub OAuth
- **Zod** — валидация данных

### Architecture
- **Feature-Sliced Design** — модульная архитектура
- **Server/Client boundaries** — правильная изоляция
- **Zero-Any Policy** — типобезопасный код
- **API-first approach** — REST API для фронтенда

### DevOps
- **Docker** — контейнеризация (app + PostgreSQL + one-off миграции)
- **GitHub Actions** — CI/CD (планируется)

---

## 🛠️ Деплой для разработчиков

### Предварительные требования

- Node.js 20+
- npm 10+
- PostgreSQL или Docker
- GitHub аккаунт для OAuth

### Быстрый старт (5 команд)

```bash
git clone https://github.com/Ilyat9/SkilLet.git && cd SkilLet
cp .env.example .env            # заполните AUTH_*, GITHUB_* ключи
docker-compose up -d postgres   # поднять PostgreSQL
npx prisma db push && npx prisma db seed
npm run dev                     # http://localhost:3000
```

Переменные окружения в `.env`:

```env
# База данных (обязательно)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/skillet"

# NextAuth (обязательно)
AUTH_SECRET="openssl rand -base64 32"
AUTH_GITHUB_ID="ваш_github_client_id"
AUTH_GITHUB_SECRET="ваш_github_client_secret"
NEXTAUTH_URL="http://localhost:3000"

# AI-генерация деревьев (опционально)
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"          # по умолчанию
OPENAI_BASE_URL="https://api.openai.com/v1"  # любой совместимый провайдер
```

Либо одной командой целиком в Docker: `docker-compose up --build`.

### Основные команды

```bash
npm run dev        # запустить dev сервер
npm run build      # production build
npm start          # production server
npm run lint       # проверка кода
npm run test       # юнит-тесты (vitest)
npm run format     # форматирование кода

# Prisma
npx prisma studio   # GUI база данных
npx prisma migrate dev  # миграции
npx prisma db seed      # seed данные
```

---

## 🚀 Деплой в продакшен

Основной сценарий: **self-hosted Docker (`output: 'standalone'`) + управляемый Postgres [Neon]**
(автобэкапы включены тарифом). Альтернатива — Vercel.

Краткий чеклист переменных окружения для прода:

```env
DATABASE_URL="postgresql://…@ep-xxx.neon.tech/skillet?sslmode=require"
AUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="https://<ваш-домен>"
AUTH_GITHUB_ID="<отдельное OAuth App для прода>"
AUTH_GITHUB_SECRET="<…>"
```

Полная инструкция (Docker/Vercel, callback URL GitHub, бэкапы `pg_dump`, мониторинг
`/api/health` через UptimeRobot) — в **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

---

## ♿ Доступность

Что поддерживается во фронтенде:

- **Полноценная навигация с клавиатуры**: узлы дерева и карточки деревьев активируются
  Enter/Space; во всех интерактивных элементах видимый focus-ring.
- **Модальные окна** (`role="dialog"`, `aria-modal`): focus trap (Tab не выходит за пределы),
  закрытие по Escape, автофокус внутрь и возврат фокуса на открывший элемент.
- **Прогресс-бары** — `role="progressbar"` с `aria-valuenow/min/max`.
- **aria-label на всех кнопках-иконках**, статусы узлов озвучиваются скринридерами
  («Навык «React Hooks», статус: доступен»), заблокированные узлы помечены `aria-disabled`.
- Тосты живут в `role="status" aria-live="polite"` — сообщения объявляются автоматически.
- **Семантические цветовые токены**, все пары текст/фон проверены калькулятором WCAG:
  обычный текст ≥ 4.5:1 (WCAG AA). Поддерживаются светлая и тёмная темы.
- Автоматическая проверка **axe-core** в dev-режиме (нарушения печатаются в консоль);
  в production код не подключается.

---

## 📁 Структура проекта

```
src/
├── app/              # Next.js App Router
│   ├── api/         # API endpoints
│   ├── auth/        # auth routes
│   ├── dashboard/   # личный кабинет пользователя
│   ├── tree/        # страницы деревьев
│   └── layout.tsx   # корневой layout
├── entities/        # бизнес-сущности
│   ├── tree/        # модели дерева
│   ├── node/        # модели узлов
│   └── edge/        # модели связей
├── features/        # фичи (функциональность)
│   ├── auth/        # аутентификация
│   ├── progress/    # трекинг прогресса
│   └── tree-builder/# конструктор деревьев
├── widgets/         # повторяемые компоненты
│   ├── SkillTreeViewer/
│   ├── ProgressSidebar/
│   └── Header/
├── shared/          # переиспользуемые части
│   ├── lib/         # утилиты и конфигурация
│   ├── ui/          # базовые компоненты
│   └── constants/   # константы
└── types/           # расширения TypeScript
```

---

## 🗺️ Roadmap

### ✅ MVP (реализовано)
- Авторизация через GitHub
- Просмотр skill-деревьев (ReactFlow) с DAG-пререквизитами
- Отметка навыков как пройденных (оптимистичные обновления)
- Полный CRUD деревьев/узлов/связей через API
- Drag & Drop редактор с ресурсами и сложностью узлов
- AI-генерация деревьев по теме + транзакционный импорт шаблонов
- Публичный каталог с поиском и сортировкой по популярности
- Достижения, streak, профиль со статистикой
- Кнопка «Поделиться», адаптивность, SEO-метаданные
- Seed данные и юнит-тесты ключевой логики

### 🚧 Next Features
- [ ] Скриншот/GIF демо в README (Playwright)
- [ ] Экспорт/импорт деревьев JSON
- [ ] Форки и наследование деревьев
- [ ] Комментарии и лайки в каталоге
- [ ] Postgres-based rate limiting для мульт инстансов

### 💡 Future Ideas
- [ ] PWA / нативное мобильное приложение
- [ ] Публичный API для интеграций
- [ ] Интеграция с YouTube/Notion на уровне прогресса
- [ ] Геймификация: уровни, опыт, ежедневные квесты

---

## 🤝 Вклад в проект

Вклад приветствуется! Вот как вы можете помочь:

1. Fork репозиторий
2. Создайте ветку (`git checkout -b feature/AmazingFeature`)
3. Сделайте коммит (`git commit -m 'Add AmazingFeature'`)
4. Запушьте ветку (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

### Правила кода
- TypeScript strict mode включён
- Zero-Any Policy
- Server/Client boundaries
- FSD (Feature-Sliced Design)
- Предпочтите React Flow hooks вместо inline handlers

---

## 📄 Лицензия

Этот проект распространяется под лицензией **MIT License**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

### Почему MIT?

- ✅ Прозрачность — полный доступ к коду
- ✅ Свобода — можно использовать в любых проектах
- ✅ Коммерция — можно монетизировать
- ✅ Поддержка — легко понять и доработать

### Что можно делать:
- ⬜ Использовать в коммерческих проектах
- ⬜ Модифицировать и распространять
- ⬜ Вносить изменения

### Требуется указание авторства:
- В комментариях в коде
- В документации
- В README (ссылка на оригинал)

---

## 📞 Поддержка

**Есть вопросы?** [Создайте Issue](https://github.com/Ilyat9/SkilLet/issues/new)

**Готовы помочь?** Формируйте Pull Requests!

### Контакты

- 💬 [Telegram](https://t.me/NeIlyat9) — обсуждение и вопросы
- 📧 Email: afrom205@gmail.com

---

**Станьте частью сообщества SkilLet!** 🚀

⭐ Поставьте звезду на GitHub, если проект вам понравился!

---

*Автор проекта: [Илья](https://github.com/Ilyat9)*
