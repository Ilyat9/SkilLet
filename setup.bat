@echo off
echo 🚀 SkilLet Setup Script
echo ======================
echo.

REM Проверка Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js не установлен. Установите Node.js 20+
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js: %NODE_VERSION%
echo.

REM Проверка npm
for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo ✅ npm: %NPM_VERSION%
echo.

REM Установка зависимостей
echo 📦 Установка зависимостей...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Ошибка при установке зависимостей
    pause
    exit /b 1
)
echo.

REM Проверка переменных окружения
if not exist .env.local (
    copy .env.example .env.local >nul
    echo ⚠️  Файл .env.local создан из .env.example
    echo    Обновите его с реальными значениями
    echo.
)

echo ✅ Зависимости установлены!
echo.
echo 📝 Следующие шаги:
echo 1. Заполните .env.local с реальными значениями
echo 2. Создайте базу данных PostgreSQL
echo 3. Запустите: npx prisma migrate dev
echo 4. Запустите: npx prisma db seed
echo 5. Запустите: npm run dev
echo.
pause
