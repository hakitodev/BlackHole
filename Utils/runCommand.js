const { payload } = require("./reply");
const economy = require("../Database/Economy");
const { isDisabled } = require("./commands");
const { isEconomyCommand, isEarnCommand } = require("./eco");
const { isOwner } = require("./staff");

async function deny(interaction, text) {
    const reply = payload({
        description: text,
        color: 0xED4245,
        ephemeral: true
    });
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
    } else {
        await interaction.reply(reply).catch(() => {});
    }
}

async function runCommand(command, interaction) {
    try {
        const name = command.data?.name;
        if (interaction.guild && name) {
            const settings = await economy.getGuildSettings(interaction.guild.id);
            if (settings.paused && !isOwner(interaction)) {
                await deny(interaction, "Сервер помечен как отключён.");
                return;
            }
            if (isDisabled(settings, name)) {
                await deny(interaction, `Команда \`/${name}\` выключена на этом сервере.`);
                return;
            }
            if (isEconomyCommand(name) && settings.economyOn === false) {
                await deny(interaction, "Экономика выключена на этом сервере.");
                return;
            }
            if (isEarnCommand(name) && settings.earnOn === false) {
                await deny(interaction, "Получение денег выключено на этом сервере.");
                return;
            }
        }

        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await deny(interaction, "Не удалось выполнить команду.");
    }
}

function resolveCommand(client, name) {
    const normalized = String(name ?? "").toLowerCase();
    const key = client.commandAliases.get(normalized) ?? normalized;
    return client.commands.get(key) ?? null;
}

module.exports = {
    runCommand,
    resolveCommand
};
