require("./Config");

const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");
const economy = require("./Database/Economy");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Map();
client.buttons = new Map();

const COMMAND_ALIASES = {
    balance: "bal",
    deposit: "dep",
    withdraw: "with",
    inventory: "inv",
    coinflip: "flip",
    ball: "8ball",
    eightball: "8ball"
};

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
    if (interaction.isAutocomplete()) {
        try {
            const name = COMMAND_ALIASES[interaction.commandName] ?? interaction.commandName;
            const command = client.commands.get(name);
            if (!command?.autocomplete) return;
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(error);
        }
        return;
    }

    try {
        if (interaction.isChatInputCommand()) {
            const name = COMMAND_ALIASES[interaction.commandName] ?? interaction.commandName;
            const command = client.commands.get(name);

            if (!command) {
                await interaction.reply({
                    content: "Эта команда устарела. Напиши `/` заново или перезапусти Discord.",
                    ephemeral: true
                });
                return;
            }

            await command.execute(interaction);
            return;
        }

        if (interaction.isButton()) {
            const id = interaction.customId.split("_")[0];
            const button = client.buttons.get(id);
            if (!button) return;
            await button.execute(interaction);
        }
    } catch (error) {
        console.error(error);

        const reply = {
            content: "Произошла ошибка при выполнении команды.",
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply).catch(() => {});
        } else {
            await interaction.reply(reply).catch(() => {});
        }
    }
});

async function shutdown(signal) {
    console.log(`Остановка (${signal})`);
    client.destroy();
    await economy.closeDatabase().catch(() => {});
    process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

(async () => {
    try {
        await economy.initDatabase();

        if (!process.env.DISCORD_TOKEN) {
            throw new Error("DISCORD_TOKEN не найден");
        }

        await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        console.error("Ошибка запуска:", error);
        process.exit(1);
    }
})();
