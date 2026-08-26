const fs = require("fs");
const path = require("path");
const { initDatabase, query, pool } = require("./db");

const FILE = path.join(__dirname, "arizona-data.json");

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error("❌ DATABASE_URL не задан.");
        process.exit(1);
    }

    const data = JSON.parse(
        fs.readFileSync(FILE, "utf8")
    );

    if (!Array.isArray(data.users)) {
        console.error("❌ В arizona-data.json нет массива users.");
        process.exit(1);
    }

    await initDatabase();

    let inserted = 0;
    let updated = 0;

    for (const user of data.users) {
        if (!user.username || !user.password) {
            console.log(`⚠️ Пропущен пользователь без логина/пароля: ${user.id}`);
            continue;
        }

        const result = await query(
            `
            INSERT INTO users
                (id, username, password_hash, role, name, active)
            VALUES
                ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (username)
            DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                role = EXCLUDED.role,
                name = EXCLUDED.name,
                active = EXCLUDED.active
            RETURNING (xmax = 0) AS inserted
            `,
            [
                user.id,
                user.username,
                user.password,
                user.role || "Пользователь",
                user.name || "",
                user.active !== false
            ]
        );

        if (result.rows[0].inserted) {
            inserted++;
            console.log(`✅ Добавлен: ${user.username}`);
        } else {
            updated++;
            console.log(`🔄 Обновлён: ${user.username}`);
        }
    }

    // Последовательность BIGSERIAL должна быть выше максимального ID.
    await query(`
        SELECT setval(
            pg_get_serial_sequence('users', 'id'),
            COALESCE((SELECT MAX(id) FROM users), 1),
            true
        )
    `);

    const count = await query(
        "SELECT COUNT(*)::int AS count FROM users"
    );

    console.log("");
    console.log("================================");
    console.log("   МИГРАЦИЯ ЗАВЕРШЕНА");
    console.log("================================");
    console.log(`Добавлено: ${inserted}`);
    console.log(`Обновлено: ${updated}`);
    console.log(`Всего в PostgreSQL: ${count.rows[0].count}`);
    console.log("================================");

    await pool.end();
}

main().catch(async error => {
    console.error("❌ Ошибка миграции:");
    console.error(error);
    await pool.end();
    process.exit(1);
});
