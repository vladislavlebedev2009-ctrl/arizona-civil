const fs = require("fs");
const path = require("path");

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

const files = [
    "server.js",
    "db.js",
    "package.json",
    "public/app.js",
    "public/style.css"
];

console.log(`
========================================
 ARIZONA CIVIL 2.2 — UPGRADE
========================================
`);

function backup(file) {
    const src = path.join(root, file);
    if (!fs.existsSync(src)) return;
    const dst = `${src}.backup-v2.2-${stamp}`;
    fs.copyFileSync(src, dst);
    console.log(`✅ Backup: ${path.basename(dst)}`);
}

for (const file of files) backup(file);

/* =========================================================
   1. PERMISSIONS
========================================================= */

const permissions = `
/*
=========================================================
 ARIZONA CIVIL 2.2 — PERMISSIONS
=========================================================
*/

const CIVIL_MANAGEMENT_ROLES = [
    "Разработчик",
    "ГС ГОС",
    "ЗГС ГОС",
    "ГС гражданских",
    "ЗГС гражданских"
];

const SUPERVISOR_ROLES = [
    "Разработчик",
    "ГС ГОС",
    "ЗГС ГОС",
    "ГС гражданских",
    "ЗГС гражданских",
    "Следящий"
];

const ASSISTANT_ROLE = "Помощник следящего за гражданской структурой";
const LEADER_ROLE = "Лидер";
const DEPUTY_ROLE = "Заместитель";

function canManagePersonnel(role) {
    return CIVIL_MANAGEMENT_ROLES.includes(role);
}

function canManageSupervisors(role) {
    return SUPERVISOR_ROLES.includes(role);
}

function canAssignLeader(role) {
    return canManagePersonnel(role);
}

function canAssignDeputy(role) {
    return canManagePersonnel(role);
}

function canManageAssistant(role) {
    return [
        "Разработчик",
        "ГС гражданских",
        "ЗГС гражданских",
        "Следящий"
    ].includes(role);
}

function canManageOwnStructure(role) {
    return [
        "Разработчик",
        "ГС ГОС",
        "ЗГС ГОС",
        "ГС гражданских",
        "ЗГС гражданских",
        "Следящий",
        ASSISTANT_ROLE
    ].includes(role);
}
`;

const permissionFile = path.join(root, "permissions.js");
if (!fs.existsSync(permissionFile)) {
    fs.writeFileSync(permissionFile, permissions.trim() + "\n");
    console.log("✅ permissions.js создан");
} else {
    console.log("ℹ️ permissions.js уже существует");
}

/* =========================================================
   2. DATABASE MIGRATION
========================================================= */

const dbFile = path.join(root, "db.js");

if (fs.existsSync(dbFile)) {
    let db = fs.readFileSync(dbFile, "utf8");

    const migration = `

/*
=========================================================
 ARIZONA CIVIL 2.2 — DATABASE MIGRATION
=========================================================
*/

async function initDatabaseV22() {
    await query(\`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS avatar_url TEXT
    \`);

    await query(\`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS vk TEXT
    \`);

    await query(\`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS organization VARCHAR(200)
    \`);

    await query(\`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS appointed_at TIMESTAMPTZ
    \`);

    await query(\`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS appointed_by VARCHAR(100)
    \`);

    await query(\`
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
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS idx_appointments_user
        ON appointments(user_id)
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS idx_appointments_active
        ON appointments(active)
    \`);

    await query(\`
        CREATE TABLE IF NOT EXISTS role_history (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
            old_role VARCHAR(100),
            new_role VARCHAR(100),
            changed_by VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    \`);

    await query(\`
        CREATE TABLE IF NOT EXISTS personnel_history (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
            action VARCHAR(150) NOT NULL,
            details TEXT DEFAULT '',
            actor VARCHAR(100),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    \`);

    await query(\`
        CREATE TABLE IF NOT EXISTS permissions (
            id BIGSERIAL PRIMARY KEY,
            role VARCHAR(100) NOT NULL,
            permission VARCHAR(150) NOT NULL,
            allowed BOOLEAN NOT NULL DEFAULT TRUE,
            UNIQUE(role, permission)
        )
    \`);

    console.log("✅ Arizona Civil 2.2: database migration complete");
}
`;

    if (!db.includes("initDatabaseV22")) {
        db += migration;
        fs.writeFileSync(dbFile, db);
        console.log("✅ db.js обновлён");
    } else {
        console.log("ℹ️ initDatabaseV22 уже существует");
    }
}

/* =========================================================
   3. SERVER PATCH
========================================================= */

const serverFile = path.join(root, "server.js");

if (fs.existsSync(serverFile)) {
    let server = fs.readFileSync(serverFile, "utf8");

    if (!server.includes('require("./permissions")')) {
        server = server.replace(
            'const { initDatabase, query, pool } = require("./db");',
            `const { initDatabase, query, pool } = require("./db");
const {
    canManagePersonnel,
    canManageSupervisors,
    canAssignLeader,
    canAssignDeputy,
    canManageAssistant,
    canManageOwnStructure
} = require("./permissions");`
        );

        console.log("✅ permissions подключены к server.js");
    }

    /* Health endpoint */

    if (!server.includes('app.get("/health"')) {
        const healthRoute = `

/*
=========================================================
 ARIZONA CIVIL 2.2 — RENDER HEALTH CHECK
=========================================================
*/

app.get("/health", async (req, res) => {
    try {
        await query("SELECT 1");

        res.status(200).json({
            status: "ok",
            service: "arizona-civil",
            version: "2.2",
            database: "connected",
            uptime: Math.floor(process.uptime())
        });
    } catch (error) {
        console.error("Health check DB error:", error.message);

        res.status(503).json({
            status: "error",
            database: "disconnected"
        });
    }
});

`;
        const marker = 'app.use(express.json());';

        if (server.includes(marker)) {
            server = server.replace(
                marker,
                marker + healthRoute
            );
        } else {
            server = healthRoute + server;
        }

        console.log("✅ /health добавлен");
    }

    /* Personnel APIs */

    if (!server.includes("ARIZONA CIVIL 2.2 — PERSONNEL API")) {
        const personnelApi = `

/*
=========================================================
 ARIZONA CIVIL 2.2 — PERSONNEL API
=========================================================
*/

app.get(
    "/api/personnel/:id/history",
    requireAuth,
    async (req, res) => {
        try {
            const result = await query(
                \`
                SELECT
                    id,
                    action,
                    details,
                    actor,
                    created_at
                FROM personnel_history
                WHERE user_id = $1
                ORDER BY created_at DESC
                \`,
                [Number(req.params.id)]
            );

            res.json(result.rows);
        } catch (error) {
            console.error("Personnel history:", error);
            res.status(500).json({
                error: "Ошибка получения истории"
            });
        }
    }
);

app.post(
    "/api/users/:id/leader",
    requireAuth,
    async (req, res) => {
        const actor = req.session.user;

        if (!canAssignLeader(actor.role)) {
            return res.status(403).json({
                error: "Недостаточно прав"
            });
        }

        const userId = Number(req.params.id);
        const organization =
            String(req.body.organization || "").trim();

        if (!organization) {
            return res.status(400).json({
                error: "Укажите организацию"
            });
        }

        try {
            const userResult = await query(
                \`
                SELECT id, username, role
                FROM users
                WHERE id = $1
                \`,
                [userId]
            );

            if (!userResult.rows.length) {
                return res.status(404).json({
                    error: "Пользователь не найден"
                });
            }

            const user = userResult.rows[0];
            const oldRole = user.role;

            await query(
                \`
                UPDATE users
                SET
                    role = 'Лидер',
                    organization = $1,
                    appointed_at = NOW(),
                    appointed_by = $2
                WHERE id = $3
                \`,
                [
                    organization,
                    actor.username,
                    userId
                ]
            );

            await query(
                \`
                INSERT INTO appointments
                    (
                        user_id,
                        organization,
                        role,
                        appointed_by
                    )
                VALUES
                    ($1, $2, 'Лидер', $3)
                \`,
                [
                    userId,
                    organization,
                    actor.username
                ]
            );

            await query(
                \`
                INSERT INTO role_history
                    (
                        user_id,
                        old_role,
                        new_role,
                        changed_by
                    )
                VALUES
                    ($1, $2, 'Лидер', $3)
                \`,
                [
                    userId,
                    oldRole,
                    actor.username
                ]
            );

            await query(
                \`
                INSERT INTO personnel_history
                    (
                        user_id,
                        action,
                        details,
                        actor
                    )
                VALUES
                    (
                        $1,
                        'Назначен лидером',
                        $2,
                        $3
                    )
                \`,
                [
                    userId,
                    organization,
                    actor.username
                ]
            );

            await audit(
                actor.username,
                "Назначен лидер",
                \`\${user.username}: \${organization}\`,
                userId
            );

            res.json({
                success: true,
                role: "Лидер"
            });

        } catch (error) {
            console.error("Назначение лидера:", error);
            res.status(500).json({
                error: "Ошибка назначения"
            });
        }
    }
);

app.post(
    "/api/users/:id/deputy",
    requireAuth,
    async (req, res) => {
        const actor = req.session.user;

        if (!canAssignDeputy(actor.role)) {
            return res.status(403).json({
                error: "Недостаточно прав"
            });
        }

        const userId = Number(req.params.id);
        const organization =
            String(req.body.organization || "").trim();

        if (!organization) {
            return res.status(400).json({
                error: "Укажите организацию"
            });
        }

        try {
            const userResult = await query(
                \`
                SELECT id, username, role
                FROM users
                WHERE id = $1
                \`,
                [userId]
            );

            if (!userResult.rows.length) {
                return res.status(404).json({
                    error: "Пользователь не найден"
                });
            }

            const user = userResult.rows[0];
            const oldRole = user.role;

            await query(
                \`
                UPDATE users
                SET
                    role = 'Заместитель',
                    organization = $1,
                    appointed_at = NOW(),
                    appointed_by = $2
                WHERE id = $3
                \`,
                [
                    organization,
                    actor.username,
                    userId
                ]
            );

            await query(
                \`
                INSERT INTO appointments
                    (
                        user_id,
                        organization,
                        role,
                        appointed_by
                    )
                VALUES
                    ($1, $2, 'Заместитель', $3)
                \`,
                [
                    userId,
                    organization,
                    actor.username
                ]
            );

            await query(
                \`
                INSERT INTO role_history
                    (
                        user_id,
                        old_role,
                        new_role,
                        changed_by
                    )
                VALUES
                    ($1, $2, 'Заместитель', $3)
                \`,
                [
                    userId,
                    oldRole,
                    actor.username
                ]
            );

            await query(
                \`
                INSERT INTO personnel_history
                    (
                        user_id,
                        action,
                        details,
                        actor
                    )
                VALUES
                    (
                        $1,
                        'Назначен заместителем',
                        $2,
                        $3
                    )
                \`,
                [
                    userId,
                    organization,
                    actor.username
                ]
            );

            await audit(
                actor.username,
                "Назначен заместитель",
                \`\${user.username}: \${organization}\`,
                userId
            );

            res.json({
                success: true,
                role: "Заместитель"
            });

        } catch (error) {
            console.error("Назначение заместителя:", error);
            res.status(500).json({
                error: "Ошибка назначения"
            });
        }
    }
);

`;

        const marker = 'app.get("/health"';

        if (server.includes(marker)) {
            server = server.replace(
                marker,
                personnelApi + marker
            );
        } else {
            server += personnelApi;
        }

        console.log("✅ API Лидеров/Заместителей добавлено");
    }

    /* Render graceful shutdown */

    if (!server.includes("ARIZONA CIVIL 2.2 — GRACEFUL SHUTDOWN")) {
        server += `

/*
=========================================================
 ARIZONA CIVIL 2.2 — GRACEFUL SHUTDOWN
=========================================================
*/

async function gracefulShutdown(signal) {
    console.log(\`Получен \${signal}. Завершение работы...\`);

    try {
        await pool.end();
        console.log("PostgreSQL connection pool закрыт");
    } catch (error) {
        console.error("Ошибка закрытия PostgreSQL:", error.message);
    }

    process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

`;

        console.log("✅ Graceful shutdown добавлен");
    }

    fs.writeFileSync(serverFile, server);
}

/* =========================================================
   4. PACKAGE.JSON
========================================================= */

const packageFile = path.join(root, "package.json");

if (fs.existsSync(packageFile)) {
    try {
        const pkg = JSON.parse(
            fs.readFileSync(packageFile, "utf8")
        );

        pkg.scripts = pkg.scripts || {};

        if (!pkg.scripts.start) {
            pkg.scripts.start = "node server.js";
        }

        if (!pkg.scripts["check"]) {
            pkg.scripts.check = "node --check server.js";
        }

        fs.writeFileSync(
            packageFile,
            JSON.stringify(pkg, null, 2) + "\n"
        );

        console.log("✅ package.json подготовлен");
    } catch (error) {
        console.error("❌ Ошибка package.json:", error.message);
    }
}

/* =========================================================
   5. RENDER FILES
========================================================= */

const renderYaml = `
services:
  - type: web
    name: arizona-civil
    runtime: node
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: SESSION_SECRET
        sync: false
`;

fs.writeFileSync(
    path.join(root, "render.yaml"),
    renderYaml.trim() + "\n"
);

console.log("✅ render.yaml создан");

const envExample = `
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
SESSION_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_SECRET
`;

fs.writeFileSync(
    path.join(root, ".env.example"),
    envExample.trim() + "\n"
);

console.log("✅ .env.example обновлён");

/* =========================================================
   6. GITIGNORE
========================================================= */

const gitignore = `
node_modules/
.env
.env.*
!.env.example

*.log

arizona-data.json

*.backup-*
*.bak

.DS_Store
`;

fs.writeFileSync(
    path.join(root, ".gitignore"),
    gitignore.trim() + "\n"
);

console.log("✅ .gitignore обновлён");

/* =========================================================
   7. MIGRATION RUNNER
========================================================= */

const migrateFile = path.join(root, "run-v22-migration.js");

fs.writeFileSync(
    migrateFile,
`require("dotenv").config();

const { initDatabase, pool, query } = require("./db");

async function run() {
    try {
        await initDatabase();

        await query(\`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS avatar_url TEXT
        \`);

        await query(\`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS vk TEXT
        \`);

        await query(\`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS organization VARCHAR(200)
        \`);

        await query(\`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS appointed_at TIMESTAMPTZ
        \`);

        await query(\`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS appointed_by VARCHAR(100)
        \`);

        await query(\`
            ALTER TABLE supervisors
            ADD COLUMN IF NOT EXISTS vk TEXT
        \`);

        await query(\`
            ALTER TABLE supervisors
            ADD COLUMN IF NOT EXISTS avatar_url TEXT
        \`);

        await query(\`
            ALTER TABLE supervisors
            ADD COLUMN IF NOT EXISTS supervisor_id BIGINT
        \`);

        await query(\`
            CREATE INDEX IF NOT EXISTS idx_supervisors_supervisor_id
            ON supervisors(supervisor_id)
        \`);

        await query(\`
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
        \`);

        await query(\`
            CREATE TABLE IF NOT EXISTS role_history (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
                old_role VARCHAR(100),
                new_role VARCHAR(100),
                changed_by VARCHAR(100),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        \`);

        await query(\`
            CREATE TABLE IF NOT EXISTS personnel_history (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
                action VARCHAR(150) NOT NULL,
                details TEXT DEFAULT '',
                actor VARCHAR(100),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        \`);

        await query(\`
            CREATE TABLE IF NOT EXISTS permissions (
                id BIGSERIAL PRIMARY KEY,
                role VARCHAR(100) NOT NULL,
                permission VARCHAR(150) NOT NULL,
                allowed BOOLEAN NOT NULL DEFAULT TRUE,
                UNIQUE(role, permission)
            )
        \`);

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
`
);

console.log("✅ migration runner создан");

console.log(`
========================================
 ARIZONA CIVIL 2.2 — FILE UPDATE DONE
========================================
`);
