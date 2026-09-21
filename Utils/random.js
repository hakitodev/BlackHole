function integer(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

module.exports = {
    integer,
    pick
};
