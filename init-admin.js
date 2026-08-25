const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "arizona-data.json");

const username = process.env.ADMIN_LOGIN;
const password = process.env.ADMIN_PASSWORD;

if (!username || !password) {
    console.log("ADMIN_LOGIN или ADMIN_PASSWORD не заданы.");
    process.exit(0);
}

function hash(password) {
    return crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");
}

let data = {
    users: [],
    leaders: [],
    deputies: [],
    penalties: [],
    supervisors: [],
    journal: []
};

if (fs.existsSync(FILE)) {
    try {
        data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    } catch {
        console.log("Ошибка чтения arizona-data.json");
        process.exit(1);
    }
}

data.users ??= [];
data.leaders ??= [];
data.deputies ??= [];
data.penalties ??= [];
data.supervisors ??= [];
data.journal ??= [];

let user = data.users.find(
    u => u.username?.toLowerCase() === username.toLowerCase()
);

if (user) {
    user.password = hash(password);
    user.role = "Разработчик";

    console.log(`Администратор ${username} обновлён.`);
} else {
    user = {
        id: Date.now(),
        username,
        password: hash(password),
        role: "Разработчик"
    };

    data.users.push(user);

    console.log(`Администратор ${username} создан.`);
}

fs.writeFileSync(
    FILE,
    JSON.stringify(data, null, 2)
);

console.log("Инициализация администратора завершена.");
