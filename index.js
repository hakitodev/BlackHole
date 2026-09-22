require("./Config");

const { Client, GatewayIntentBits, Partials, Options } = require("discord.js");
const fs = require("fs");
const path = require("path");
const economy = require("./Database/Economy");
const { payload } = require("./Utils/reply");
const { runCommand, resolveCommand } = require("./Utils/runCommand");
const { customPayload } = require("./Utils/customEmbed");
const { remember } = require("./Utils/profile");
const xpBuffer = require("./Utils/xpBuffer");
const { forGuild } = require("./Utils/scope");
const { isOwner } = require("./Utils/staff");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message],
    makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        PresenceManager: 0,
        ReactionManager: 0,
        ThreadManager: 0,
        GuildScheduledEventManager: 0,
        MessageManager: 5
    })
});

client.commands = new Map();
client.buttons = new Map();
client.commandAliases = new Map([
    ["balance", "bal"],
    ["deposit", "dep"],
    ["withdraw", "with"],
    ["inventory", "inv"],
    ["coinflip", "flip"],
    ["cf", "flip"],
    ["ball", "8ball"],
    ["eightball", "8ball"]
]);

function load(folder, callback) {
    const folderPath = path.join(__dirname, folder);

    if (!fs.existsSync(folderPath)) return;

    const files = fs.readdirSync(folderPath).filter(file => file.endsWith(".js"));

    for (const file of files) {
        try {
            const module = require(path.join(folderPath, file));
            callback(module, file);
            console.log(`Loaded ${folder}/${file}`);
        } catch (error) {
            console.error(`Не удалось загрузить ${folder}/${file}:`, error);
        }
    }
}

load("Commands", command => {
    if (!command?.data?.name) return;
    client.commands.set(command.data.name, command);

    for (const alias of command.aliases ?? []) {
        client.commandAliases.set(String(alias).toLowerCase(), command.data.name);
    }
});

load("Buttons", button => {
    if (!button?.id) return;
    client.buttons.set(button.id, button);
});

load("Events", event => {
    if (!event?.name || typeof event.execute !== "function") return;

    const handler = (...args) => event.execute(client, ...args);

    if (event.once) {
        client.once(event.name, handler);
    } else {
        client.on(event.name, handler);
    }
});

client.on("interactionCreate", async interaction => {
    remember(interaction.user).catch(() => {});

    if (interaction.isAutocomplete()) {
        try {
            const command = resolveCommand(client, interaction.commandName);
            if (!command?.autocomplete) return;
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(error);
        }
        return;
    }

    if (interaction.isChatInputCommand()) {
        const command = resolveCommand(client, interaction.commandName);

        if (command) {
            await runCommand(command, interaction);
            return;
        }

        if (interaction.guild) {
            const settings = await economy.getGuildSettings(interaction.guild.id);
            if (settings.paused && !isOwner(interaction)) {
                await interaction.reply(payload({
                    description: "Сервер помечен как отключён.",
                    color: 0xED4245,
                    ephemeral: true
                })).catch(() => {});
                return;
            }
            const { scope } = await forGuild(interaction.guild.id);
            const user = await economy.getUser(interaction.user.id, scope);
            const owned = await economy.listBusinesses(interaction.user.id, scope);
            const custom = await economy.getCustomCommand(interaction.guild.id, interaction.commandName);
            if (custom) {
                const body = customPayload(custom, {
                    user: interaction.user,
                    guild: interaction.guild,
                    balance: user.balance,
                    level: user.level,
                    xp: user.xp,
                    businessCount: owned.length
                });
                if (body.content || body.embeds) {
                    await interaction.reply(body).catch(() => {});
                    return;
                }
            }
        }

        await interaction.reply(payload({
            description: "Команда устарела. Напиши `/` заново.",
            color: 0xED4245,
            ephemeral: true
        }));
        return;
    }

    if (interaction.isButton()) {
        try {
            const id = interaction.customId.split("_")[0];
            const button = client.buttons.get(id);
            if (!button) return;
            await button.execute(interaction);
        } catch (error) {
            console.error(error);

            const reply = payload({
                description: "Не удалось выполнить команду.",
                color: 0xED4245,
                ephemeral: true
            });

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply).catch(() => {});
            } else {
                await interaction.reply(reply).catch(() => {});
            }
        }
    }
});

async function shutdown(signal) {
    console.log(`Остановка (${signal})`);
    xpBuffer.stop();
    await xpBuffer.flush().catch(() => {});
    client.destroy();
    await economy.closeDatabase().catch(() => {});
    process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function startBot() {
    await economy.initDatabase();
    xpBuffer.start(client);

    if (!process.env.DISCORD_TOKEN) {
        console.warn("DISCORD_TOKEN не найден — бот не залогинен, сайт всё равно работает");
        return client;
    }

    await client.login(process.env.DISCORD_TOKEN);
    return client;
}

if (require.main === module) {
    startBot().catch(error => {
        console.error("Ошибка запуска:", error);
        process.exit(1);
    });
}

module.exports = {
    client,
    startBot
};
