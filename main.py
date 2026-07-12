"""
Точка входа процесса бота.

Запуск: python -m app.main
API-панель (aiohttp) запускается отдельным процессом: python -m app.api.main
Такое разделение позволяет масштабировать и перезапускать бота и API
независимо друг от друга.
"""

from __future__ import annotations

import asyncio
import logging
import signal

from app.bot.dispatcher import create_bot, create_dispatcher
from app.config import get_settings
from app.db.session import dispose_engine, get_session
from app.services.admin_service import AdminService
from app.services.antiflood_service import antiflood_service

_settings = get_settings()

logging.basicConfig(
    level=_settings.log_level,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("app.main")


async def _antiflood_sweep_loop() -> None:
    while True:
        await asyncio.sleep(600)
        await antiflood_service.sweep()


async def _bootstrap() -> None:
    """Гарантирует наличие главных администраторов в БД перед стартом polling."""
    async with get_session() as session:
        await AdminService(session).ensure_root_admins_exist()
    logger.info("Главные администраторы проверены/созданы")


async def main() -> None:
    await _bootstrap()

    bot = create_bot()
    dispatcher = create_dispatcher()

    sweep_task = asyncio.create_task(_antiflood_sweep_loop())

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    logger.info("Бот запущен, начинаю polling")
    polling_task = asyncio.create_task(dispatcher.start_polling(bot))

    await stop_event.wait()
    logger.info("Получен сигнал остановки, завершаю работу...")

    polling_task.cancel()
    sweep_task.cancel()
    await bot.session.close()
    await dispose_engine()
    logger.info("Бот остановлен")


if __name__ == "__main__":
    asyncio.run(main())
