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

const commands = [
  new SlashCommandBuilder()
    .setName('authpanel')
    .setDescription('Аунтификация')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Роль для выдачи')
        .setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const CLIENT_ID = '1107688235485896854';

async function deploy() {
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );
}

deploy();

const CONFIG = {
  '1103415582101098638': { // bots support
    channelId: '1103415582101098641',
    welcomeMessage: 'Привет, {user}!\nДля общения авторизуйся в <#1125863671655051274>',
    leaveMessage: 'Прощай, {user}'
  },
  '1137847512565301319': { // empire
    channelId: '1137847513546764330',
    welcomeMessage: 'Привет, {user}!\nРад, что ты зашел к нам',
    leaveMessage: 'Прощай, {user}'
  },
  '930865164000038943': { // tea studio
     channelId: '930907935176028200',
     welcomeMessage: '{user},\nДля общения авторизуйся в \nTo communicate, log in to\n<#943053808781651989>',
     leaveMessage: 'Прощай, {user}'
   }
};

client.once('ready', () => {
  console.log(`Bot is ready! Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild) return;

  if (interaction.commandName === 'authpanel') {
    const role = interaction.options.getRole('role');

    const button = new ButtonBuilder()
      .setCustomId(`auth_${role.id}`)
      .setLabel('🍀 Authentication')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(button);
    const embed = new EmbedBuilder()
    .setTitle('Authentication')
    .setDescription('To communicate, click the button below');

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('auth_')) {
    const roleId = interaction.customId.split('_')[1];
    const role = interaction.guild.roles.cache.get(roleId);

    if (!role) {
      return interaction.reply({
        content: '❌︙ERROR',
        ephemeral: true
      });
    }

    if (interaction.member.roles.cache.has(role.id)) {
return interaction.reply({
    content: '❌︙NOPE',
    ephemeral: true
  });
    }

    await interaction.member.roles.add(role);

    return interaction.reply({
      content: `🍀︙SUCCESS`,
      ephemeral: true
    });
  }
});

client.on('guildMemberAdd', async (member) => {
    const config = CONFIG[member.guild.id];
    if (!config) return;
    
    const channel = member.guild.channels.cache.get(config.channelId);
    if (!channel) return;
    
    const text = config.welcomeMessage.replace('{user}', `<@${member.id}>`);

    const embed = new EmbedBuilder()
    .setDescription(text);

    await channel.send({ embeds: [embed] });
});

client.on('guildMemberRemove', async (member) => {
    const config = CONFIG[member.guild.id];
    if (!config) return;
    
    const channel = member.guild.channels.cache.get(config.channelId);
    if (!channel) return;
    
    const text = config.leaveMessage.replace('{user}', `<@${member.id}>`);

    const embed = new EmbedBuilder()
    .setColor('#ED4245')
    .setDescription(text)

    await channel.send({ embeds: [embed] });
});

client.login(process.env.DISCORD_TOKEN);
