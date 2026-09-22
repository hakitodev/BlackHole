const { CLIENT_ID } = require("./Config");
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const commands = [];
const commandsPath = path.join(__dirname, "Commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    try {
        const command = require(path.join(commandsPath, file));
        commands.push(command.data.toJSON());
        console.log(`Загружена команда ${command.data.name}`);
    } catch (error) {
        console.error(`Ошибка в ${file}:`, error);
    }
}

if (!process.env.DISCORD_TOKEN) {
    console.error("DISCORD_TOKEN не найден");
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error("CLIENT_ID не найден");
    process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

async function deploy() {
    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );

        console.log(`Актуальные команды: ${commands.map(command => command.name).join(", ")}`);
    } catch (error) {
        console.error("Не удалось опубликовать команды:", error);
        process.exit(1);
    }
}

deploy();
