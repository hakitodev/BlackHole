const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Map();

const commandFiles = fs
    .readdirSync(path.join(__dirname, 'commands'))
    .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

client.buttons = new Map();

const buttonFiles = fs
    .readdirSync(path.join(__dirname, 'buttons'))
    .filter(file => file.endsWith('.js'));

for (const file of buttonFiles) {
    const button = require(`./buttons/${file}`);
    client.buttons.set(button.id, button);
}

const eventFiles = fs
    .readdirSync(path.join(__dirname, 'events'))
    .filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    client.on(event.name, (...args) => event.execute(client, ...args));
}

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        return command.execute(interaction);
    }
    if (interaction.isButton()) {
        const id = interaction.customId.split('_')[0];
        const button = client.buttons.get(id);
        if (!button) return;
        return button.execute(interaction);
    }
});

const economy = require("./database/economy");

(async () => {

    await economy.initDatabase();

    client.login(process.env.DISCORD_TOKEN);

})();

client.login(process.env.DISCORD_TOKEN);
