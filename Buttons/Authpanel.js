module.exports = {

    id: 'auth',

    async execute(interaction) {

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
                content: '❌︙ALREADY',
                ephemeral: true
            });
        }

        await interaction.member.roles.add(role);

        return interaction.reply({
            content: '🍀︙SUCCESS',
            ephemeral: true
        });

    }

};
