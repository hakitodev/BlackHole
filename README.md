# BlackHole

Discord-бот на Node.js: экономика, магазин, модерация и панель авторизации.

Кошелёк общий на все серверы. Наличные можно украсть через `/rob` или `!rob` ответом на сообщение, деньги в банке — нет.

## Что умеет

- Экономика: `/collect` `/bal` `/rob` `/pay` `/flip` `/dep` `/with` `/top` `/profile`
- Магазин: `/shop` `/buy` `/inv`
- Развлечения: `/8ball` `/roll` `/pick`
- Сервер: `/ping` `/avatar` `/user` `/server` `/help`
- Модерация экономики: `/mod` `/give` `/take`
- Модерация сервера: `/authpanel` `/clear` `/slowmode`
- Приветствия и прощания по списку серверов в `servers.json`

Те же команды работают с префиксом (`!collect`, `!top`, `!rob`). Если ответить на сообщение человека и написать команду — он подставится как цель (`!rob`, `!pay 100`, `!bal`, `!avatar` и т.д.). `!daily`, `!work` и `!crime` тоже запускают collect.

## Запуск

Нужен Node.js 18+.

```bash
cp .env.example .env
cp servers.example.json servers.json
npm install
```

В `.env`:

| Переменная | Зачем |
| --- | --- |
| `DISCORD_TOKEN` | токен бота |
| `CLIENT_ID` | Application ID из Discord Developer Portal, нужен для `npm run deploy` |
| `OWNER_ID` | Discord ID владельца. Если пусто, бот берёт владельца приложения |
| `PORT` | HTTP для health-check, по умолчанию `3000` |
| `PREFIX` | префикс текстовых команд, по умолчанию `!` |
| `DATABASE_PATH` | путь к SQLite, по умолчанию `Database/database.sqlite` |
| `SERVERS_FILE` | путь к JSON с приветствиями |
| `SERVERS_JSON` | тот же конфиг строкой, если файла на хосте нет |

Privileged Gateway Intent **Server Members Intent** и **Message Content Intent** должны быть включены в портале — без первого не работают приветствия, без второго не работают префикс-команды.

```bash
npm run deploy   # один раз: публикует глобальные слэш-команды
npm start
```

`GET /health` отвечает `{ "ok": true }` — удобно для Render / Railway / Docker.

## Конфиг серверов

`servers.json` не про токен, а про то, куда писать welcome/leave:

```json
{
  "ID_СЕРВЕРА": {
    "channelId": "ID_КАНАЛА",
    "welcomeMessage": "Привет, {user}!",
    "leaveMessage": "Прощай, {user}"
  }
}
```

`{user}` заменяется на упоминание. Если сервера нет в файле — бот на нём молчит.

Для форка скопируй `servers.example.json` и подставь свои ID.

## Экономика

Один пользователь — один баланс на всех гильдиях, где стоит бот.

| Действие | Кулдаун |
| --- | --- |
| `/collect` ежедневка | 24 часа, 500 монет |
| `/collect` работа | 45 минут |
| `/collect` преступление | 2 часа, можно уйти в минус |
| `/rob` | 90 минут, только наличные, у цели минимум 50 |

`/top` листается кнопками ◀ ▶, отдельная кнопка переключает деньги и уровень.

`/give` и `/take` доступны владельцу и модераторам из `/mod`. Права общие на все серверы.

База — SQLite, деньги ходят через транзакции. Параллельные `/pay`, `/rob` и `/flip` выполняются по очереди, чтобы две команды не открыли вложенный `BEGIN`. Это один процесс и один файл: второй инстанс бота с той же базой лучше не поднимать.

## Тесты

```bash
npm test
```

Проверяются `transfer`, `rob`, `flip`, пагинация топа, `collect` и разбор префикс-команд с ответом на сообщение.

## Структура

```
Commands/   слэш-команды
Buttons/    кнопки (авторизация и топ)
Events/     ready, join, leave, prefix-команды
Database/   SQLite и экономика
Utils/      staff, магазин, collect, префикс
servers.json
```

## Права бота

Минимум: отправка сообщений, эмбеды, Manage Roles (для `/authpanel`), Manage Messages и Manage Channels (для `/clear` и `/slowmode`).
