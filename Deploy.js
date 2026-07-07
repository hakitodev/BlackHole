const { REST, Routes } = require('discord.js');
const fs = require('fs');

const commands = [];

const commandFiles = fs.readdirSync('./commands');

for (const file of commandFiles) {
    try {
        const command = require(`./commands/${file}`);
        commands.push(command.data.toJSON());
        console.log(`✔ Загружена команда ${command.data.name}`);
    } catch (err) {
        console.error(`Ошибка в ${file}:`, err);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

console.log(commandFiles);
console.log(commands.map(c => c.name));

async function deploy() {
  await rest.put(
    Routes.applicationCommands('CLIENT_ID'),
    { body: commands }
  );

  console.log('Slash commands deployed');
}

deploy();
