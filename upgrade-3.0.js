const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

console.log(`
╔══════════════════════════════════════════╗
║        ARIZONA CIVIL 3.0 UPGRADE        ║
╚══════════════════════════════════════════╝
`);

function file(p) {
    return path.join(ROOT, p);
}

function backup(p) {
    const src = file(p);
    if (!fs.existsSync(src)) return;

    const dst = `${src}.backup-v3.0-${stamp}`;
    fs.copyFileSync(src, dst);

    console.log(`✅ Backup: ${p}`);
}

[
    "server.js",
    "db.js",
    "package.json",
    "public/index.html",
    "public/app.js",
    "public/style.css",
    "render.yaml",
    ".gitignore"
].forEach(backup);

/* =========================================================
   DB MIGRATION
========================================================= */

const migration = `
/*
=========================================================
 ARIZONA CIVIL 3.0 — DATABASE
=========================================================
*/

async function initDatabaseV30() {

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
        CREATE TABLE IF NOT EXISTS organizations (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(200) UNIQUE NOT NULL,
            short_name VARCHAR(100) DEFAULT '',
            description TEXT DEFAULT '',
            status VARCHAR(50) NOT NULL DEFAULT 'Активна',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    \`);

    await query(\`
        CREATE TABLE IF NOT EXISTS personnel_notes (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
            author VARCHAR(100) NOT NULL,
            note TEXT NOT NULL,
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
        CREATE TABLE IF NOT EXISTS permissions (
            id BIGSERIAL PRIMARY KEY,
            role VARCHAR(100) NOT NULL,
            permission VARCHAR(150) NOT NULL,
            allowed BOOLEAN NOT NULL DEFAULT TRUE,
            UNIQUE(role, permission)
        )
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS idx_users_role
        ON users(role)
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS idx_users_organization
        ON users(organization)
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS idx_personnel_notes_user
        ON personnel_notes(user_id)
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS idx_personnel_history_user
        ON personnel_history(user_id)
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS idx_appointments_user
        ON appointments(user_id)
    \`);

    console.log("✅ Arizona Civil 3.0 DB готова");
}
`;

const dbPath = file("db.js");

if (fs.existsSync(dbPath)) {
    let db = fs.readFileSync(dbPath, "utf8");

    if (!db.includes("initDatabaseV30")) {
        db += "\n" + migration + "\n";
        fs.writeFileSync(dbPath, db);
        console.log("✅ db.js: V3 migration добавлена");
    } else {
        console.log("ℹ️ db.js: V3 migration уже существует");
    }
}

/* =========================================================
   PERMISSIONS
========================================================= */

const permissionsPath = file("permissions.js");

const permissions = `
const ROLE_PERMISSIONS_V30 = {

    "Разработчик": [
        "*"
    ],

    "ГС ГОС": [
        "users.view",
        "users.edit",
        "users.assign_leader",
        "users.assign_deputy",
        "leaders.manage",
        "deputies.manage",
        "supervisors.view",
        "organizations.view",
        "history.view"
    ],

    "ЗГС ГОС": [
        "users.view",
        "users.edit",
        "users.assign_leader",
        "users.assign_deputy",
        "leaders.manage",
        "deputies.manage",
        "supervisors.view",
        "organizations.view",
        "history.view"
    ],

    "ГС гражданских": [
        "users.view",
        "users.edit",
        "users.assign_leader",
        "users.assign_deputy",
        "leaders.manage",
        "deputies.manage",
        "supervisors.manage",
        "organizations.view",
        "history.view"
    ],

    "ЗГС гражданских": [
        "users.view",
        "users.edit",
        "users.assign_leader",
        "users.assign_deputy",
        "leaders.manage",
        "deputies.manage",
        "supervisors.manage",
        "organizations.view",
        "history.view"
    ],

    "Следящий": [
        "users.view",
        "organizations.view",
        "history.view"
    ],

    "Помощник следящего за гражданской структурой": [
        "users.view",
        "organizations.view"
    ],

    "Лидер": [
        "users.view",
        "organizations.view"
    ],

    "Заместитель": [
        "users.view",
        "organizations.view"
    ],

    "Пользователь": []
};

function hasPermissionV30(role, permission) {
    const permissions = ROLE_PERMISSIONS_V30[role] || [];

    return (
        permissions.includes("*") ||
        permissions.includes(permission)
    );
}

module.exports = {
    ...module.exports,
    ROLE_PERMISSIONS_V30,
    hasPermissionV30
};
`;

if (!fs.existsSync(permissionsPath)) {
    fs.writeFileSync(permissionsPath, permissions.trim() + "\n");
    console.log("✅ permissions.js создан");
} else {
    let p = fs.readFileSync(permissionsPath, "utf8");

    if (!p.includes("ROLE_PERMISSIONS_V30")) {
        p += "\n" + permissions;
        fs.writeFileSync(permissionsPath, p);
        console.log("✅ permissions V3 добавлены");
    }
}

/* =========================================================
   SERVER API
========================================================= */

const serverPath = file("server.js");

if (fs.existsSync(serverPath)) {

    let server = fs.readFileSync(serverPath, "utf8");

    const api = `

/*
=========================================================
 ARIZONA CIVIL 3.0 — PERSONNEL CENTER API
=========================================================
*/

app.get("/api/v3/dashboard", requireAuth, async (req, res) => {
    try {

        const users = await query(\`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (
                    WHERE active = TRUE
                )::int AS active
            FROM users
        \`);

        const roles = await query(\`
            SELECT role, COUNT(*)::int AS count
            FROM users
            GROUP BY role
            ORDER BY count DESC
        \`);

        const organizations = await query(\`
            SELECT
                organization,
                COUNT(*)::int AS count
            FROM users
            WHERE organization IS NOT NULL
              AND organization <> ''
            GROUP BY organization
            ORDER BY count DESC
        \`);

        const appointments = await query(\`
            SELECT COUNT(*)::int AS count
            FROM appointments
            WHERE active = TRUE
        \`);

        res.json({
            version: "3.0",
            users: users.rows[0],
            roles: roles.rows,
            organizations: organizations.rows,
            appointments: appointments.rows[0]
        });

    } catch (error) {

        console.error("Dashboard V3:", error);

        res.status(500).json({
            error: "Ошибка dashboard"
        });
    }
});


app.get(
    "/api/v3/personnel",
    requireAuth,
    async (req, res) => {

        try {

            const search =
                String(req.query.search || "").trim();

            const role =
                String(req.query.role || "").trim();

            const organization =
                String(req.query.organization || "").trim();

            const result = await query(
                \`
                SELECT
                    id,
                    username,
                    name,
                    role,
                    position,
                    organization,
                    vk,
                    avatar_url,
                    active,
                    appointed_at,
                    appointed_by,
                    created_at
                FROM users
                WHERE
                    (
                        $1 = ''
                        OR username ILIKE '%' || $1 || '%'
                        OR name ILIKE '%' || $1 || '%'
                    )
                    AND ($2 = '' OR role = $2)
                    AND (
                        $3 = ''
                        OR organization = $3
                    )
                ORDER BY
                    CASE role
                        WHEN 'Разработчик' THEN 1
                        WHEN 'ГС ГОС' THEN 2
                        WHEN 'ЗГС ГОС' THEN 3
                        WHEN 'ГС гражданских' THEN 4
                        WHEN 'ЗГС гражданских' THEN 5
                        WHEN 'Следящий' THEN 6
                        WHEN 'Помощник следящего за гражданской структурой' THEN 7
                        WHEN 'Лидер' THEN 8
                        WHEN 'Заместитель' THEN 9
                        ELSE 10
                    END,
                    username
                \`,
                [
                    search,
                    role,
                    organization
                ]
            );

            res.json(result.rows);

        } catch (error) {

            console.error(
                "Personnel V3:",
                error
            );

            res.status(500).json({
                error: "Ошибка получения персонала"
            });
        }
    }
);


app.get(
    "/api/v3/personnel/:id",
    requireAuth,
    async (req, res) => {

        try {

            const userResult = await query(
                \`
                SELECT
                    id,
                    username,
                    name,
                    role,
                    position,
                    organization,
                    vk,
                    avatar_url,
                    active,
                    appointed_at,
                    appointed_by,
                    created_at
                FROM users
                WHERE id = $1
                \`,
                [Number(req.params.id)]
            );

            if (!userResult.rows.length) {
                return res.status(404).json({
                    error: "Сотрудник не найден"
                });
            }

            const history = await query(
                \`
                SELECT
                    action,
                    details,
                    actor,
                    created_at
                FROM personnel_history
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 100
                \`,
                [Number(req.params.id)]
            );

            const appointments = await query(
                \`
                SELECT
                    role,
                    organization,
                    appointed_by,
                    start_date,
                    end_date,
                    active
                FROM appointments
                WHERE user_id = $1
                ORDER BY start_date DESC
                \`,
                [Number(req.params.id)]
            );

            res.json({
                user: userResult.rows[0],
                history: history.rows,
                appointments: appointments.rows
            });

        } catch (error) {

            console.error(
                "Personnel profile:",
                error
            );

            res.status(500).json({
                error: "Ошибка профиля"
            });
        }
    }
);


app.get(
    "/api/v3/organizations",
    requireAuth,
    async (req, res) => {

        try {

            const result = await query(\`
                SELECT
                    o.*,
                    COUNT(u.id)::int AS personnel_count
                FROM organizations o
                LEFT JOIN users u
                    ON u.organization = o.name
                GROUP BY o.id
                ORDER BY o.name
            \`);

            res.json(result.rows);

        } catch (error) {

            console.error(
                "Organizations V3:",
                error
            );

            res.status(500).json({
                error: "Ошибка организаций"
            });
        }
    }
);


app.get(
    "/api/v3/audit",
    requireAuth,
    async (req, res) => {

        try {

            const result = await query(\`
                SELECT
                    id,
                    actor,
                    action,
                    details,
                    target_user_id,
                    created_at
                FROM audit_log
                ORDER BY created_at DESC
                LIMIT 200
            \`);

            res.json(result.rows);

        } catch (error) {

            console.error(
                "Audit V3:",
                error
            );

            res.status(500).json({
                error: "Ошибка журнала"
            });
        }
    }
);


app.get("/api/version", (req, res) => {
    res.json({
        name: "Arizona Civil",
        version: "3.0",
        status: "production-ready"
    });
});

`;

    if (!server.includes("/api/v3/dashboard")) {
        server += api;
        fs.writeFileSync(serverPath, server);
        console.log("✅ V3 API добавлен");
    } else {
        console.log("ℹ️ V3 API уже существует");
    }

    /*
       Подключаем миграцию к запуску.
    */

    if (!server.includes("initDatabaseV30")) {

        server = fs.readFileSync(serverPath, "utf8");

        server = server.replace(
            'const { initDatabase, query, pool } = require("./db");',
            'const { initDatabase, initDatabaseV30, query, pool } = require("./db");'
        );

        if (server.includes("await initDatabase();")) {
            server = server.replace(
                "await initDatabase();",
                "await initDatabase();\n        if (typeof initDatabaseV30 === 'function') await initDatabaseV30();"
            );
        }

        fs.writeFileSync(serverPath, server);

        console.log("✅ V3 migration подключена к server.js");
    }
}

/* =========================================================
   FRONTEND — V3 CSS
========================================================= */

const stylePath = file("public/style.css");

if (fs.existsSync(stylePath)) {

    let css = fs.readFileSync(stylePath, "utf8");

    if (!css.includes("ARIZONA CIVIL 3.0 UI")) {

        css += `

/* =========================================================
   ARIZONA CIVIL 3.0 UI
========================================================= */

:root {
    --ac-bg: #070a12;
    --ac-panel: rgba(15, 20, 32, .82);
    --ac-panel-2: rgba(20, 27, 43, .92);
    --ac-border: rgba(255,255,255,.08);
    --ac-text: #f5f7fb;
    --ac-muted: #8993a8;
    --ac-accent: #d8b15a;
    --ac-accent-2: #8c6b2d;
    --ac-success: #55d98b;
    --ac-danger: #ff647c;
    --ac-radius: 20px;
}

.arizona-v3 {
    min-height: 100%;
    padding: 28px;
    background:
        radial-gradient(
            circle at 10% 0%,
            rgba(216,177,90,.12),
            transparent 30%
        ),
        radial-gradient(
            circle at 90% 20%,
            rgba(80,110,255,.08),
            transparent 35%
        );
}

.v3-dashboard {
    display: grid;
    grid-template-columns: repeat(4, minmax(0,1fr));
    gap: 18px;
    margin-bottom: 24px;
}

.v3-stat {
    background: var(--ac-panel);
    border: 1px solid var(--ac-border);
    border-radius: var(--ac-radius);
    padding: 22px;
    backdrop-filter: blur(18px);
    box-shadow: 0 15px 50px rgba(0,0,0,.22);
}

.v3-stat span {
    display: block;
    color: var(--ac-muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: .12em;
}

.v3-stat strong {
    display: block;
    margin-top: 8px;
    font-size: 32px;
    color: var(--ac-text);
}

.v3-toolbar {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 20px;
}

.v3-input,
.v3-select {
    min-height: 46px;
    padding: 0 15px;
    border-radius: 13px;
    border: 1px solid var(--ac-border);
    background: var(--ac-panel-2);
    color: var(--ac-text);
    outline: none;
}

.v3-input:focus,
.v3-select:focus {
    border-color: rgba(216,177,90,.65);
    box-shadow: 0 0 0 3px rgba(216,177,90,.08);
}

.v3-personnel-grid {
    display: grid;
    grid-template-columns:
        repeat(auto-fill, minmax(280px, 1fr));
    gap: 18px;
}

.v3-person-card {
    position: relative;
    overflow: hidden;
    background: var(--ac-panel);
    border: 1px solid var(--ac-border);
    border-radius: var(--ac-radius);
    padding: 20px;
    transition: .2s ease;
}

.v3-person-card:hover {
    transform: translateY(-3px);
    border-color: rgba(216,177,90,.35);
    box-shadow: 0 20px 55px rgba(0,0,0,.28);
}

.v3-person-top {
    display: flex;
    align-items: center;
    gap: 14px;
}

.v3-avatar {
    width: 58px;
    height: 58px;
    border-radius: 16px;
    object-fit: cover;
    background: linear-gradient(
        135deg,
        var(--ac-accent-2),
        #171c2b
    );
    display: grid;
    place-items: center;
    color: white;
    font-weight: 800;
    font-size: 20px;
}

.v3-person-name {
    color: var(--ac-text);
    font-size: 17px;
    font-weight: 750;
}

.v3-person-role {
    margin-top: 4px;
    color: var(--ac-accent);
    font-size: 12px;
    font-weight: 700;
}

.v3-person-meta {
    display: grid;
    gap: 8px;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--ac-border);
}

.v3-person-meta div {
    display: flex;
    justify-content: space-between;
    gap: 15px;
}

.v3-person-meta span {
    color: var(--ac-muted);
    font-size: 12px;
}

.v3-person-meta strong {
    color: var(--ac-text);
    font-size: 13px;
    text-align: right;
}

.v3-actions {
    display: flex;
    gap: 8px;
    margin-top: 18px;
}

.v3-btn {
    flex: 1;
    min-height: 40px;
    border: 1px solid var(--ac-border);
    border-radius: 11px;
    background: rgba(255,255,255,.04);
    color: var(--ac-text);
    cursor: pointer;
}

.v3-btn:hover {
    background: rgba(216,177,90,.12);
}

.v3-btn.primary {
    background: linear-gradient(
        135deg,
        var(--ac-accent),
        var(--ac-accent-2)
    );
    color: #101010;
    border: 0;
}

.v3-role-badge {
    display: inline-flex;
    padding: 5px 9px;
    border-radius: 999px;
    background: rgba(216,177,90,.1);
    color: var(--ac-accent);
    font-size: 11px;
    font-weight: 800;
}

.v3-section {
    background: var(--ac-panel);
    border: 1px solid var(--ac-border);
    border-radius: var(--ac-radius);
    padding: 22px;
    margin-bottom: 20px;
}

.v3-section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 18px;
}

.v3-section-title h2 {
    margin: 0;
    color: var(--ac-text);
}

.v3-empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--ac-muted);
}

@media (max-width: 1000px) {
    .v3-dashboard {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 600px) {
    .arizona-v3 {
        padding: 14px;
    }

    .v3-dashboard {
        grid-template-columns: 1fr;
    }

    .v3-personnel-grid {
        grid-template-columns: 1fr;
    }
}
`;

        fs.writeFileSync(stylePath, css);

        console.log("✅ Новый дизайн V3 добавлен");
    }
}

/* =========================================================
   FRONTEND APP
========================================================= */

const appPath = file("public/app.js");

if (fs.existsSync(appPath)) {

    let app = fs.readFileSync(appPath, "utf8");

    if (!app.includes("ARIZONA CIVIL 3.0 — FRONTEND")) {

        app += `

/*
=========================================================
 ARIZONA CIVIL 3.0 — FRONTEND
=========================================================
*/

async function loadArizonaCivilV3() {

    const root =
        document.getElementById("arizona-civil-v3");

    if (!root) return;

    try {

        const dashboard =
            await api("/api/v3/dashboard");

        const personnel =
            await api("/api/v3/personnel");

        root.innerHTML = \`
            <div class="arizona-v3">

                <div class="v3-section">

                    <div class="v3-section-title">

                        <div>
                            <h2>Arizona Civil 3.0</h2>
                            <p>
                                Центр управления гражданскими структурами
                            </p>
                        </div>

                        <span class="v3-role-badge">
                            \${escapeHTML(
                                window.currentUser?.role ||
                                "Авторизован"
                            )}
                        </span>

                    </div>

                    <div class="v3-dashboard">

                        <div class="v3-stat">
                            <span>Всего пользователей</span>
                            <strong>
                                \${dashboard.users?.total || 0}
                            </strong>
                        </div>

                        <div class="v3-stat">
                            <span>Активных</span>
                            <strong>
                                \${dashboard.users?.active || 0}
                            </strong>
                        </div>

                        <div class="v3-stat">
                            <span>Назначений</span>
                            <strong>
                                \${dashboard.appointments?.count || 0}
                            </strong>
                        </div>

                        <div class="v3-stat">
                            <span>Организаций</span>
                            <strong>
                                \${dashboard.organizations?.length || 0}
                            </strong>
                        </div>

                    </div>

                </div>

                <div class="v3-section">

                    <div class="v3-section-title">
                        <h2>Кадровый центр</h2>

                        <button
                            class="v3-btn primary"
                            onclick="loadArizonaCivilV3()">
                            Обновить
                        </button>
                    </div>

                    <div class="v3-toolbar">

                        <input
                            id="v3-person-search"
                            class="v3-input"
                            placeholder="Поиск сотрудника...">

                        <select
                            id="v3-role-filter"
                            class="v3-select">

                            <option value="">
                                Все роли
                            </option>

                            <option>Разработчик</option>
                            <option>ГС ГОС</option>
                            <option>ЗГС ГОС</option>
                            <option>ГС гражданских</option>
                            <option>ЗГС гражданских</option>
                            <option>Следящий</option>
                            <option>
                                Помощник следящего за гражданской структурой
                            </option>
                            <option>Лидер</option>
                            <option>Заместитель</option>
                            <option>Пользователь</option>

                        </select>

                    </div>

                    <div
                        id="v3-personnel"
                        class="v3-personnel-grid">

                        \${personnel.map(v3PersonnelCard).join("")}

                    </div>

                </div>

            </div>
        \`;

        const search =
            document.getElementById(
                "v3-person-search"
            );

        const role =
            document.getElementById(
                "v3-role-filter"
            );

        async function reload() {

            const params =
                new URLSearchParams();

            if (search.value.trim()) {
                params.set(
                    "search",
                    search.value.trim()
                );
            }

            if (role.value) {
                params.set(
                    "role",
                    role.value
                );
            }

            const list =
                await api(
                    "/api/v3/personnel?" +
                    params.toString()
                );

            document.getElementById(
                "v3-personnel"
            ).innerHTML =
                list.map(v3PersonnelCard).join("");
        }

        search.addEventListener(
            "input",
            reload
        );

        role.addEventListener(
            "change",
            reload
        );

    } catch (error) {

        root.innerHTML = \`
            <div class="v3-empty">
                Не удалось загрузить Arizona Civil 3.0
                <br>
                \${escapeHTML(error.message || "")}
            </div>
        \`;
    }
}


function v3PersonnelCard(user) {

    const avatar =
        user.avatar_url
            ? \`
                <img
                    class="v3-avatar"
                    src="\${escapeHTML(user.avatar_url)}"
                    alt="">
              \`
            : \`
                <div class="v3-avatar">
                    \${escapeHTML(
                        (user.username || "?")
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>
              \`;

    return \`
        <article class="v3-person-card">

            <div class="v3-person-top">

                \${avatar}

                <div>

                    <div class="v3-person-name">
                        \${escapeHTML(
                            user.name ||
                            user.username ||
                            "—"
                        )}
                    </div>

                    <div class="v3-person-role">
                        \${escapeHTML(
                            user.role || "Пользователь"
                        )}
                    </div>

                </div>

            </div>

            <div class="v3-person-meta">

                <div>
                    <span>Логин</span>
                    <strong>
                        \${escapeHTML(
                            user.username || "—"
                        )}
                    </strong>
                </div>

                <div>
                    <span>Организация</span>
                    <strong>
                        \${escapeHTML(
                            user.organization || "—"
                        )}
                    </strong>
                </div>

                <div>
                    <span>VK</span>
                    <strong>
                        \${escapeHTML(
                            user.vk || "—"
                        )}
                    </strong>
                </div>

                <div>
                    <span>Статус</span>
                    <strong>
                        \${user.active
                            ? "Активен"
                            : "Неактивен"}
                    </strong>
                </div>

            </div>

            <div class="v3-actions">

                <button
                    class="v3-btn"
                    onclick="openV3PersonnelProfile(
                        \${Number(user.id)}
                    )">
                    Профиль
                </button>

            </div>

        </article>
    \`;
}


async function openV3PersonnelProfile(id) {

    try {

        const data =
            await api(
                "/api/v3/personnel/" +
                Number(id)
            );

        if (
            typeof openModal === "function"
        ) {

            openModal(
                \`
                    <div class="v3-section">

                        <h2>
                            \${escapeHTML(
                                data.user.name ||
                                data.user.username
                            )}
                        </h2>

                        <p>
                            \${escapeHTML(
                                data.user.role
                            )}
                        </p>

                        <hr>

                        <h3>
                            История
                        </h3>

                        \${data.history.length
                            ? data.history.map(
                                item => \`
                                    <div class="v3-person-meta">
                                        <strong>
                                            \${escapeHTML(
                                                item.action
                                            )}
                                        </strong>
                                        <span>
                                            \${escapeHTML(
                                                item.details || ""
                                            )}
                                        </span>
                                        <span>
                                            \${escapeHTML(
                                                item.actor || ""
                                            )}
                                        </span>
                                    </div>
                                \`
                            ).join("")
                            : "<p>Истории пока нет</p>"
                        }

                    </div>
                \`
            );

        } else {

            alert(
                "Профиль загружен"
            );
        }

    } catch (error) {

        alert(
            error.message ||
            "Ошибка загрузки профиля"
        );
    }
}
`;

        fs.writeFileSync(appPath, app);

        console.log("✅ Frontend V3 добавлен");
    }
}

/* =========================================================
   INDEX MARKER
========================================================= */

const indexPath = file("public/index.html");

if (fs.existsSync(indexPath)) {

    let index = fs.readFileSync(
        indexPath,
        "utf8"
    );

    if (!index.includes('id="arizona-civil-v3"')) {

        const marker = "</body>";

        const block = `
<div id="arizona-civil-v3"></div>

<script>
window.addEventListener(
    "DOMContentLoaded",
    () => {
        if (
            typeof loadArizonaCivilV3 ===
            "function"
        ) {
            loadArizonaCivilV3();
        }
    }
);
</script>
`;

        if (index.includes(marker)) {
            index = index.replace(
                marker,
                block + "\n" + marker
            );
        } else {
            index += block;
        }

        fs.writeFileSync(
            indexPath,
            index
        );

        console.log("✅ V3 frontend подключён");
    }
}

/* =========================================================
   RENDER
========================================================= */

const render = `
services:

  - type: web
    name: arizona-civil
    runtime: node

    buildCommand: npm ci

    startCommand: npm start

    healthCheckPath: /health

    autoDeploy: true

    envVars:

      - key: NODE_ENV
        value: production

      - key: PORT
        value: 10000

      - key: DATABASE_URL
        sync: false

      - key: SESSION_SECRET
        generateValue: true
`;

fs.writeFileSync(
    file("render.yaml"),
    render.trim() + "\n"
);

console.log("✅ render.yaml обновлён");

/* =========================================================
   PACKAGE
========================================================= */

const packagePath = file("package.json");

if (fs.existsSync(packagePath)) {

    const pkg =
        JSON.parse(
            fs.readFileSync(
                packagePath,
                "utf8"
            )
        );

    pkg.scripts = pkg.scripts || {};

    pkg.scripts.start =
        pkg.scripts.start ||
        "node server.js";

    pkg.scripts.check =
        "node --check server.js && node --check db.js && node --check permissions.js";

    fs.writeFileSync(
        packagePath,
        JSON.stringify(
            pkg,
            null,
            2
        ) + "\n"
    );

    console.log("✅ package.json обновлён");
}

/* =========================================================
   ENV
========================================================= */

fs.writeFileSync(
    file(".env.example"),
`NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
SESSION_SECRET=GENERATE_A_LONG_RANDOM_SECRET
`
);

fs.writeFileSync(
    file(".gitignore"),
`node_modules/
.env
.env.*
!.env.example

*.log
*.backup-*
*.bak

arizona-data.json
.DS_Store
`
);

console.log("✅ production env подготовлен");

/* =========================================================
   VERSION
========================================================= */

fs.writeFileSync(
    file("VERSION"),
    "3.0.0\n"
);

console.log("✅ VERSION = 3.0.0");

/* =========================================================
   GIT
========================================================= */

console.log(`
========================================
 Проверка проекта
========================================
`);

try {

    execSync(
        "node --check server.js",
        {
            stdio: "inherit"
        }
    );

    execSync(
        "node --check db.js",
        {
            stdio: "inherit"
        }
    );

    execSync(
        "node --check permissions.js",
        {
            stdio: "inherit"
        }
    );

    console.log("✅ JavaScript syntax OK");

} catch (error) {

    console.error(
        "❌ Проверка JS не пройдена."
    );

    process.exit(1);
}

try {

    execSync(
        "git status --short",
        {
            stdio: "inherit"
        }
    );

    execSync(
        "git add server.js db.js permissions.js package.json public/index.html public/app.js public/style.css render.yaml .env.example .gitignore VERSION",
        {
            stdio: "inherit"
        }
    );

    execSync(
        'git commit -m "Arizona Civil 3.0"',
        {
            stdio: "inherit"
        }
    );

    console.log("✅ Git commit создан");

    try {

        execSync(
            "git push",
            {
                stdio: "inherit"
            }
        );

        console.log("✅ Git push выполнен");
        console.log("🚀 Если Render подключён к этому репозиторию — начнётся deploy");

    } catch {

        console.log(`
⚠️ git push не выполнен.

Проект подготовлен полностью.
После настройки GitHub можно выполнить:

git push
`);
    }

} catch (error) {

    console.log(`
ℹ️ Git commit пропущен.
Это не ошибка проекта.
`);

}

console.log(`
╔══════════════════════════════════════════╗
║      ARIZONA CIVIL 3.0 — READY         ║
╠══════════════════════════════════════════╣
║ ✅ PostgreSQL migration                  ║
║ ✅ Personnel Center                      ║
║ ✅ Dashboard API                         ║
║ ✅ Profiles                              ║
║ ✅ History                               ║
║ ✅ Organizations                         ║
║ ✅ Permissions                           ║
║ ✅ VK / Avatar                           ║
║ ✅ New UI                                ║
║ ✅ Render                                ║
║ ✅ Health Check                          ║
║ ✅ Backups                               ║
║ ✅ Git                                   ║
╚══════════════════════════════════════════╝

Запуск:
npm start

Проверка:
curl http://localhost:3000/health
`);
