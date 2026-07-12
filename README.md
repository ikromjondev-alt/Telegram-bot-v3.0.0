# Telegram Moderator Bot + WebApp Admin Panel

Production-бот модерации Telegram-групп с админ-панелью в стиле
Apple iOS 26 Liquid Glass.

## Возможности

- Модерация: мут, бан, кик, warn, антиспам, антифлуд, очистка сообщений
- Авторизация: Telegram ID → код подтверждения → JWT-сессия
- RBAC: Owner / Admin / Moderator / Viewer, неприкосновенные root-администраторы
- Dashboard с живой статистикой и системными метриками бота
- Управление группами, пользователями, рассылка (текст/фото/видео/документ/GIF)
- Полный аудит-лог всех действий
- WebApp панель на ru/uz с мгновенным переключением языка

## Стек

Python 3.12+ · aiogram 3 · aiohttp · PostgreSQL · SQLAlchemy 2 · Alembic ·
ванильные HTML/CSS/JS (без сборщиков) на фронтенде.

## Структура проекта

```
app/
  bot/            — Telegram-бот (aiogram): хендлеры, middlewares, антиспам/антифлуд
  api/            — aiohttp API для WebApp панели: роуты, middlewares
  services/       — бизнес-логика (модерация, авторизация, рассылки, RBAC)
  repositories/   — доступ к БД
  db/models/      — SQLAlchemy-модели
  core/           — безопасность (JWT, шифрование, rate-limit), исключения
webapp/           — WebApp панель (HTML/CSS/JS), раздаётся тем же процессом API
alembic/          — миграции БД
deploy/           — systemd-юниты, Caddyfile
```

## Быстрый старт (локально)

```bash
python3.12 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # заполнить BOT_TOKEN, DATABASE_URL, SECRET_KEY, FERNET_KEY

alembic upgrade head

python -m app.main       # процесс бота (отдельный терминал)
python -m app.api.main   # процесс API + WebApp (отдельный терминал)
```

Для полного продакшн-разворачивания (домен, HTTPS, systemd) — см. **[DEPLOY.md](DEPLOY.md)**.

## Два независимых процесса

Бот (`app.main`) и API (`app.api.main`) запускаются раздельно и
масштабируются/перезапускаются независимо друг от друга. WebApp-статика
раздаётся процессом API — отдельный веб-сервер для фронтенда не нужен.
