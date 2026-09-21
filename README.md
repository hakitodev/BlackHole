# BlackHole

Discord-бот на Node.js: экономика, магазин, модерация и панель авторизации.

Кошелёк общий на все серверы. Наличные можно украсть через `/rob`, деньги в банке — нет.

## Что умеет

- Экономика: `/bal` `/daily` `/work` `/crime` `/rob` `/pay` `/flip` `/dep` `/with` `/top` `/profile`
- Магазин: `/shop` `/buy` `/inv`
- Развлечения: `/8ball` `/roll` `/pick`
- Сервер: `/ping` `/avatar` `/user` `/server` `/help`
- Модерация экономики: `/mod` `/give` `/take`
- Модерация сервера: `/authpanel` `/clear` `/slowmode`
- Приветствия и прощания по списку серверов в `servers.json`

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
| `DATABASE_PATH` | путь к SQLite, по умолчанию `Database/database.sqlite` |
| `SERVERS_FILE` | путь к JSON с приветствиями |
| `SERVERS_JSON` | тот же конфиг строкой, если файла на хосте нет |

Privileged Gateway Intent **Server Members Intent** должен быть включён в портале — без него не работают приветствия.

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
| `/daily` | 24 часа, 500 монет |
| `/work` | 45 минут |
| `/crime` | 2 часа |
| `/rob` | 90 минут, только наличные, у цели минимум 50 |

`/give` и `/take` доступны владельцу и модераторам из `/mod`. Права общие на все серверы.

База — SQLite, деньги ходят через транзакции. Параллельные `/pay`, `/rob` и `/flip` выполняются по очереди, чтобы две команды не открыли вложенный `BEGIN`. Это один процесс и один файл: второй инстанс бота с той же базой лучше не поднимать.

## Тесты

```bash
npm test
```

Проверяются `transfer`, `rob` и `flip`: обычные случаи, нехватка денег и гонки, чтобы баланс не уходил в минус.

## Структура

```
Commands/   слэш-команды
Buttons/    кнопки (панель авторизации)
Events/     ready, join, leave
Database/   SQLite и экономика
Utils/      staff, магазин, кулдауны
servers.json
```

## Права бота

Минимум: отправка сообщений, эмбеды, Manage Roles (для `/authpanel`), Manage Messages и Manage Channels (для `/clear` и `/slowmode`).
