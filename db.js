const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.warn("DATABASE_URL не задан. PostgreSQL пока не подключён.");
}

const pool = new Pool({
    connectionString,
    ssl: connectionString
        ? { rejectUnauthorized: false }
        : false
});

async function query(text, params = []) {
    return pool.query(text, params);
}

async function initDatabase() {
    if (!connectionString) {
        console.log("PostgreSQL пропущен: DATABASE_URL не задан.");
        return;
    }

    await query(`
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role VARCHAR(100) NOT NULL DEFAULT 'Пользователь',
            name VARCHAR(150) DEFAULT '',
            position VARCHAR(200) DEFAULT '',
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_users_username
        ON users (LOWER(username))
    `);

    console.log("PostgreSQL: таблица users готова.");

    await query(`
        CREATE TABLE IF NOT EXISTS audit_log (
            id BIGSERIAL PRIMARY KEY,
            actor VARCHAR(100) NOT NULL,
            action VARCHAR(150) NOT NULL,
            details TEXT DEFAULT '',
            target_user_id BIGINT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_audit_created_at
        ON audit_log(created_at DESC)
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_audit_actor
        ON audit_log(actor)
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_audit_target_user
        ON audit_log(target_user_id)
    `);


    await query(`
        CREATE TABLE IF NOT EXISTS leaders (
            id BIGINT PRIMARY KEY,
            organization VARCHAR(200) NOT NULL,
            name VARCHAR(150) DEFAULT '',
            nickname VARCHAR(150) DEFAULT '',
            position VARCHAR(200) DEFAULT '',
            start_date DATE,
            end_date DATE,
            status VARCHAR(100) DEFAULT 'Активен',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_leaders_organization
        ON leaders(organization)
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_leaders_status
        ON leaders(status)
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS deputies (
            id BIGINT PRIMARY KEY,
            leader_id BIGINT REFERENCES leaders(id) ON DELETE SET NULL,
            organization VARCHAR(200) NOT NULL,
            name VARCHAR(150) DEFAULT '',
            nickname VARCHAR(150) DEFAULT '',
            position VARCHAR(200) DEFAULT '',
            start_date DATE,
            end_date DATE,
            status VARCHAR(100) DEFAULT 'Активен',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_deputies_leader
        ON deputies(leader_id)
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_deputies_organization
        ON deputies(organization)
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_deputies_status
        ON deputies(status)
    `);

}

module.exports = {
    pool,
    query,
    initDatabase
};
