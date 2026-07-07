const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const economy = require('./Economy');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Map();
client.buttons = new Map();

function load(folder, callback) {
    const folderPath = path.join(__dirname, folder);

    if (!fs.existsSync(folderPath)) return;

    const files = fs.readdirSync(folderPath)
        .filter(file => file.endsWith('.js'));

    for (const file of files) {
        const module = require(path.join(folderPath, file));
        callback(module);
    }
}

// Команды
load('commands', command => {
    client.commands.set(command.data.name, command);
});

// Кнопки
load('buttons', button => {
    client.buttons.set(button.id, button);
});

// События
load('events', event => {
    if (event.once) {
        client.once(event.name, (...args) => event.execute(client, ...args));
    } else {
        client.on(event.name, (...args) => event.execute(client, ...args));
    }
});

// Обработка Slash-команд и кнопок
client.on('interactionCreate', async interaction => {

    try {

        if (interaction.isChatInputCommand()) {

            const command = client.commands.get(interaction.commandName);

            if (!command) return;

            return await command.execute(interaction);

        }

        if (interaction.isButton()) {

            const id = interaction.customId.split('_')[0];

            const button = client.buttons.get(id);

            if (!button) return;

            return await button.execute(interaction);

        }

    } catch (error) {

        console.error(error);

        const reply = {
            content: '❌ Произошла ошибка при выполнении команды.',
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred)
            await interaction.followUp(reply).catch(() => {});
        else
            await interaction.reply(reply).catch(() => {});
    }

});

// Запуск
(async () => {

    try {
        console.log("1");
    
        await economy.initDatabase();
        console.log("2");

        await client.login(process.env.DISCORD_TOKEN);
        console.log("3");

    } catch (error) {

        console.error('Ошибка запуска:', error);

    }

})();
