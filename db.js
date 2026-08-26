require("node:process").loadEnvFile(".env");
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.warn("DATABASE_URL не задан. PostgreSQL пока не подключён.");
}

/* =========================================================
   ARIZONA_CIVIL_RENDER_DATABASE
========================================================= */

const pool = new Pool({

    connectionString,

    ssl:
        process.env.NODE_ENV === "production"
            ? {
                rejectUnauthorized: false
              }
            : (
                connectionString
                    ? {
                        rejectUnauthorized: false
                    }
                    : false
            ),

    max:
        Number(
            process.env.PG_POOL_MAX || 10
        ),

    idleTimeoutMillis:
        30000,

    connectionTimeoutMillis:
        10000

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


/*
=========================================================
 ARIZONA CIVIL 2.0 — SUPERVISOR ASSISTANTS
 Без удаления существующих данных
=========================================================
*/

async function initSupervisorV2() {
    try {
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

        console.log("✅ Arizona Civil 2.0: supervisors обновлены");
    } catch (error) {
        console.error(
            "❌ Ошибка миграции supervisors:",
            error.message
        );
    }
}


/* =========================================================
   ARIZONA CIVIL FINAL MIGRATION
========================================================= */

async function initFinalMigration() {

    await query(`
        ALTER TABLE supervisors
        ADD COLUMN IF NOT EXISTS supervisor_id BIGINT
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
        ADD COLUMN IF NOT EXISTS updated_at
        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS
        idx_supervisors_supervisor_id
        ON supervisors(supervisor_id)
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS
        idx_users_role
        ON users(role)
    `);

    console.log(
        "✅ Final PostgreSQL migration ready"
    );

}

module.exports.initFinalMigration =
    initFinalMigration;



/*
=========================================================
 ARIZONA CIVIL 2.2 — DATABASE MIGRATION
=========================================================
*/

async function initDatabaseV22() {
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
        CREATE INDEX IF NOT EXISTS idx_appointments_user
        ON appointments(user_id)
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_appointments_active
        ON appointments(active)
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

    console.log("✅ Arizona Civil 2.2: database migration complete");
}


/*
=========================================================
 ARIZONA CIVIL 3.0 — DATABASE
=========================================================
*/

async function initDatabaseV30() {

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
        CREATE TABLE IF NOT EXISTS organizations (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(200) UNIQUE NOT NULL,
            short_name VARCHAR(100) DEFAULT '',
            description TEXT DEFAULT '',
            status VARCHAR(50) NOT NULL DEFAULT 'Активна',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS personnel_notes (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
            author VARCHAR(100) NOT NULL,
            note TEXT NOT NULL,
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
        CREATE TABLE IF NOT EXISTS permissions (
            id BIGSERIAL PRIMARY KEY,
            role VARCHAR(100) NOT NULL,
            permission VARCHAR(150) NOT NULL,
            allowed BOOLEAN NOT NULL DEFAULT TRUE,
            UNIQUE(role, permission)
        )
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_users_role
        ON users(role)
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_users_organization
        ON users(organization)
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_personnel_notes_user
        ON personnel_notes(user_id)
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_personnel_history_user
        ON personnel_history(user_id)
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_appointments_user
        ON appointments(user_id)
    `);

    console.log("✅ Arizona Civil 3.0 DB готова");
}

