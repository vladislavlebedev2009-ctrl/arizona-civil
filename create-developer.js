const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "arizona-data.json");

function hash(password) {
    return crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");
}

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
    console.log("");
    console.log("Использование:");
    console.log("node create-developer.js LOGIN PASSWORD");
    console.log("");
    process.exit(1);
}

let data;

if (fs.existsSync(FILE)) {
    try {
        data = JSON.parse(
            fs.readFileSync(FILE, "utf8")
        );
    } catch (error) {
        console.log("Ошибка чтения arizona-data.json");
        process.exit(1);
    }
} else {
    console.log("arizona-data.json не найден.");
    console.log("Создаю новую базу...");

    data = {
        users: [],
        leaders: [],
        deputies: [],
        penalties: [],
        supervisors: [],
        journal: []
    };
}

if (!data.users) {
    data.users = [];
}

if (
    data.users.some(
        user =>
            user.username.toLowerCase() ===
            username.toLowerCase()
    )
) {
    console.log("");
    console.log("❌ Такой пользователь уже существует.");
    console.log("");
    process.exit(1);
}

data.users.push({
    id: Date.now(),
    username,
    password: hash(password),
    role: "Разработчик"
});

fs.writeFileSync(
    FILE,
    JSON.stringify(data, null, 2)
);

console.log("");
console.log("================================");
console.log("     РАЗРАБОТЧИК СОЗДАН");
console.log("================================");
console.log(`Логин: ${username}`);
console.log("Роль: Разработчик");
console.log("================================");
console.log("");
