require("dotenv").config();

const { initDatabase, pool, query } = require("./db");

async function run() {
    try {
        await initDatabase();

        await query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS avatar_url TEXT
        `);

        await query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS vk TEXT
        `);

        await query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS organization VARCHAR(200)
        `);

        await query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS appointed_at TIMESTAMPTZ
        `);

        await query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS appointed_by VARCHAR(100)
        `);

        await query(`
            ALTER TABLE supervisors
            ADD COLUMN IF NOT EXISTS vk TEXT
        `);

        await query(`
            ALTER TABLE supervisors
            ADD COLUMN IF NOT EXISTS avatar_url TEXT
        `);

        await query(`
            ALTER TABLE supervisors
            ADD COLUMN IF NOT EXISTS supervisor_id BIGINT
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_supervisors_supervisor_id
            ON supervisors(supervisor_id)
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS appointments (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
                organization VARCHAR(200),
                role VARCHAR(100) NOT NULL,
                appointed_by VARCHAR(100),
                start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                end_date TIMESTAMPTZ,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS role_history (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
                old_role VARCHAR(100),
                new_role VARCHAR(100),
                changed_by VARCHAR(100),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS personnel_history (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
                action VARCHAR(150) NOT NULL,
                details TEXT DEFAULT '',
                actor VARCHAR(100),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS permissions (
                id BIGSERIAL PRIMARY KEY,
                role VARCHAR(100) NOT NULL,
                permission VARCHAR(150) NOT NULL,
                allowed BOOLEAN NOT NULL DEFAULT TRUE,
                UNIQUE(role, permission)
            )
        `);

        console.log("");
        console.log("========================================");
        console.log(" ARIZONA CIVIL 2.2 — MIGRATION COMPLETE");
        console.log("========================================");
        console.log("✅ users расширены");
        console.log("✅ supervisors расширены");
        console.log("✅ appointments");
        console.log("✅ role_history");
        console.log("✅ personnel_history");
        console.log("✅ permissions");
        console.log("✅ Старые данные сохранены");
        console.log("========================================");

    } catch (error) {
        console.error("❌ MIGRATION ERROR:");
        console.error(error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

run();
