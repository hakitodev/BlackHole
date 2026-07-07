const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('authpanel')
        .setDescription('Authentication')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role')
                .setRequired(true)
        ),

    async execute(interaction) {

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
};
