# BlackHole

Discord-бот на Node.js: экономика, магазин, модерация и панель авторизации.

## Что умеет

- Экономика: `/collect` `/bal` `/rob` `/pay` `/flip` `/dep` `/with` `/top` `/profile`
- Магазин: `/shop` `/buy` `/inv`
- Развлечения: `/8ball` `/roll` `/pick`
- Сервер: `/ping` `/avatar` `/user` `/server` `/help` `/settings`
- Мод: `/mod` `/give` `/take` `/authpanel` `/clear` `/slowmode`

`/pay`, `/dep`, `/with`, `/flip`, `/take` принимают `all`.

Префикс (`!collect`, `!pay all`) включается на сервере через `/settings prefix`. Если ответить на сообщение — цель подставится сама.

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
| `DATABASE_PATH` | файл экономики. По умолчанию `data/economy.sqlite`. На хостинге поставь путь на диск, который не стирается при деплое |
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

`/settings prefix` — только слэш или префикс+слэш на этом сервере. По умолчанию префикс включён.

`/give` и `/take` — владелец и модераторы из `/mod`.

База — SQLite в `data/economy.sqlite`. Старый файл `Database/database.sqlite` при старте копируется туда, балансы не обнуляются. На остановке WAL сбрасывается в основной файл.

Если бот на Render / Railway / Docker без тома — диск пустой после деплоя, экономика снова с нуля. Повесь volume и пропиши `DATABASE_PATH`, например `/data/economy.sqlite`. В логе при старте будет строка `Экономика: ...` — это актуальный путь.

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
