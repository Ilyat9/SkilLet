#!/bin/bash

echo "🚀 SkilLet Setup Script"
echo "======================"
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите Node.js 20+"
    exit 1
fi

echo "✅ Node.js: $(node -v)"
echo ""

# Проверка npm
echo "✅ npm: $(npm -v)"
echo ""

# Установка зависимостей
echo "📦 Установка зависимостей..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при установке зависимостей"
    exit 1
fi
echo ""

# Проверка переменных окружения
if [ ! -f .env.local ] || grep -q "твой_" .env.local; then
    echo "⚠️  ВНИМАНИЕ: Файл .env.local содержит заглушки"
    echo "   Обновите .env.local с реальными значениями из .env.example"
    echo ""
fi

echo "✅ Зависимости установлены!"
echo ""
echo "📝 Следующие шаги:"
echo "1. Заполните .env.local с реальными значениями"
echo "2. Создайте базу данных PostgreSQL"
echo "3. Запустите: npx prisma migrate dev"
echo "4. Запустите: npx prisma db seed"
echo "5. Запустите: npm run dev"
echo ""
