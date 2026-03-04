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

1. Перейдите на **[SkilLet.app](https://skillet.app)** (или запустите локально)
2. Нажмите **"Sign in with GitHub"**
3. Разрешите доступ к вашему GitHub аккаунту
4. Готово! Вы сразу попадёте в личный кабинет

### Шаг 2: Выберите дерево для изучения

После входа вы увидите два демо-дерева:

- **Frontend Mastery** — дерево из 16 узлов для изучения фронтенда
  - HTML/CSS/JavaScript
  - React 19 & Next.js 15
  - TypeScript, Tailwind CSS
  - Redux Toolkit, Zustand
  - и многое другое

- **Soft Skills** — дерево для развития мягких навыков
  - Коммуникация
  - Командная работа
  - Тайм-менеджмент
  - Критическое мышление

### Шаг 3: Начните изучение

1. Откройте интересующее дерево
2. Выберите первый навык и нажмите на узел
3. Изучите материал и отметьте как пройденный
4. Откроются новые навыки и связи
5. Повторяйте пока не завершите всё дерево!

### Шаг 4: Создайте своё дерево

- Перейдите в **Dashboard** → **"Create Tree"**
- Добавляйте навыки, создавайте связи
- Делайте деревья публичными или личными
- Делитесь со всем миром!

---

## ✨ Возможности платформы

### Создание деревьев

- 🎨 Drag & Drop интерфейс для удобного редактирования
- ➕ Добавление любых типов навыков (технические, языки, навыки жизни)
- 🔗 Связывание навыков стрелками с настройкой направления
- 📝 Добавление описания и ресурсов к каждому навыку
- 🏷️ Визуальная настройка сложности и типа навыка
- 💾 Автоматическое сохранение прогресса

### Изучение деревьев

- 🎯 Чёткая визуализация прогресса
- 📈 Отображение пройденных и непройденных узлов
- 🔍 Фильтрация по категориям и сложности
- 📊 Прогресс-бар и статистика
- 🎁 Достижения и награды за завершение деревьев
- 💡 Рекомендованные пути к изучению

### Сообщество

- 🌐 Публичный каталог деревьев
- 🔍 Поиск и фильтрация по категориям
- ⭐ Рейтинг и лайки от сообщества
- 🔄 Форки и наследование деревьев
- 💬 Комментарии и обсуждения

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
- **Docker** — контейнеризация
- **PostgreSQL connection pooler** — масштабирование
- **GitHub Actions** — CI/CD (планируется)

---

## 🛠️ Деплой для разработчиков

### Предварительные требования

- Node.js 20+
- npm 10+
- PostgreSQL или Docker
- GitHub аккаунт для OAuth

### Быстрый старт

1. **Клонируйте репозиторий:**
```bash
git clone https://github.com/Ilyat9/SkilLet.git
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

Заполните `.env.local`:

```env
# База данных
DATABASE_URL="postgresql://user:password@localhost:5432/skillet"

# NextAuth
AUTH_SECRET="генерируйте через: openssl rand -base64 32"
AUTH_GITHUB_ID="ваш_github_client_id"
AUTH_GITHUB_SECRET="ваш_github_client_secret"

# URL приложения
NEXTAUTH_URL="http://localhost:3000"
```

**Сгенерируйте AUTH_SECRET:**
```bash
openssl rand -base64 32
```

4. **Настройте базу данных:**
```bash
# Локальная PostgreSQL
npx prisma migrate dev
npx prisma db seed

# Или через Docker (рекомендуется для разработчиков)
docker-compose up --build
```

5. **Запустите сервер:**
```bash
npm run dev
```

Откройте http://localhost:3000

### Основные команды

```bash
npm run dev        # запустить dev сервер
npm run build      # production build
npm start          # production server
npm run lint       # проверка кода
npm run format     # форматирование кода

# Prisma
npx prisma studio   # GUI база данных
npx prisma migrate dev  # миграции
npx prisma db seed      # seed данные
```

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
- Просмотр skill-деревьев (ReactFlow)
- Отметка навыков как пройденных
- Прогресс-бары и статистика
- Список деревьев пользователя
- Seed данные (Frontend дерево)

### 🚧 Next Features
- [ ] Drag & Drop конструктор деревьев
- [ ] Публичный каталог деревьев
- [ ] Ресурсы на узлах (видео, статьи)
- [ ] AI генерация деревьев
- [ ] Форки и наследование
- [ ] Комментарии и лайки

### 💡 Future Ideas
- [ ] Мобильная версия
- [ ] API для интеграций
- [ ] Статистика обучения
- [ ] Интеграция с YouTube/Notion
- [ ] Экспорт деревьев

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
