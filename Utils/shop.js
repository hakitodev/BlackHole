const ITEMS = {
    coffee: {
        id: "coffee",
        name: "Кофе",
        emoji: "☕",
        price: 80,
        description: "Маленький буст настроения"
    },
    pizza: {
        id: "pizza",
        name: "Пицца",
        emoji: "🍕",
        price: 250,
        description: "На всю компанию"
    },
    phone: {
        id: "phone",
        name: "Телефон",
        emoji: "📱",
        price: 3500,
        description: "Чтобы писать ещё чаще"
    },
    laptop: {
        id: "laptop",
        name: "Ноутбук",
        emoji: "💻",
        price: 8000,
        description: "Для серьёзной работы"
    },
    car: {
        id: "car",
        name: "Машина",
        emoji: "🚗",
        price: 35000,
        description: "Уже не пешком"
    },
    house: {
        id: "house",
        name: "Дом",
        emoji: "🏠",
        price: 120000,
        description: "Свой угол"
    },
    yacht: {
        id: "yacht",
        name: "Яхта",
        emoji: "🛥️",
        price: 500000,
        description: "Если совсем некуда деньги девать"
    }
};

function list() {
    return Object.values(ITEMS);
}

function get(id) {
    return ITEMS[id] ?? null;
}

function find(query) {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) {
        return null;
    }

    return get(q)
        ?? list().find(item =>
            item.name.toLowerCase() === q ||
            item.id.toLowerCase() === q
        )
        ?? null;
}

function format(item) {
    return `${item.emoji} ${item.name}`;
}

module.exports = {
    ITEMS,
    list,
    get,
    find,
    format
};
