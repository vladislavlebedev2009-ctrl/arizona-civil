const fs = require("fs");
const path = require("path");

const root = process.cwd();

const serverFile = path.join(root, "server.js");
const dbFile = path.join(root, "db.js");
const appFile = path.join(root, "public", "app.js");
const cssFile = path.join(root, "public", "style.css");

const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);

function backup(file, label) {
    if (!fs.existsSync(file)) return;

    const backup =
        `${file}.backup-${label}-${stamp}`;

    fs.copyFileSync(file, backup);

    console.log(
        `✅ Backup: ${path.basename(backup)}`
    );
}

backup(serverFile, "render-final");
backup(dbFile, "render-final");
backup(appFile, "render-final");
backup(cssFile, "render-final");


/* =========================================================
   SERVER
========================================================= */

let server =
    fs.readFileSync(
        serverFile,
        "utf8"
    );


/*
=========================================================
 ROLES
=========================================================
*/

if (!server.includes(
    'ASSISTANT: "Помощник следящего"'
)) {

    server = server.replace(
        /FOLLOWER:\s*"Следящий"/,
        `ASSISTANT: "Помощник следящего",
    FOLLOWER: "Следящий",
    LEADER: "Лидер",
    DEPUTY: "Заместитель"`
    );

} else {

    if (!server.includes(
        'LEADER: "Лидер"'
    )) {

        server = server.replace(
            /FOLLOWER:\s*"Следящий"/,
            `FOLLOWER: "Следящий",
    LEADER: "Лидер",
    DEPUTY: "Заместитель"`
        );

    }

}


/*
=========================================================
 ROLE LEVELS
=========================================================
*/

const roleLevelBlock = `
/* ARIZONA CIVIL FINAL ROLE LEVELS */

const FINAL_ROLE_LEVEL = {

    "Пользователь": 0,

    "Помощник следящего": 5,

    "Следящий": 10,

    "Лидер": 12,

    "Заместитель": 13,

    "ЗГС гражданских": 20,

    "ГС гражданских": 30,

    "ЗГС ГОС": 40,

    "ГС ГОС": 50,

    "Разработчик": 100

};

function finalRoleLevel(role) {
    return FINAL_ROLE_LEVEL[role] ?? 0;
}

function canManageUserRoles(role) {

    return [
        "Разработчик",
        "ГС ГОС",
        "ЗГС ГОС",
        "ГС гражданских",
        "ЗГС гражданских"
    ].includes(role);

}

function canAssignRole(actorRole, targetRole) {

    if (!canManageUserRoles(actorRole)) {
        return false;
    }

    return [
        "Лидер",
        "Заместитель"
    ].includes(targetRole);

}
`;


/*
 Не добавляем второй раз
*/

if (!server.includes(
    "ARIZONA CIVIL FINAL ROLE LEVELS"
)) {

    server =
        roleLevelBlock +
        "\n" +
        server;

}


/*
=========================================================
 ASSIGN ROLE API
=========================================================
*/

if (!server.includes(
    "/api/users/:id/role-assignment"
)) {

const api = `

/* =========================================================
   ARIZONA CIVIL — USER ROLE MANAGEMENT
========================================================= */

app.get(
    "/api/roles/assignable",
    requireAuth,
    async (req, res) => {

        const actorRole =
            req.session?.user?.role ||
            "Пользователь";

        if (!canManageUserRoles(actorRole)) {

            return res.status(403).json({
                error:
                    "Недостаточно прав"
            });

        }

        res.json([
            "Лидер",
            "Заместитель"
        ]);

    }
);


app.patch(
    "/api/users/:id/role-assignment",
    requireAuth,
    async (req, res) => {

        const actorRole =
            req.session?.user?.role ||
            "Пользователь";

        const targetRole =
            String(
                req.body.role || ""
            ).trim();

        const targetId =
            Number(req.params.id);

        if (!canAssignRole(
            actorRole,
            targetRole
        )) {

            return res.status(403).json({
                error:
                    "Эта роль недоступна для назначения"
            });

        }

        if (!Number.isFinite(targetId)) {

            return res.status(400).json({
                error:
                    "Некорректный ID пользователя"
            });

        }

        try {

            const result =
                await query(
                    \`
                    UPDATE users
                    SET role = $1
                    WHERE id = $2
                    RETURNING
                        id,
                        username,
                        name,
                        position,
                        role,
                        active
                    \`,
                    [
                        targetRole,
                        targetId
                    ]
                );

            if (!result.rows.length) {

                return res.status(404).json({
                    error:
                        "Пользователь не найден"
                });

            }

            const user =
                result.rows[0];

            await audit(
                req.session.user.username,
                "Изменена роль пользователя",
                \`\${user.username}: \${targetRole}\`,
                user.id
            );

            res.json(user);

        } catch (error) {

            console.error(
                "Ошибка назначения роли:",
                error
            );

            res.status(500).json({
                error:
                    "Ошибка сервера"
            });

        }

    }
);


app.get(
    "/api/roles",
    requireAuth,
    (req, res) => {

        res.json({
            roles: FINAL_ROLE_LEVEL,
            assignable: [
                "Лидер",
                "Заместитель"
            ]
        });

    }
);

`;

    /*
     Вставляем перед первым users role endpoint
    */

    const marker =
        'app.patch(\n    "/api/users/:id/role"';

    if (server.includes(marker)) {

        server =
            server.replace(
                marker,
                api + "\n" + marker
            );

    } else {

        server += "\n" + api;

    }

}


/*
=========================================================
 SUPERVISOR ASSISTANT POSITION
=========================================================
*/

if (!server.includes(
    "Помощник следящего за гражданской структурой"
)) {

    server =
        server.replace(
            /const ROLE_PERMISSIONS/,
            `
const SUPERVISOR_ASSISTANT_POSITION =
    "Помощник следящего за гражданской структурой";

const SUPERVISOR_POSITIONS = [
    "ГС ГОС",
    "ЗГС ГОС",
    "ГС гражданских",
    "ЗГС гражданских",
    "Следящий",
    "Следящий за Правительством",
    "Следящий за ГЦЛ",
    "Следящий за СМИ",
    "Следящий за Страховой компанией",
    "Следящий за больницами",
    "Следящий за Прокуратурой",
    "Следящий за Адвокатурой",
    "Следящий за Конгрессом",
    "Следящий за Пожарным департаментом",
    SUPERVISOR_ASSISTANT_POSITION
];

const ROLE_PERMISSIONS`
        );

}


/*
=========================================================
 HEALTH CHECK
=========================================================
*/

if (!server.includes(
    'app.get("/health"'
)) {

    const health = `

/* =========================================================
   RENDER HEALTH CHECK
========================================================= */

app.get(
    "/health",
    async (req, res) => {

        try {

            await query(
                "SELECT 1"
            );

            res.status(200).json({
                status: "ok",
                service: "arizona-civil",
                database: "ok",
                uptime:
                    Math.floor(
                        process.uptime()
                    )
            });

        } catch (error) {

            res.status(503).json({
                status: "error",
                database: "offline"
            });

        }

    }
);

`;

    const staticMarker =
        'app.use(express.static';

    if (server.includes(staticMarker)) {

        server =
            server.replace(
                staticMarker,
                health +
                "\n" +
                staticMarker
            );

    } else {

        server =
            health +
            "\n" +
            server;

    }

}


/*
=========================================================
 PORT / LISTEN
=========================================================
*/

server =
    server.replace(
        /const PORT\s*=\s*process\.env\.PORT\s*\|\|\s*3000\s*;/,
        'const PORT = Number(process.env.PORT) || 3000;'
    );


/*
 Render должен слушать 0.0.0.0
*/

server =
    server.replace(
        /app\.listen\(PORT,\s*\(\)\s*=>/g,
        'app.listen(PORT, "0.0.0.0", () =>'
    );


/*
=========================================================
 GRACEFUL SHUTDOWN
=========================================================
*/

if (!server.includes(
    "ARIZONA_CIVIL_RENDER_SHUTDOWN"
)) {

    server += `

/* =========================================================
   ARIZONA_CIVIL_RENDER_SHUTDOWN
========================================================= */

function shutdown(signal) {

    console.log(
        \`Получен \${signal}. Завершение...\`
    );

    pool.end()
        .catch(() => {})
        .finally(() => {

            process.exit(0);

        });

}

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

`;

}


/*
=========================================================
 DATABASE STARTUP
=========================================================
*/

server =
    server.replace(
        /await initDatabase\(\);/,
        `
        await initDatabase();

        if (
            typeof initArizonaCivil201 ===
            "function"
        ) {
            await initArizonaCivil201();
        }
        `
    );


fs.writeFileSync(
    serverFile,
    server
);


/* =========================================================
   DB
========================================================= */

let db =
    fs.readFileSync(
        dbFile,
        "utf8"
    );


/*
 PostgreSQL Render
*/

if (!db.includes(
    "ARIZONA_CIVIL_RENDER_DATABASE"
)) {

    db =
        db.replace(
            /const pool = new Pool\(\{[\s\S]*?\n\}\);/,
`/* =========================================================
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

});`
        );

}


/*
 Migration
*/

if (!db.includes(
    "ARIZONA CIVIL FINAL MIGRATION"
)) {

    db += `

/* =========================================================
   ARIZONA CIVIL FINAL MIGRATION
========================================================= */

async function initFinalMigration() {

    await query(\`
        ALTER TABLE supervisors
        ADD COLUMN IF NOT EXISTS supervisor_id BIGINT
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
        ADD COLUMN IF NOT EXISTS updated_at
        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS
        idx_supervisors_supervisor_id
        ON supervisors(supervisor_id)
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS
        idx_users_role
        ON users(role)
    \`);

    console.log(
        "✅ Final PostgreSQL migration ready"
    );

}

module.exports.initFinalMigration =
    initFinalMigration;

`;

}


fs.writeFileSync(
    dbFile,
    db
);


/* =========================================================
   APP.JS
========================================================= */

let app =
    fs.readFileSync(
        appFile,
        "utf8"
    );


if (!app.includes(
    "ARIZONA_CIVIL_ROLE_UI_FINAL"
)) {

const ui = `

/* =========================================================
   ARIZONA_CIVIL_ROLE_UI_FINAL
========================================================= */

const FINAL_ASSIGNABLE_ROLES = [
    "Лидер",
    "Заместитель"
];

async function openUserRoleManager(
    userId
) {

    try {

        const me =
            await api(
                "/api/auth/me"
            );

        const allowed = [
            "Разработчик",
            "ГС ГОС",
            "ЗГС ГОС",
            "ГС гражданских",
            "ЗГС гражданских"
        ];

        if (
            !allowed.includes(
                me.role
            )
        ) {

            alert(
                "Недостаточно прав"
            );

            return;

        }

        const users =
            await api(
                "/api/users"
            );

        const user =
            users.find(
                x =>
                    Number(x.id) ===
                    Number(userId)
            );

        if (!user) {

            alert(
                "Пользователь не найден"
            );

            return;

        }

        $("modal-content").innerHTML = \`

            <div class="neon-modal-header">

                <span>
                    ARIZONA CIVIL
                </span>

                <h2>
                    Управление ролью
                </h2>

                <p>
                    \${escapeHTML(
                        user.username ||
                        user.name ||
                        ""
                    )}
                </p>

            </div>


            <form
                id="final-role-form">

                <div
                    class="modern-form-group">

                    <label>
                        Роль
                    </label>

                    <select
                        id="final-user-role">

                        \${FINAL_ASSIGNABLE_ROLES
                            .map(
                                role =>
                                    \`
                                    <option
                                        value="\${escapeHTML(
                                            role
                                        )}"
                                        \${
                                            user.role === role
                                                ? "selected"
                                                : ""
                                        }>

                                        \${escapeHTML(
                                            role
                                        )}

                                    </option>
                                    \`
                            )
                            .join("")}

                    </select>

                </div>


                <button
                    class="gold-btn"
                    type="submit">

                    Сохранить роль

                </button>

            </form>

        \`;

        $("modal").classList.add(
            "show"
        );


        $("final-role-form")
            .addEventListener(
                "submit",
                async event => {

                    event.preventDefault();

                    try {

                        await api(
                            \`/api/users/\${Number(
                                user.id
                            )}/role-assignment\`,
                            {
                                method:
                                    "PATCH",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({
                                        role:
                                            $(
                                                "final-user-role"
                                            )
                                            .value
                                    })
                            }
                        );

                        closeModal();

                        if (
                            typeof loadUsers ===
                            "function"
                        ) {
                            await loadUsers();
                        }

                        alert(
                            "Роль успешно изменена"
                        );

                    } catch (error) {

                        alert(
                            error.message ||
                            "Ошибка изменения роли"
                        );

                    }

                }
            );

    } catch (error) {

        alert(
            error.message ||
            "Ошибка загрузки"
        );

    }

}

window.openUserRoleManager =
    openUserRoleManager;

`;

    app += ui;

}


fs.writeFileSync(
    appFile,
    app
);


/* =========================================================
   CSS
========================================================= */

let css =
    fs.readFileSync(
        cssFile,
        "utf8"
    );


if (!css.includes(
    "ARIZONA_CIVIL_ROLE_FINAL_CSS"
)) {

    css += `

/* =========================================================
   ARIZONA_CIVIL_ROLE_FINAL_CSS
========================================================= */

.supervisor-v201-assistant {

    border:
        1px solid
        rgba(255, 210, 90, .10);

}

.supervisor-v201-assistant-data span {

    color:
        rgba(255, 210, 90, .85);

}

.role-leader {

    border-color:
        rgba(255, 210, 90, .35) !important;

}

.role-deputy {

    border-color:
        rgba(130, 180, 255, .35) !important;

}

`;

}


fs.writeFileSync(
    cssFile,
    css
);


/* =========================================================
   PACKAGE.JSON
========================================================= */

const packageFile =
    path.join(
        root,
        "package.json"
    );

if (
    fs.existsSync(packageFile)
) {

    const pkg =
        JSON.parse(
            fs.readFileSync(
                packageFile,
                "utf8"
            )
        );

    pkg.scripts =
        pkg.scripts || {};

    pkg.scripts.start =
        "node server.js";

    pkg.scripts.dev =
        "node server.js";

    pkg.scripts.check =
        "node --check server.js && node --check public/app.js";

    fs.writeFileSync(
        packageFile,
        JSON.stringify(
            pkg,
            null,
            2
        ) + "\n"
    );

    console.log(
        "✅ package.json обновлён"
    );

}


/* =========================================================
   RENDER.YAML
========================================================= */

const renderYaml = `services:

  - type: web

    name: arizona-civil

    runtime: node

    plan: free

    buildCommand: npm install

    startCommand: npm start

    healthCheckPath: /health

    envVars:

      - key: NODE_ENV
        value: production

      - key: DATABASE_URL
        fromDatabase:
          name: arizona-civil-db
          property: connectionString

      - key: SESSION_SECRET
        generateValue: true

      - key: PG_POOL_MAX
        value: "10"


databases:

  - name: arizona-civil-db

    plan: free

`;

fs.writeFileSync(
    path.join(
        root,
        "render.yaml"
    ),
    renderYaml
);

console.log(
    "✅ render.yaml создан"
);


/* =========================================================
   .GITIGNORE
========================================================= */

const gitignore = `
node_modules/
.env
.env.*
!.env.example

*.backup-*
*.bak

arizona-data.json

npm-debug.log*
.DS_Store
`;

fs.writeFileSync(
    path.join(
        root,
        ".gitignore"
    ),
    gitignore.trim() + "\n"
);

console.log(
    "✅ .gitignore создан"
);


/* =========================================================
   ENV EXAMPLE
========================================================= */

const envExample = `
NODE_ENV=production
PORT=3000
DATABASE_URL=
SESSION_SECRET=
PG_POOL_MAX=10
`;

fs.writeFileSync(
    path.join(
        root,
        ".env.example"
    ),
    envExample.trim() + "\n"
);

console.log(
    "✅ .env.example создан"
);


/* =========================================================
   FINAL
========================================================= */

console.log("");
console.log("==========================================");
console.log(" ARIZONA CIVIL 2.0 — FINAL");
console.log("==========================================");
console.log("✅ Помощник следящего добавлен");
console.log("   Должность:");
console.log("   Помощник следящего за гражданской структурой");
console.log("");
console.log("Иерархия:");
console.log("0   Пользователь");
console.log("5   Помощник следящего");
console.log("10  Следящий");
console.log("12  Лидер");
console.log("13  Заместитель");
console.log("20  ЗГС гражданских");
console.log("30  ГС гражданских");
console.log("40  ЗГС ГОС");
console.log("50  ГС ГОС");
console.log("100 Разработчик");
console.log("");
console.log("✅ Лидер / Заместитель");
console.log("   назначаются:");
console.log("   Разработчиком");
console.log("   ГС ГОС");
console.log("   ЗГС ГОС");
console.log("   ГС гражданских");
console.log("   ЗГС гражданских");
console.log("");
console.log("✅ /health");
console.log("✅ Render PORT");
console.log("✅ Render PostgreSQL");
console.log("✅ SESSION_SECRET");
console.log("✅ Graceful shutdown");
console.log("✅ render.yaml");
console.log("✅ .gitignore");
console.log("✅ .env.example");
console.log("==========================================");
