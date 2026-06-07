# Telegram Softs Bot v1.2.5

Из-за ограничений одного сообщения полный проект (бот + FastAPI +
WebApp + SQLAlchemy + локализация) не помещается целиком.

Этот файл содержит стартовую структуру проекта для GitHub/Render:

``` text
project/
├── bot.py
├── config.py
├── requirements.txt
├── database/
│   ├── db.py
│   └── models.py
├── handlers/
│   ├── start.py
│   ├── orders.py
│   ├── marketing.py
│   └── profile.py
├── keyboards/
│   └── inline.py
├── api/
│   └── routes.py
├── webapp/
│   ├── index.html
│   ├── app.js
│   └── style.css
└── locales/
    ├── ru.json
    └── uz.json
```

Следующий шаг --- генерация файлов проекта по частям: 1. База данных и
модели. 2. FastAPI API. 3. Aiogram бот. 4. WebApp. 5. Render/GitHub
конфигурация.
