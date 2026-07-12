# Развёртывание — от чистого сервера до рабочей панели

Инструкция рассчитана на Ubuntu 22.04/24.04, но подходит для любого
Linux с systemd. Нужен домен, указывающий A-записью на IP сервера
(панель обязана открываться по HTTPS — так требует Telegram WebApp).

---

## 0. Что понадобится заранее

- Токен бота от [@BotFather](https://t.me/BotFather)
- Домен (например, `panel.example.com`), A-запись → IP сервера
- Открытые порты 80 и 443 (для Caddy/HTTPS)

---

## 1. Системные зависимости

```bash
sudo apt update
sudo apt install -y python3.12 python3.12-venv postgresql postgresql-contrib git unzip
```

## 2. Пользователь и директория приложения

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin moderatorbot
sudo mkdir -p /opt/telegram-moderator-bot
sudo chown moderatorbot:moderatorbot /opt/telegram-moderator-bot
```

Распакуйте проект в `/opt/telegram-moderator-bot` (например, скопируйте
содержимое ZIP-архива по SFTP или через `git clone`, если код в репозитории).

## 3. Виртуальное окружение

```bash
cd /opt/telegram-moderator-bot
sudo -u moderatorbot python3.12 -m venv venv
sudo -u moderatorbot ./venv/bin/pip install -r requirements.txt
```

## 4. База данных PostgreSQL

```bash
sudo -u postgres psql -c "CREATE USER bot_user WITH PASSWORD 'ЗАМЕНИТЕ_НА_СВОЙ_ПАРОЛЬ';"
sudo -u postgres psql -c "CREATE DATABASE moderator_bot OWNER bot_user;"
```

## 5. Конфигурация (.env)

```bash
sudo -u moderatorbot cp .env.example .env
```

Отредактируйте `/opt/telegram-moderator-bot/.env`:

| Переменная | Значение |
|---|---|
| `BOT_TOKEN` | токен от @BotFather |
| `WEBAPP_URL` | `https://your-domain.example.com` |
| `DATABASE_URL` | `postgresql+asyncpg://bot_user:ЗАМЕНИТЕ_НА_СВОЙ_ПАРОЛЬ@localhost:5432/moderator_bot` |
| `CORS_ALLOWED_ORIGINS` | `https://your-domain.example.com` |
| `ENVIRONMENT` | `production` |

Сгенерируйте секреты (выполнить на сервере, вставить результат в `.env`):

```bash
# SECRET_KEY
./venv/bin/python -c "import secrets; print(secrets.token_urlsafe(48))"

# FERNET_KEY
./venv/bin/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

`ROOT_ADMIN_IDS` уже проставлен по ТЗ (`8150331577,7979780050`) — менять
не нужно, если только это не тестовое окружение.

## 6. Миграции БД

```bash
cd /opt/telegram-moderator-bot
sudo -u moderatorbot ./venv/bin/alembic upgrade head
```

## 7. Systemd — автозапуск бота и API

```bash
sudo cp deploy/systemd/moderator-bot.service /etc/systemd/system/
sudo cp deploy/systemd/moderator-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now moderator-bot moderator-api
```

Проверка, что оба процесса живы:

```bash
sudo systemctl status moderator-bot moderator-api
journalctl -u moderator-api -f    # логи API в реальном времени
journalctl -u moderator-bot -f    # логи бота в реальном времени
```

## 8. HTTPS через Caddy (домен → панель)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Отредактируйте `deploy/Caddyfile` (замените `your-domain.example.com` на
реальный домен), затем:

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy сам получит сертификат Let's Encrypt при первом запросе на домен —
никаких дополнительных действий не требуется.

## 9. Подключение WebApp кнопки в боте

В чате с [@BotFather](https://t.me/BotFather):

```
/mybots → выбрать бота → Bot Settings → Menu Button → Configure Menu Button
```

Указать URL: `https://your-domain.example.com`

## 10. Проверка

1. Написать боту `/start` в личные сообщения — должен ответить.
2. Открыть кнопку меню — должна открыться панель, экран входа.
3. Ввести свой Telegram ID (один из `ROOT_ADMIN_IDS`) → пришёл код в бот → ввести код → должен открыться Dashboard.
4. Добавить бота администратором в тестовую группу — она должна появиться на вкладке «Группы».

---

## Обновление кода после изменений

```bash
cd /opt/telegram-moderator-bot
# скопировать новые файлы поверх старых
sudo -u moderatorbot ./venv/bin/pip install -r requirements.txt   # если изменились зависимости
sudo -u moderatorbot ./venv/bin/alembic upgrade head               # если были новые миграции
sudo systemctl restart moderator-bot moderator-api
```

## Резервное копирование БД

```bash
pg_dump -U bot_user -h localhost moderator_bot > backup_$(date +%Y%m%d).sql
```

Рекомендуется поставить эту команду в cron ежедневно.
