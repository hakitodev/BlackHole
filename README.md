# BlackHole

Discord-бот на Node.js: экономика, магазин, модерация и сайт с настройками.

## Что умеет

- Экономика: `/collect` `/bal` `/rob` `/pay` `/flip` `/dep` `/with` `/top` `/profile`
- Магазин: `/shop` `/buy` `/inv`
- Развлечения: `/8ball` `/roll` `/pick`
- Сервер: `/ping` `/avatar` `/user` `/server` `/help` `/settings`
- Мод: `/mod` `/give` `/take` `/authpanel` `/clear` `/slowmode`
- Сайт: префикс и приветствия без возни в чате

`/pay`, `/dep`, `/with`, `/flip`, `/take` принимают `all`.

Префикс (`!collect`, `!pay all`) включается на сервере через сайт или `/settings prefix`. Если ответить на сообщение — цель подставится сама.

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
| `CLIENT_ID` | Application ID из Discord Developer Portal, нужен для `npm run deploy` и сайта |
| `CLIENT_SECRET` | OAuth2 Secret приложения — без него сайт не пустит в Discord |
| `OWNER_ID` | Discord ID владельца. Если пусто, бот берёт владельца приложения |
| `PORT` | HTTP для сайта и health-check, по умолчанию `3000` |
| `PUBLIC_URL` | можно не ставить на Render — берётся сам. Иначе публичный адрес панели без слэша |
| `PREFIX` | префикс текстовых команд, по умолчанию `!` |
| `DATABASE_PATH` | файл экономики. По умолчанию `data/economy.sqlite`. На хостинге поставь путь на диск, который не стирается при деплое |
| `SERVERS_FILE` | путь к JSON с приветствиями (стартовые значения, дальше всё с сайта) |
| `SERVERS_JSON` | тот же конфиг строкой, если файла на хосте нет |

Privileged Gateway Intent **Server Members Intent** и **Message Content Intent** должны быть включены в портале — без первого не работают приветствия, без второго не работают префикс-команды.

```bash
npm run deploy   # один раз: публикует глобальные слэш-команды
npm start
```

`GET /health` отвечает `{ "ok": true }` — удобно для Render / Railway / Docker.
Сайт крутится на том же `PORT`.

## Сайт с настройками

Как у Juniper: логин через Discord, список своих серверов, форма префикса и welcome/leave.

Ссылка на панель — не из Discord. Это адрес сайта бота, вида `https://имя.onrender.com` (не `dashboard.render.com`).

На Render сверху на странице сервиса кликабельный `….onrender.com`. Бот подхватывает его сам: в логах `Сайт: https://….onrender.com`, в `/help` тоже.

В Discord → OAuth2 → Redirects вставь этот адрес + `/oauth/callback`, например `https://имя.onrender.com/oauth/callback`. В env нужен ещё `CLIENT_SECRET`.

Видеть и менять настройки можно только на серверах, где ты админ / владелец / Manage Server. Если бота ещё нет — кнопка инвайта.

Настройки пишутся в SQLite и сразу действуют: префикс-команды, канал и тексты входа/выхода. `{user}` — упоминание.

`/settings prefix` по-прежнему переключает префикс из Discord. Остальное удобнее с сайта. `/help` показывает ссылку, если задан `PUBLIC_URL`.

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

`{user}` заменяется на упоминание. Файл — стартовые значения при первом заходе бота на сервер. Дальше правь с сайта, повторно из файла не затрёт.

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

`/settings prefix` или сайт — только слэш или префикс+слэш на этом сервере. Префикс можно сменить (например `bh!`). По умолчанию префикс включён.

`/give` и `/take` — владелец и модераторы из `/mod`.

База — SQLite в `data/economy.sqlite`. Старый файл `Database/database.sqlite` при старте копируется туда, балансы не обнуляются. На остановке WAL сбрасывается в основной файл.

Если бот на Render / Railway / Docker без тома — диск пустой после деплоя, экономика снова с нуля. Повесь volume и пропиши `DATABASE_PATH`, например `/data/economy.sqlite`. В логе при старте будет строка `Экономика: ...` — это актуальный путь.

## Тесты

```bash
npm test
```

Проверяются `transfer`, `rob`, `flip`, пагинация топа, `collect`, разбор префикс-команд с ответом на сообщение, настройки гильдии и страницы сайта.

## Структура

```
Commands/   слэш-команды
Buttons/    кнопки (авторизация и топ)
Events/     ready, join, leave, prefix-команды
Database/   SQLite, экономика и настройки серверов
Web/        OAuth, список серверов, форма настроек
Utils/      staff, магазин, collect, префикс
servers.json
```

## Права бота

Минимум: отправка сообщений, эмбеды, Manage Roles (для `/authpanel`), Manage Messages и Manage Channels (для `/clear` и `/slowmode`).
