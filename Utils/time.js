function formatDuration(ms) {
    const total = Math.max(1, Math.ceil(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    if (hours) {
        return minutes ? `${hours} ч. ${minutes} мин.` : `${hours} ч.`;
    }

    if (minutes) {
        return seconds && minutes < 5 ? `${minutes} мин. ${seconds} сек.` : `${minutes} мин.`;
    }

    return `${seconds} сек.`;
}

module.exports = {
    formatDuration
};
