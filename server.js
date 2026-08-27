
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

require('dotenv').config();
const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
        initDatabase,
        initDatabaseV30,
        initDatabaseV40,
        initDatabaseV41,
        query,
        pool
    } = require("./db");
const {
    canManagePersonnel,
    canManageSupervisors,
    canAssignLeader,
    canAssignDeputy,
    canManageAssistant,
    canManageOwnStructure
} = require("./permissions");

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


        await query(`
            CREATE TABLE IF NOT EXISTS supervisor_assistants (
                id BIGINT PRIMARY KEY,
                supervisor_id BIGINT REFERENCES supervisors(id) ON DELETE CASCADE,
                name VARCHAR(150) NOT NULL,
                role VARCHAR(100) NOT NULL DEFAULT 'Помощник следящего',
                position VARCHAR(200) NOT NULL DEFAULT 'Помощник следящего',
                vk TEXT DEFAULT '',
                avatar_url TEXT DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_supervisor_assistants_supervisor
            ON supervisor_assistants(supervisor_id)
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_supervisor_assistants_created
            ON supervisor_assistants(created_at DESC)
        `);

        console.log("✅ Arizona Civil 2.0: supervisors обновлены");
    } catch (error) {
        console.error("❌ Ошибка миграции supervisors:", error.message);
    }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const DATA_FILE = path.join(__dirname, "arizona-data.json");

const ORGANIZATIONS = [
    "Правительство",
    "ГЦЛ",
    "СМИ г. Лос Сантос",
    "СМИ г. Сан-Фиерро",
    "СМИ г. Лас-Вентурас",
    "Страховая компания",
    "Больница г. Лос Сантос",
    "Больница г. Сан-Фиерро",
    "Больница г. Лас-Вентурас",
    "Больница Джефферсон",
    "Прокуратура",
    "Адвокатура",
    "Конгресс",
    "Пожарный департамент"
];

const ROLES = {
    USER: "Пользователь",
    DEVELOPER: "Разработчик",
    GS_GOS: "ГС ГОС",
    ZGS_GOS: "ЗГС ГОС",
    GS_CIVIL: "ГС гражданских",
    ZGS_CIVIL: "ЗГС гражданских",
    FOLLOWER: "Следящий",
    LEADER: "Лидер",
    DEPUTY: "Заместитель",
    SUPERVISOR_ASSISTANT: "Помощник следящего"
};

const ROLE_LEVEL = {
    [ROLES.USER]: 0,
    [ROLES.ASSISTANT]: 5,
    [ROLES.FOLLOWER]: 10,
    [ROLES.SUPERVISOR_ASSISTANT]: 15,
    [ROLES.ZGS_CIVIL]: 20,
    [ROLES.GS_CIVIL]: 30,
    [ROLES.ZGS_GOS]: 40,
    [ROLES.GS_GOS]: 50,
    [ROLES.DEVELOPER]: 100
};


/* =========================================================
   ARIZONA_CIVIL_201_PERMISSIONS
========================================================= */

const ROLE_PERMISSIONS = {
    [ROLES.USER]: [
        "view"
    ],

    [ROLES.ASSISTANT]: [
        "view",
        "view_civil",
        "view_supervisors",
        "view_leaders"
    ],

    [ROLES.FOLLOWER]: [
        "view",
        "view_civil",
        "view_supervisors",
        "view_leaders",
        "manage_own_assistants"
    ],

    [ROLES.ZGS_CIVIL]: [
        "view",
        "view_civil",
        "view_supervisors",
        "view_leaders",
        "manage_supervisors",
        "manage_assistants",
        "manage_deputies",
        "manage_civil"
    ],

    [ROLES.GS_CIVIL]: [
        "view",
        "view_civil",
        "view_supervisors",
        "view_leaders",
        "manage_supervisors",
        "manage_assistants",
        "manage_deputies",
        "manage_civil",
        "manage_penalties"
    ],

    [ROLES.ZGS_GOS]: [
        "view",
        "view_gos",
        "manage_gos_leaders",
        "manage_gos_deputies"
    ],

    [ROLES.GS_GOS]: [
        "view",
        "view_gos",
        "manage_gos_leaders",
        "manage_gos_deputies",
        "manage_gos"
    ],

    [ROLES.DEVELOPER]: [
        "*"
    ]
};

function hasPermission(role, permission) {
    const permissions = ROLE_PERMISSIONS[role] || [];

    return (
        permissions.includes("*") ||
        permissions.includes(permission)
    );
}

function createDatabase() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify({
                users: [],
                leaders: [],
                deputies: [],
                penalties: [],
                supervisors: [],
                journal: []
            }, null, 2)
        );
    }

    const data = loadData();

    if (!data.users) data.users = [];
    if (!data.leaders) data.leaders = [];
    if (!data.deputies) data.deputies = [];
    if (!data.penalties) data.penalties = [];
    if (!data.supervisors) data.supervisors = [];
    if (!data.journal) data.journal = [];

    saveData(data);
}

function loadData() {
    return JSON.parse(
        fs.readFileSync(DATA_FILE, "utf8")
    );
}

function saveData(data) {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(data, null, 2)
    );
}

function hashPassword(password) {
    return crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");
}

async function audit(
    actor,
    action,
    details = "",
    targetUserId = null
) {
    try {

        await query(
            `
            INSERT INTO audit_log
                (actor, action, details, target_user_id)
            VALUES
                ($1, $2, $3, $4)
            `,
            [
                actor,
                action,
                details,
                targetUserId
            ]
        );

    } catch (error) {

        console.error(
            "Ошибка записи аудита:",
            error.message
        );
    }
}

function journal(data, actor, action, details) {
    data.journal.unshift({
        id: Date.now(),
        date: new Date().toISOString(),
        actor,
        action,
        details
    });

    data.journal = data.journal.slice(0, 500);
}

function hasRole(user, minimumRole) {
    if (!user) return false;

    return ROLE_LEVEL[user.role] >=
           ROLE_LEVEL[minimumRole];
}

function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            error: "Необходима авторизация"
        });
    }

    next();
}

function requireRole(minimumRole) {
    return (req, res, next) => {

        if (!req.session.user) {
            return res.status(401).json({
                error: "Необходима авторизация"
            });
        }

        if (!hasRole(req.session.user, minimumRole)) {
            return res.status(403).json({
                error: "Недостаточно прав"
            });
        }

        next();
    };
}

function findLeader(data, id) {
    return data.leaders.find(
        x => x.id === Number(id)
    );
}

createDatabase();

app.use(express.json());

/*
=========================================================
 ARIZONA CIVIL 2.2 — RENDER HEALTH CHECK
=========================================================
*/



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
                `
                SELECT
                    id,
                    action,
                    details,
                    actor,
                    created_at
                FROM personnel_history
                WHERE user_id = $1
                ORDER BY created_at DESC
                `,
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
                `
                SELECT id, username, role
                FROM users
                WHERE id = $1
                `,
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
                `
                UPDATE users
                SET
                    role = 'Лидер',
                    organization = $1,
                    appointed_at = NOW(),
                    appointed_by = $2
                WHERE id = $3
                `,
                [
                    organization,
                    actor.username,
                    userId
                ]
            );

            await query(
                `
                INSERT INTO appointments
                    (
                        user_id,
                        organization,
                        role,
                        appointed_by
                    )
                VALUES
                    ($1, $2, 'Лидер', $3)
                `,
                [
                    userId,
                    organization,
                    actor.username
                ]
            );

            await query(
                `
                INSERT INTO role_history
                    (
                        user_id,
                        old_role,
                        new_role,
                        changed_by
                    )
                VALUES
                    ($1, $2, 'Лидер', $3)
                `,
                [
                    userId,
                    oldRole,
                    actor.username
                ]
            );

            await query(
                `
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
                `,
                [
                    userId,
                    organization,
                    actor.username
                ]
            );

            await audit(
                actor.username,
                "Назначен лидер",
                `${user.username}: ${organization}`,
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
                `
                SELECT id, username, role
                FROM users
                WHERE id = $1
                `,
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
                `
                UPDATE users
                SET
                    role = 'Заместитель',
                    organization = $1,
                    appointed_at = NOW(),
                    appointed_by = $2
                WHERE id = $3
                `,
                [
                    organization,
                    actor.username,
                    userId
                ]
            );

            await query(
                `
                INSERT INTO appointments
                    (
                        user_id,
                        organization,
                        role,
                        appointed_by
                    )
                VALUES
                    ($1, $2, 'Заместитель', $3)
                `,
                [
                    userId,
                    organization,
                    actor.username
                ]
            );

            await query(
                `
                INSERT INTO role_history
                    (
                        user_id,
                        old_role,
                        new_role,
                        changed_by
                    )
                VALUES
                    ($1, $2, 'Заместитель', $3)
                `,
                [
                    userId,
                    oldRole,
                    actor.username
                ]
            );

            await query(
                `
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
                `,
                [
                    userId,
                    organization,
                    actor.username
                ]
            );

            await audit(
                actor.username,
                "Назначен заместитель",
                `${user.username}: ${organization}`,
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



// Статические файлы сайта: CSS, JS, изображения и т.д.


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


app.use(express.static(path.join(__dirname, "public")));

app.use(session({
    store: new pgSession({
        pool,
        tableName: "user_sessions",
        createTableIfMissing: true
    }),

    secret: process.env.SESSION_SECRET ||
        "CHANGE_THIS_SECRET_ARIZONA_CIVIL",

    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));


/*
=========================================
 VK API — PROFILE / AVATAR
=========================================
*/

function extractVkIdentifier(value) {

    if (!value) return null;

    const input = String(value).trim();

    if (!input) return null;

    try {

        const url = new URL(
            input.startsWith("http")
                ? input
                : `https://${input}`
        );

        const parts = url.pathname
            .split("/")
            .filter(Boolean);

        return parts[0] || null;

    } catch {

        return input
            .replace(/^@/, "")
            .split(/[/?#]/)[0]
            .trim() || null;
    }
}


async function getVkProfile(vkUrl) {

    const identifier = extractVkIdentifier(vkUrl);

    if (!identifier) {
        return null;
    }

    if (!process.env.VK_SERVICE_TOKEN) {

        console.warn(
            "⚠️ VK_SERVICE_TOKEN отсутствует — аватар не получен"
        );

        return null;
    }

    try {

        const params = new URLSearchParams({

            user_ids: identifier,

            fields:
                "photo_max,photo_200,screen_name",

            access_token:
                process.env.VK_SERVICE_TOKEN,

            v: "5.199"
        });

        const response = await fetch(
            `https://api.vk.com/method/users.get?${params}`
        );

        const data = await response.json();

        if (data.error) {

            console.warn(
                "⚠️ VK API:",
                data.error.error_msg
            );

            return null;
        }

        const user =
            data.response?.[0];

        if (!user) {

            console.warn(
                "⚠️ VK пользователь не найден:",
                identifier
            );

            return null;
        }

        return {

            id: user.id,

            screen_name:
                user.screen_name ||
                identifier,

            avatar_url:
                user.photo_max ||
                user.photo_200 ||
                null
        };

    } catch (error) {

        console.error(
            "⚠️ Ошибка VK API:",
            error.message
        );

        return null;
    }
}


/*
=========================================
 AUTH
=========================================
*/


app.post("/api/auth/register", async (req, res) => {

    const {
        username,
        password
    } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: "Введите логин и пароль"
        });
    }

    const cleanUsername = String(username).trim();
    const cleanPassword = String(password);

    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
        return res.status(400).json({
            error: "Логин должен содержать от 3 до 30 символов"
        });
    }

    if (cleanPassword.length < 6) {
        return res.status(400).json({
            error: "Пароль должен содержать минимум 6 символов"
        });
    }

    try {

        const existing = await query(
            `
            SELECT id
            FROM users
            WHERE LOWER(username) = LOWER($1)
            LIMIT 1
            `,
            [cleanUsername]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: "Такой пользователь уже существует"
            });
        }

        const result = await query(
            `
            INSERT INTO users
                (username, password_hash, role, active)
            VALUES
                ($1, $2, $3, TRUE)
            RETURNING id, username, role, active
            `,
            [
                cleanUsername,
                hashPassword(cleanPassword),
                ROLES.USER
            ]
        );

        const user = result.rows[0];

        console.log(
            `Новый пользователь зарегистрирован: ${user.username}`
        );

        await audit(
            user.username,
            "Регистрация",
            "Создан новый аккаунт",
            user.id
        );


        res.status(201).json({
            success: true,
            message: "Регистрация успешно завершена",
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {

        console.error("Ошибка регистрации:", error);

        res.status(500).json({
            error: "Ошибка сервера"
        });
    }
});

app.post("/api/auth/login", async (req, res) => {

    const {
        username,
        password
    } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: "Введите логин и пароль"
        });
    }

    try {

        const result = await query(
            `
            SELECT
                id,
                username,
                password_hash,
                role,
                active,
                avatar_url
            FROM users
            WHERE LOWER(username) = LOWER($1)
            LIMIT 1
            `,
            [String(username).trim()]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({
                error: "Неверный логин или пароль"
            });
        }

        if (!user.active) {
            return res.status(403).json({
                error: "Аккаунт заблокирован"
            });
        }

        if (
            user.password_hash !==
            hashPassword(String(password))
        ) {
            return res.status(401).json({
                error: "Неверный логин или пароль"
            });
        }

        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            avatar_url: user.avatar_url || null
        };

        res.json({
            success: true,
            user: req.session.user
        });

    } catch (error) {

        console.error("Ошибка авторизации:", error);

        res.status(500).json({
            error: "Ошибка сервера"
        });
    }
});

app.post("/api/auth/logout", requireAuth, (req, res) => {

    req.session.destroy(() => {
        res.json({
            success: true
        });
    });
});

app.get("/api/auth/me", (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({
            authenticated: false
        });
    }

    res.json({
        authenticated: true,
        user: req.session.user
    });
});

/*
=========================================
 USERS
=========================================
*/

app.get(
    "/api/users",
    requireRole(ROLES.DEVELOPER),
    async (req, res) => {

        try {

            const result = await query(`
                SELECT
                    id,
                    username,
                    role,
                    name,
                    position,
                    active,
                    created_at
                FROM users
                ORDER BY id
            `);

            res.json(result.rows);

        } catch (error) {

            console.error("Ошибка получения пользователей:", error);

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

app.post(
    "/api/users",
    requireRole(ROLES.DEVELOPER),
    async (req, res) => {

        const {
            username,
            password,
            role
        } = req.body;

        if (!username || !password || !role) {
            return res.status(400).json({
                error: "Заполните все поля"
            });
        }

        if (!Object.values(ROLES).includes(role)) {
            return res.status(400).json({
                error: "Неизвестная роль"
            });
        }

        const cleanUsername = String(username).trim();

        if (cleanUsername.length < 3 || cleanUsername.length > 30) {
            return res.status(400).json({
                error: "Логин должен содержать от 3 до 30 символов"
            });
        }

        if (String(password).length < 6) {
            return res.status(400).json({
                error: "Пароль должен содержать минимум 6 символов"
            });
        }

        try {

            const existing = await query(
                `
                SELECT id
                FROM users
                WHERE LOWER(username) = LOWER($1)
                LIMIT 1
                `,
                [cleanUsername]
            );

            if (existing.rows.length > 0) {
                return res.status(409).json({
                    error: "Такой пользователь уже существует"
                });
            }

            const result = await query(
                `
                INSERT INTO users
                    (username, password_hash, role, active)
                VALUES
                    ($1, $2, $3, TRUE)
                RETURNING id, username, role, active
                `,
                [
                    cleanUsername,
                    hashPassword(String(password)),
                    role
                ]
            );

            const user = result.rows[0];

            console.log(
                `Разработчик ${req.session.user.username} создал пользователя ${user.username}`
            );

            res.status(201).json(user);

        } catch (error) {

            console.error("Ошибка создания пользователя:", error);

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);



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
                    `
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
                    `,
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
                `${user.username}: ${targetRole}`,
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


app.patch(
    "/api/users/:id/role",
    requireRole(ROLES.DEVELOPER),
    async (req, res) => {

        const {
            role
        } = req.body;

        if (!Object.values(ROLES).includes(role)) {
            return res.status(400).json({
                error: "Неизвестная роль"
            });
        }

        try {

            const existing = await query(
                `
                SELECT id, username, role
                FROM users
                WHERE id = $1
                `,
                [Number(req.params.id)]
            );

            if (existing.rows.length === 0) {
                return res.status(404).json({
                    error: "Пользователь не найден"
                });
            }

            const oldRole = existing.rows[0].role;

            const result = await query(
                `
                UPDATE users
                SET role = $1
                WHERE id = $2
                RETURNING id, username, role, active
                `,
                [
                    role,
                    Number(req.params.id)
                ]
            );

            const user = result.rows[0];

            console.log(
                `Разработчик ${req.session.user.username}: ${user.username} — ${oldRole} → ${role}`
            );

            await audit(
                req.session.user.username,
                "Изменение роли",
                `${user.username}: ${oldRole} → ${role}`,
                user.id
            );


            res.json({
                success: true,
                user
            });

        } catch (error) {

            console.error("Ошибка изменения роли:", error);

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);


app.patch(
    "/api/users/:id/status",
    requireRole(ROLES.DEVELOPER),
    async (req, res) => {

        const { active } = req.body;

        if (typeof active !== "boolean") {
            return res.status(400).json({
                error: "Поле active должно быть true или false"
            });
        }

        const userId = Number(req.params.id);

        if (!Number.isInteger(userId)) {
            return res.status(400).json({
                error: "Некорректный ID пользователя"
            });
        }

        try {

            const existing = await query(
                `
                SELECT id, username, role, active
                FROM users
                WHERE id = $1
                `,
                [userId]
            );

            if (existing.rows.length === 0) {
                return res.status(404).json({
                    error: "Пользователь не найден"
                });
            }

            const target = existing.rows[0];

            /*
             * Разработчик не может заблокировать
             * сам себя.
             */
            if (
                target.id ===
                Number(req.session.user.id)
            ) {
                return res.status(400).json({
                    error: "Нельзя изменить статус собственного аккаунта"
                });
            }

            const result = await query(
                `
                UPDATE users
                SET active = $1
                WHERE id = $2
                RETURNING id, username, role, active
                `,
                [active, userId]
            );

            const user = result.rows[0];

            console.log(
                `Статус пользователя ${user.username}: ` +
                `${target.active ? "активен" : "заблокирован"} → ` +
                `${active ? "активен" : "заблокирован"}`
            );

            await audit(
                req.session.user.username,
                active
                    ? "Разблокировка"
                    : "Блокировка",
                `${user.username}: ${
                    active
                        ? "активен"
                        : "заблокирован"
                }`,
                user.id
            );


            res.json({
                success: true,
                user
            });

        } catch (error) {

            console.error(
                "Ошибка изменения статуса пользователя:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

/*
=========================================
 CONFIG
=========================================
*/

app.get(
    "/api/config",
    requireAuth,
    (req, res) => {

        res.json({
            organizations: ORGANIZATIONS,
            roles: Object.values(ROLES),
            currentUser: req.session.user
        });
    }
);

/*
=========================================
 STATS
=========================================
*/

app.get(
    "/api/stats",
    requireAuth,
    (req, res) => {

        const data = loadData();

        const today = new Date();

        const activeLeaders =
            data.leaders.filter(l =>
                l.status === "Активен" &&
                new Date(l.end_date) >= today
            );

        const endingSoon =
            activeLeaders.filter(l => {

                const diff =
                    new Date(l.end_date) - today;

                return diff >= 0 &&
                    diff <= 7 * 86400000;
            });

        res.json({
            leaders: activeLeaders.length,
            penalties: data.penalties.length,
            active: activeLeaders.length,
            ending: endingSoon.length,
            deputies: data.deputies.length,
            supervisors: data.supervisors.length
        });
    }
);

/*
=========================================
 LEADERS
=========================================
*/

app.get(
    "/api/leaders",
    requireAuth,
    async (req, res) => {

        try {

            const result = await query(`
                SELECT
                    id,
                    organization AS structure,
                    name AS leader,
                    nickname AS vk,
                    avatar_url,
                    start_date,
                    end_date,
                    status
                FROM leaders
                ORDER BY end_date ASC
            `);

            res.json(result.rows);

        } catch (error) {

            console.error(
                "Ошибка получения лидеров:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

app.post(
    "/api/leaders",
    requireRole(ROLES.ZGS_CIVIL),
    async (req, res) => {

        const {
            structure,
            leader,
            vk,
            start_date,
            end_date
        } = req.body;

        if (
            !structure ||
            !leader ||
            !start_date ||
            !end_date
        ) {
            return res.status(400).json({
                error: "Заполните обязательные поля"
            });
        }

        if (!ORGANIZATIONS.includes(structure)) {
            return res.status(400).json({
                error: "Неизвестная организация"
            });
        }

        try {

            const id = Date.now();

            /*
             * VK avatar is optional.
             * If VK is unavailable, leader creation still succeeds.
             */
            const vkProfile =
                await getVkProfile(vk || "");

            const avatarUrl =
                vkProfile?.avatar_url || null;

            console.log(
                vkProfile
                    ? `✅ VK avatar найден: ${structure} → ${vkProfile.screen_name}`
                    : `ℹ️ VK avatar не найден: ${structure}`
            );

            const result = await query(
                `
                INSERT INTO leaders
                    (
                        id,
                        organization,
                        name,
                        nickname,
                        position,
                        start_date,
                        end_date,
                        status,
                        avatar_url
                    )
                VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        'Активен',
                        $8
                    )
                RETURNING
                    id,
                    organization AS structure,
                    name AS leader,
                    nickname AS vk,
                    position,
                    start_date,
                    end_date,
                    status,
                    avatar_url
                `,
                [
                    id,
                    structure,
                    leader,
                    vk || "",
                    "",
                    start_date,
                    end_date,
                    avatarUrl
                ]
            );

            const item = result.rows[0];

            await audit(
                req.session.user.username,
                "Добавление лидера",
                `${structure}: ${leader}`,
                id
            );

            res.json(item);

        } catch (error) {

            console.error(
                "Ошибка добавления лидера:",
                error
            );

            // PostgreSQL: в организации уже есть активный лидер
            if (error.code === "23505" &&
                error.constraint === "unique_active_leader_per_organization") {

                return res.status(409).json({
                    error:
                        `В организации «${structure}» уже назначен активный лидер. ` +
                        `Сначала удалите текущего лидера или дождитесь окончания его срока.`
                });
            }

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

/*
=========================================
 CHANGE DAYS
=========================================
*/


app.put(
    "/api/leaders/:id",
    requireRole(ROLES.ZGS_CIVIL),
    async (req, res) => {

        const id = Number(req.params.id);
        const {
            structure,
            leader,
            vk,
            start_date,
            end_date
        } = req.body;

        if (!structure || !leader || !start_date || !end_date) {
            return res.status(400).json({
                error: "Заполните обязательные поля"
            });
        }

        if (!ORGANIZATIONS.includes(structure)) {
            return res.status(400).json({
                error: "Неизвестная организация"
            });
        }

        if (end_date < start_date) {
            return res.status(400).json({
                error: "Дата окончания не может быть раньше даты начала"
            });
        }

        try {
            const oldResult = await query(
                `
                SELECT
                    id,
                    organization,
                    name,
                    nickname,
                    avatar_url
                FROM leaders
                WHERE id = $1
                `,
                [id]
            );

            if (oldResult.rows.length === 0) {
                return res.status(404).json({
                    error: "Лидер не найден"
                });
            }

            const oldLeader = oldResult.rows[0];

            let avatarUrl = oldLeader.avatar_url || null;
            let savedVk = vk || "";

            if (vk && vk !== oldLeader.nickname) {
                const vkProfile = await getVkProfile(vk);

                if (vkProfile) {
                    avatarUrl =
                        vkProfile.avatar_url || null;

                    savedVk =
                        vkProfile.screen_name || vk;
                }
            }

            const result = await query(
                `
                UPDATE leaders
                SET
                    organization = $1,
                    name = $2,
                    nickname = $3,
                    start_date = $4,
                    end_date = $5,
                    avatar_url = $6,
                    updated_at = NOW()
                WHERE id = $7
                RETURNING
                    id,
                    organization AS structure,
                    name AS leader,
                    nickname AS vk,
                    position,
                    start_date,
                    end_date,
                    status,
                    avatar_url
                `,
                [
                    structure,
                    leader,
                    savedVk,
                    start_date,
                    end_date,
                    avatarUrl,
                    id
                ]
            );

            const item = result.rows[0];

            await audit(
                req.session.user.username,
                "Изменение лидера",
                `${structure}: ${leader}`,
                id
            );

            res.json(item);

        } catch (error) {
            console.error(
                "Ошибка изменения лидера:",
                error
            );

            if (
                error.code === "23505" &&
                error.constraint ===
                    "unique_active_leader_per_organization"
            ) {
                return res.status(409).json({
                    error:
                        `В организации «${structure}» уже назначен активный лидер.`
                });
            }

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);


app.post(
    "/api/leaders/:id/days",
    requireRole(ROLES.ZGS_CIVIL),
    async (req, res) => {

        const amount = Number(req.body.days);

        if (!Number.isInteger(amount)) {
            return res.status(400).json({
                error: "Введите целое количество дней"
            });
        }

        try {

            const result = await query(
                `
                SELECT
                    id,
                    organization,
                    name,
                    nickname,
                    end_date
                FROM leaders
                WHERE id = $1
                `,
                [Number(req.params.id)]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Лидер не найден"
                });
            }

            const leader = result.rows[0];

            const date = new Date(
                leader.end_date + "T00:00:00"
            );

            date.setDate(
                date.getDate() + amount
            );

            const newDate =
                date.toISOString().slice(0, 10);

            await query(
                `
                UPDATE leaders
                SET
                    end_date = $1,
                    updated_at = NOW()
                WHERE id = $2
                `,
                [
                    newDate,
                    Number(req.params.id)
                ]
            );

            await audit(
                req.session.user.username,
                amount >= 0
                    ? "Добавление дней"
                    : "Снятие дней",
                `${leader.organization}: ${leader.name}; ${amount} дней`,
                leader.id
            );

            res.json({
                success: true,
                old_date: leader.end_date,
                new_date: newDate
            });

        } catch (error) {

            console.error(
                "Ошибка изменения срока лидера:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

/*
=========================================
 REMOVE LEADER
=========================================
*/

app.delete(
    "/api/leaders/:id",
    requireRole(ROLES.GS_CIVIL),
    async (req, res) => {

        try {

            const result = await query(
                `
                SELECT
                    id,
                    organization,
                    name
                FROM leaders
                WHERE id = $1
                `,
                [Number(req.params.id)]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Лидер не найден"
                });
            }

            const leader = result.rows[0];

            await query(
                `
                DELETE FROM leaders
                WHERE id = $1
                `,
                [Number(req.params.id)]
            );

            await audit(
                req.session.user.username,
                "Снятие лидера",
                `${leader.organization}: ${leader.name}`,
                leader.id
            );

            res.json({
                success: true
            });

        } catch (error) {

            console.error(
                "Ошибка удаления лидера:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

const PENALTY_TYPES = [
    "Предупреждение",
    "Выговор",
    "Неснимаемое предупреждение",
    "Неснимаемый выговор"
];

/*
=========================================
 PENALTIES
=========================================
*/

app.get(
    "/api/penalties",
    requireAuth,
    (req, res) => {

        const data = loadData();

        res.json(
            data.penalties
                .map(p => {

                    const leader =
                        findLeader(
                            data,
                            p.leader_id
                        );

                    return {
                        ...p,
                        structure:
                            leader?.structure || "—",
                        leader:
                            leader?.leader || "—"
                    };
                })
                .sort(
                    (a, b) =>
                        new Date(b.date) -
                        new Date(a.date)
                )
        );
    }
);

app.post(
    "/api/penalties",
    requireRole(ROLES.FOLLOWER),
    (req, res) => {

        const {
            leader_id,
            type,
            reason,
            amount = 0
        } = req.body;

        if (!leader_id || !type || !reason) {
            return res.status(400).json({
                error: "Заполните обязательные поля"
            });
        }

        const data = loadData();

        const leader =
            findLeader(data, leader_id);

        if (!leader) {
            return res.status(404).json({
                error: "Лидер не найден"
            });
        }

        
        if (!PENALTY_TYPES.includes(type)) {
            return res.status(400).json({
                error: "Неизвестный тип наказания"
            });
        }

const penalty = {
            id: Date.now(),
            leader_id: Number(leader_id),
            type,
            reason,
            amount: Number(amount) || 0,
            date: new Date()
                .toISOString()
                .slice(0, 10),
            issued_by:
                req.session.user.username
        };

        data.penalties.push(penalty);

        journal(
            data,
            req.session.user.username,
            "Выдано наказание",
            `${leader.leader}: ${type} — ${reason}`
        );

        saveData(data);

        res.json(penalty);
    }
);


/*
=========================================
 DEPUTIES
=========================================
*/

/*
=========================================
 DEPUTIES — POSTGRESQL
=========================================
*/

app.get(
    "/api/deputies",
    requireAuth,
    async (req, res) => {
        try {
            const result = await query(`
                SELECT
                    id,
                    leader_id,
                    organization AS structure,
                    name AS deputy,
                    nickname AS vk,
                    position,
                    start_date,
                    end_date,
                    status,
                    created_at,
                    updated_at
                FROM deputies
                ORDER BY organization, name
            `);

            res.json(result.rows);

        } catch (error) {
            console.error("Ошибка получения заместителей:", error);

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

app.post(
    "/api/deputies",
    requireRole(ROLES.ZGS_CIVIL),
    async (req, res) => {

        const {
            structure,
            deputy,
            vk = "",
            position = "Заместитель",
            start_date = null,
            end_date = null
        } = req.body;

        if (!structure || !deputy) {
            return res.status(400).json({
                error: "Заполните обязательные поля"
            });
        }

        if (structure === "Конгресс") {
            return res.status(400).json({
                error: "У Конгресса нет должности заместителя"
            });
        }

        if (!ORGANIZATIONS.includes(structure)) {
            return res.status(400).json({
                error: "Неизвестная организация"
            });
        }

        try {

            const id =
                Date.now() +
                Math.floor(Math.random() * 1000);

            const leaderResult = await query(
                `
                SELECT id
                FROM leaders
                WHERE organization = $1
                  AND status = 'Активен'
                ORDER BY end_date DESC
                LIMIT 1
                `,
                [structure]
            );

            const leaderId =
                leaderResult.rows[0]?.id || null;

            const result = await query(
                `
                INSERT INTO deputies
                (
                    id,
                    leader_id,
                    organization,
                    name,
                    nickname,
                    position,
                    start_date,
                    end_date,
                    status,
                    created_at,
                    updated_at
                )
                VALUES
                (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()
                )
                RETURNING
                    id,
                    leader_id,
                    organization AS structure,
                    name AS deputy,
                    nickname AS vk,
                    position,
                    start_date,
                    end_date,
                    status,
                    created_at,
                    updated_at
                `,
                [
                    id,
                    leaderId,
                    structure,
                    String(deputy).trim(),
                    String(vk || "").trim(),
                    position,
                    start_date || null,
                    end_date || null,
                    "Активен"
                ]
            );

            await audit(
                req.session.user.username,
                "Добавление заместителя",
                `${structure}: ${deputy}`,
                id
            );

            res.json(result.rows[0]);

        } catch (error) {

            console.error(
                "Ошибка добавления заместителя:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

app.patch(
    "/api/deputies/:id",
    requireRole(ROLES.ZGS_CIVIL),
    async (req, res) => {

        const name =
            String(req.body.deputy || "").trim();

        if (!name) {
            return res.status(400).json({
                error: "Введите новый ник"
            });
        }

        try {

            const result = await query(
                `
                UPDATE deputies
                SET
                    name = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING
                    id,
                    leader_id,
                    organization AS structure,
                    name AS deputy,
                    nickname AS vk,
                    position,
                    start_date,
                    end_date,
                    status
                `,
                [
                    name,
                    Number(req.params.id)
                ]
            );

            if (!result.rows.length) {
                return res.status(404).json({
                    error: "Заместитель не найден"
                });
            }

            await audit(
                req.session.user.username,
                "Изменение ника заместителя",
                `ID ${req.params.id} → ${name}`,
                Number(req.params.id)
            );

            res.json({
                success: true,
                deputy: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Ошибка изменения заместителя:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

app.delete(
    "/api/deputies/:id",
    requireRole(ROLES.ZGS_CIVIL),
    async (req, res) => {

        try {

            const result = await query(
                `
                DELETE FROM deputies
                WHERE id = $1
                RETURNING
                    id,
                    organization,
                    name
                `,
                [Number(req.params.id)]
            );

            if (!result.rows.length) {
                return res.status(404).json({
                    error: "Заместитель не найден"
                });
            }

            const deputy = result.rows[0];

            await audit(
                req.session.user.username,
                "Удаление заместителя",
                `${deputy.organization}: ${deputy.name}`,
                deputy.id
            );

            res.json({
                success: true
            });

        } catch (error) {

            console.error(
                "Ошибка удаления заместителя:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

/*
=========================================
 SUPERVISORS
=========================================
*/

/*
=========================================
 SUPERVISORS — POSTGRESQL
=========================================
*/

app.get(
    "/api/supervisors",
    requireAuth,
    async (req, res) => {

        try {

            const result = await query(`
                SELECT
                    id,
                    name,
                    role,
                    position,
                    supervisor_id,
                    vk,
                    avatar_url,
                    created_at,
                    updated_at
                FROM supervisors
                ORDER BY name
            `);

            res.json(result.rows);

        } catch (error) {

            console.error(
                "Ошибка получения следящих:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);


/* =========================================================
   ARIZONA_CIVIL_201_ASSISTANT_API
========================================================= */

/*
    Помощник всегда:
    role = Помощник следящего
    position =
    Помощник следящего за гражданской структурой
*/

app.get(
    "/api/supervisors/assistants",
    requireAuth,
    async (req, res) => {

        try {

            const result = await query(`
                SELECT
                    id,
                    name,
                    role,
                    position,
                    supervisor_id,
                    vk,
                    avatar_url,
                    created_at,
                    updated_at
                FROM supervisors
                WHERE role = $1
                ORDER BY name
            `, [
                ROLES.ASSISTANT
            ]);

            res.json(result.rows);

        } catch (error) {

            console.error(
                "Ошибка получения помощников:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);


app.post(
    "/api/supervisors/assistants",
    requireRole(ROLES.FOLLOWER),
    async (req, res) => {

        const name =
            String(req.body.name || "").trim();

        const supervisorId =
            Number(req.body.supervisor_id);

        const vk =
            String(req.body.vk || "").trim();

        const avatarUrl =
            String(req.body.avatar_url || "").trim();

        if (!name) {
            return res.status(400).json({
                error: "Введите имя или ник"
            });
        }

        if (!supervisorId) {
            return res.status(400).json({
                error: "Не выбран следящий"
            });
        }

        try {

            const owner = await query(
                `
                    SELECT id, name
                    FROM supervisors
                    WHERE id = $1
                    AND role = $2
                `,
                [
                    supervisorId,
                    ROLES.FOLLOWER
                ]
            );

            if (!owner.rows.length) {

                return res.status(400).json({
                    error:
                        "Помощник может быть привязан только к следящему"
                });
            }

            const id =
                Date.now() +
                Math.floor(Math.random() * 1000);

            const result = await query(
                `
                    INSERT INTO supervisors
                    (
                        id,
                        name,
                        role,
                        position,
                        supervisor_id,
                        vk,
                        avatar_url,
                        created_at,
                        updated_at
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        NOW(),
                        NOW()
                    )
                    RETURNING
                        id,
                        name,
                        role,
                        position,
                        supervisor_id,
                        vk,
                        avatar_url,
                        created_at,
                        updated_at
                `,
                [
                    id,
                    name,
                    ROLES.ASSISTANT,
                    "Помощник следящего за гражданской структурой",
                    supervisorId,
                    vk || null,
                    avatarUrl || null
                ]
            );

            await audit(
                req.session.user.username,
                "Добавлен помощник следящего",
                name,
                id
            );

            res.json(result.rows[0]);

        } catch (error) {

            console.error(
                "Ошибка добавления помощника:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);


app.patch(
    "/api/supervisors/assistants/:id",
    requireRole(ROLES.FOLLOWER),
    async (req, res) => {

        const id =
            Number(req.params.id);

        const name =
            String(req.body.name || "").trim();

        const supervisorId =
            Number(req.body.supervisor_id);

        const vk =
            String(req.body.vk || "").trim();

        const avatarUrl =
            String(req.body.avatar_url || "").trim();

        if (!name || !supervisorId) {

            return res.status(400).json({
                error:
                    "Имя и следящий обязательны"
            });
        }

        try {

            const owner = await query(
                `
                    SELECT id
                    FROM supervisors
                    WHERE id = $1
                    AND role = $2
                `,
                [
                    supervisorId,
                    ROLES.FOLLOWER
                ]
            );

            if (!owner.rows.length) {

                return res.status(400).json({
                    error:
                        "Следящий не найден"
                });
            }

            const result = await query(
                `
                    UPDATE supervisors

                    SET
                        name = $1,
                        position = $2,
                        supervisor_id = $3,
                        vk = $4,
                        avatar_url = $5,
                        updated_at = NOW()

                    WHERE id = $6
                    AND role = $7

                    RETURNING
                        id,
                        name,
                        role,
                        position,
                        supervisor_id,
                        vk,
                        avatar_url,
                        created_at,
                        updated_at
                `,
                [
                    name,
                    "Помощник следящего за гражданской структурой",
                    supervisorId,
                    vk || null,
                    avatarUrl || null,
                    id,
                    ROLES.ASSISTANT
                ]
            );

            if (!result.rows.length) {

                return res.status(404).json({
                    error:
                        "Помощник не найден"
                });
            }

            await audit(
                req.session.user.username,
                "Изменён помощник следящего",
                name,
                id
            );

            res.json(result.rows[0]);

        } catch (error) {

            console.error(
                "Ошибка изменения помощника:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);


app.delete(
    "/api/supervisors/assistants/:id",
    requireRole(ROLES.FOLLOWER),
    async (req, res) => {

        try {

            const result = await query(
                `
                    DELETE FROM supervisors
                    WHERE id = $1
                    AND role = $2

                    RETURNING
                        id,
                        name
                `,
                [
                    Number(req.params.id),
                    ROLES.ASSISTANT
                ]
            );

            if (!result.rows.length) {

                return res.status(404).json({
                    error:
                        "Помощник не найден"
                });
            }

            await audit(
                req.session.user.username,
                "Удалён помощник следящего",
                result.rows[0].name,
                result.rows[0].id
            );

            res.json({
                success: true
            });

        } catch (error) {

            console.error(
                "Ошибка удаления помощника:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

app.post(
    "/api/supervisors",
    requireRole(ROLES.ZGS_CIVIL),
    async (req, res) => {

        const {
            name,
            role = ROLES.FOLLOWER,
            position = "Следящий"
        } = req.body;

        const cleanName =
            String(name || "").trim();

        const cleanPosition =
            String(position || "").trim();

        if (!cleanName) {
            return res.status(400).json({
                error: "Введите имя"
            });
        }

        if (!cleanPosition) {
            return res.status(400).json({
                error: "Выберите должность"
            });
        }

        try {

            const id =
                Date.now() +
                Math.floor(Math.random() * 1000);

            const result = await query(
                `
                INSERT INTO supervisors
                (
                    id,
                    name,
                    role,
                    position,
                    created_at,
                    updated_at
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    NOW(),
                    NOW()
                )
                RETURNING
                    id,
                    name,
                    role,
                    position,
                    created_at,
                    updated_at
                `,
                [
                    id,
                    cleanName,
                    role,
                    cleanPosition
                ]
            );

            await audit(
                req.session.user.username,
                "Добавлен следящий",
                `${cleanName}: ${cleanPosition}`,
                id
            );

            res.json(result.rows[0]);

        } catch (error) {

            console.error(
                "Ошибка добавления следящего:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

app.patch(
    "/api/supervisors/:id",
    requireRole(ROLES.ZGS_CIVIL),
    async (req, res) => {

        const name =
            String(req.body.name || "").trim();

        const position =
            String(req.body.position || "").trim();

        if (!name) {
            return res.status(400).json({
                error: "Введите имя"
            });
        }

        if (!position) {
            return res.status(400).json({
                error: "Выберите должность"
            });
        }

        try {

            const result = await query(
                `
                UPDATE supervisors
                SET
                    name = $1,
                    position = $2,
                    updated_at = NOW()
                WHERE id = $3
                RETURNING
                    id,
                    name,
                    role,
                    position,
                    created_at,
                    updated_at
                `,
                [
                    name,
                    position,
                    Number(req.params.id)
                ]
            );

            if (!result.rows.length) {
                return res.status(404).json({
                    error: "Следящий не найден"
                });
            }

            await audit(
                req.session.user.username,
                "Изменён следящий",
                `${name}: ${position}`,
                Number(req.params.id)
            );

            res.json(result.rows[0]);

        } catch (error) {

            console.error(
                "Ошибка изменения следящего:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

app.delete(
    "/api/supervisors/:id",
    requireRole(ROLES.ZGS_CIVIL),
    async (req, res) => {

        try {

            const result = await query(
                `
                DELETE FROM supervisors
                WHERE id = $1
                RETURNING
                    id,
                    name,
                    position
                `,
                [Number(req.params.id)]
            );

            if (!result.rows.length) {
                return res.status(404).json({
                    error: "Следящий не найден"
                });
            }

            const supervisor =
                result.rows[0];

            await audit(
                req.session.user.username,
                "Удалён следящий",
                `${supervisor.name}: ${supervisor.position}`,
                supervisor.id
            );

            res.json({
                success: true
            });

        } catch (error) {

            console.error(
                "Ошибка удаления следящего:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

/*
=========================================
 JOURNAL
=========================================
*/


/*
=========================================================
 ARIZONA CIVIL 2.0
 SUPERVISOR ASSISTANTS API
=========================================================
*/

app.get(
    "/api/supervisor-assistants",
    requireAuth,
    async (req, res) => {
        try {
            const result = await query(`
                SELECT
                    a.id,
                    a.supervisor_id,
                    a.name,
                    a.role,
                    a.position,
                    a.vk,
                    a.avatar_url,
                    a.created_at,
                    a.updated_at,
                    s.name AS supervisor_name
                FROM supervisor_assistants a
                LEFT JOIN supervisors s
                    ON s.id = a.supervisor_id
                ORDER BY a.name
            `);

            res.json(result.rows);

        } catch (error) {
            console.error(
                "Ошибка получения помощников следящих:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

app.post(
    "/api/supervisor-assistants",
    requireRole(ROLES.ZGS_CIVIL),
    async (req, res) => {

        const name =
            String(req.body.name || "").trim();

        const position =
            String(
                req.body.position ||
                "Помощник следящего"
            ).trim();

        const vk =
            String(req.body.vk || "").trim();

        const avatar_url =
            String(req.body.avatar_url || "").trim();

        const supervisorId =
            req.body.supervisor_id
                ? Number(req.body.supervisor_id)
                : null;

        if (!name) {
            return res.status(400).json({
                error: "Введите имя или ник"
            });
        }

        if (!supervisorId) {
            return res.status(400).json({
                error: "Выберите следящего"
            });
        }

        try {

            const supervisorResult = await query(
                `
                SELECT id, name
                FROM supervisors
                WHERE id = $1
                `,
                [supervisorId]
            );

            if (!supervisorResult.rows.length) {
                return res.status(404).json({
                    error: "Следящий не найден"
                });
            }

            const id =
                Date.now() +
                Math.floor(Math.random() * 1000);

            const result = await query(
                `
                INSERT INTO supervisor_assistants
                (
                    id,
                    supervisor_id,
                    name,
                    role,
                    position,
                    vk,
                    avatar_url,
                    created_at,
                    updated_at
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    NOW(),
                    NOW()
                )
                RETURNING
                    id,
                    supervisor_id,
                    name,
                    role,
                    position,
                    vk,
                    avatar_url,
                    created_at,
                    updated_at
                `,
                [
                    id,
                    supervisorId,
                    name,
                    "Помощник следящего",
                    position,
                    vk,
                    avatar_url
                ]
            );

            await audit(
                req.session.user.username,
                "Добавлен помощник следящего",
                `${name}: ${position}`,
                id
            );

            res.json(result.rows[0]);

        } catch (error) {

            console.error(
                "Ошибка добавления помощника:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

app.patch(
    "/api/supervisor-assistants/:id",
    requireRole(ROLES.ZGS_CIVIL),
    async (req, res) => {

        const id =
            Number(req.params.id);

        const name =
            String(req.body.name || "").trim();

        const position =
            String(
                req.body.position ||
                "Помощник следящего"
            ).trim();

        const vk =
            String(req.body.vk || "").trim();

        const avatar_url =
            String(req.body.avatar_url || "").trim();

        const supervisorId =
            req.body.supervisor_id
                ? Number(req.body.supervisor_id)
                : null;

        if (!name) {
            return res.status(400).json({
                error: "Введите имя или ник"
            });
        }

        if (!supervisorId) {
            return res.status(400).json({
                error: "Выберите следящего"
            });
        }

        try {

            const result = await query(
                `
                UPDATE supervisor_assistants
                SET
                    supervisor_id = $1,
                    name = $2,
                    position = $3,
                    vk = $4,
                    avatar_url = $5,
                    updated_at = NOW()
                WHERE id = $6
                RETURNING
                    id,
                    supervisor_id,
                    name,
                    role,
                    position,
                    vk,
                    avatar_url,
                    created_at,
                    updated_at
                `,
                [
                    supervisorId,
                    name,
                    position,
                    vk,
                    avatar_url,
                    id
                ]
            );

            if (!result.rows.length) {
                return res.status(404).json({
                    error: "Помощник не найден"
                });
            }

            await audit(
                req.session.user.username,
                "Изменён помощник следящего",
                `${name}: ${position}`,
                id
            );

            res.json(result.rows[0]);

        } catch (error) {

            console.error(
                "Ошибка изменения помощника:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

app.delete(
    "/api/supervisor-assistants/:id",
    requireRole(ROLES.ZGS_CIVIL),
    async (req, res) => {

        const id =
            Number(req.params.id);

        try {

            const result = await query(
                `
                DELETE FROM supervisor_assistants
                WHERE id = $1
                RETURNING id, name, position
                `,
                [id]
            );

            if (!result.rows.length) {
                return res.status(404).json({
                    error: "Помощник не найден"
                });
            }

            const assistant =
                result.rows[0];

            await audit(
                req.session.user.username,
                "Удалён помощник следящего",
                `${assistant.name}: ${assistant.position}`,
                id
            );

            res.json({
                success: true
            });

        } catch (error) {

            console.error(
                "Ошибка удаления помощника:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);


app.get(
    "/api/journal",
    requireAuth,
    (req, res) => {

        const data = loadData();

        res.json(data.journal);
    }
);


/*
=========================================
 CIVIL DATA
=========================================
*/

app.get(
    "/api/data",
    requireAuth,
    (req, res) => {

        const data = loadData();

        res.json({
            organizations: ORGANIZATIONS,
            leaders: data.leaders || [],
            deputies: data.deputies || [],
            penalties: data.penalties || [],
            supervisors: data.supervisors || []
        });
    }
);

/*
=========================================
 STATIC
=========================================
*/

app.get(
    "/api/audit",
    requireRole(ROLES.DEVELOPER),
    async (req, res) => {

        try {

            const result = await query(`
                SELECT
                    id,
                    actor,
                    action,
                    details,
                    target_user_id,
                    created_at
                FROM audit_log
                ORDER BY created_at DESC
                LIMIT 500
            `);

            res.json(result.rows);

        } catch (error) {

            console.error(
                "Ошибка получения аудита:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);

app.use((req, res) => {

    if (req.path.startsWith("/api/")) {
        return res.status(404).json({
            error: "API endpoint не найден"
        });
    }

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});


/* =========================================================
   ARIZONA_CIVIL_201_MIGRATION
========================================================= */

async function initArizonaCivil201() {
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

    console.log("✅ Arizona Civil 2.0.1: миграция БД завершена");
}

async function startServer() {

    try {
        
        await initDatabase();
        if (typeof initDatabaseV30 === 'function') await initDatabaseV30();

        if (
            typeof initArizonaCivil201 ===
            "function"
        ) {
            await initArizonaCivil201();
        }
        
        await initArizonaCivil201();
        await initSupervisorV2();

        app.listen(PORT, "0.0.0.0", () => {

            console.log("");
            console.log("================================");
            console.log("       ARIZONA CIVIL");
            console.log("================================");
            console.log(`Сайт: http://localhost:${PORT}`);
            console.log("Авторизация: ВКЛ");
            console.log("PostgreSQL: ВКЛ");
            console.log("================================");
            console.log("");
        });

    } catch (error) {

        console.error("Ошибка запуска PostgreSQL:", error);
        process.exit(1);
    }
}

startServer();

/* =========================================================
   ARIZONA_CIVIL_RENDER_SHUTDOWN
========================================================= */

function shutdown(signal) {

    console.log(
        `Получен ${signal}. Завершение...`
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



/*
=========================================================
 ARIZONA CIVIL 2.2 — GRACEFUL SHUTDOWN
=========================================================
*/

async function gracefulShutdown(signal) {
    console.log(`Получен ${signal}. Завершение работы...`);

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



/*
=========================================================
 ARIZONA CIVIL 3.0 — PERSONNEL CENTER API
=========================================================
*/

app.get("/api/v3/dashboard", requireAuth, async (req, res) => {
    try {

        const users = await query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (
                    WHERE active = TRUE
                )::int AS active
            FROM users
        `);

        const roles = await query(`
            SELECT role, COUNT(*)::int AS count
            FROM users
            GROUP BY role
            ORDER BY count DESC
        `);

        const organizations = await query(`
            SELECT
                organization,
                COUNT(*)::int AS count
            FROM users
            WHERE organization IS NOT NULL
              AND organization <> ''
            GROUP BY organization
            ORDER BY count DESC
        `);

        const appointments = await query(`
            SELECT COUNT(*)::int AS count
            FROM appointments
            WHERE active = TRUE
        `);

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
                `
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
                `,
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
                `
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
                `,
                [Number(req.params.id)]
            );

            if (!userResult.rows.length) {
                return res.status(404).json({
                    error: "Сотрудник не найден"
                });
            }

            const history = await query(
                `
                SELECT
                    action,
                    details,
                    actor,
                    created_at
                FROM personnel_history
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 100
                `,
                [Number(req.params.id)]
            );

            const appointments = await query(
                `
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
                `,
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

            const result = await query(`
                SELECT
                    o.*,
                    COUNT(u.id)::int AS personnel_count
                FROM organizations o
                LEFT JOIN users u
                    ON u.organization = o.name
                GROUP BY o.id
                ORDER BY o.name
            `);

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

            const result = await query(`
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
            `);

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



/*
=========================================================
 ARIZONA_CIVIL_4_1_API
=========================================================
*/


const V41_MANAGER_ROLES = [
    "Разработчик",
    "ГС ГОС",
    "ЗГС ГОС",
    "ГС гражданских",
    "ЗГС гражданских"
];


const V41_LEADER_ROLES = [
    "Лидер",
    "Заместитель"
];


const V41_ALLOWED_ROLES = [
    "Разработчик",
    "ГС ГОС",
    "ЗГС ГОС",
    "ГС гражданских",
    "ЗГС гражданских",
    "Помощник следящего за гражданской структурой",
    "Следящий",
    "Помощник следящего",
    "Лидер",
    "Заместитель",
    "Пользователь"
];


function v41RoleLevel(role) {

    const levels = {

        "Пользователь": 0,

        "Помощник следящего": 5,

        "Следящий": 10,

        "Лидер": 12,

        "Заместитель": 13,

        "Помощник следящего за гражданской структурой": 15,

        "ЗГС гражданских": 20,

        "ГС гражданских": 30,

        "ЗГС ГОС": 40,

        "ГС ГОС": 50,

        "Разработчик": 100

    };

    return levels[role] ?? 0;
}


function v41CanManageRole(
    actorRole,
    targetRole
) {

    if (
        !V41_MANAGER_ROLES.includes(
            actorRole
        )
    ) {
        return false;
    }

    return V41_LEADER_ROLES.includes(
        targetRole
    );
}


function v41CanManageUser(
    actor,
    target
) {

    if (!actor || !target) {
        return false;
    }

    if (
        actor.id === target.id
    ) {
        return false;
    }

    return (
        v41RoleLevel(actor.role) >
        v41RoleLevel(target.role)
    );
}


async function v41Activity(
    req,
    eventType,
    title,
    details = "",
    targetUserId = null,
    organization = ""
) {

    try {

        const actor =
            req.session &&
            req.session.user
                ? req.session.user.username
                : "system";


        await query(`
            INSERT INTO activity_events
                (
                    actor,
                    event_type,
                    title,
                    details,
                    target_user_id,
                    organization
                )
            VALUES
                ($1, $2, $3, $4, $5, $6)
        `, [

            actor,

            eventType,

            title,

            details,

            targetUserId,

            organization

        ]);

    } catch (error) {

        console.error(
            "V4.1 activity:",
            error.message
        );

    }
}


/*
=========================================================
 HEALTH
=========================================================
*/

app.get(
    "/api/v4/health",
    async (req, res) => {

        const started =
            Date.now();

        try {

            await query(
                "SELECT 1"
            );

            res.json({

                ok: true,

                version:
                    "4.1.0",

                database:
                    "connected",

                response_ms:
                    Date.now() - started,

                timestamp:
                    new Date().toISOString()

            });

        } catch (error) {

            console.error(
                "V4.1 health:",
                error
            );

            res.status(503)
                .json({

                    ok: false,

                    version:
                        "4.1.0",

                    database:
                        "error",

                    response_ms:
                        Date.now() - started,

                    error:
                        "Database unavailable"

                });

        }

    }
);


/*
=========================================================
 VERSION
=========================================================
*/

app.get(
    "/api/v4/version",
    (req, res) => {

        res.json({

            name:
                "Arizona Civil",

            version:
                "4.1.0",

            codename:
                "Command Center",

            status:
                "production-ready",

            api:
                "v4.1"

        });

    }
);


/*
=========================================================
 DASHBOARD
=========================================================
*/

app.get(
    "/api/v4/dashboard",
    requireAuth,
    async (req, res) => {

        try {

            const [
                users,
                roles,
                orgs,
                appointments,
                events,
                notifications
            ] = await Promise.all([

                query(`
                    SELECT
                        COUNT(*)::int AS total,

                        COUNT(*)
                            FILTER (
                                WHERE active
                            )::int AS active,

                        COUNT(*)
                            FILTER (
                                WHERE NOT active
                            )::int AS inactive

                    FROM users
                `),

                query(`
                    SELECT
                        role,
                        COUNT(*)::int AS count

                    FROM users

                    GROUP BY role

                    ORDER BY
                        count DESC,
                        role
                `),

                query(`
                    SELECT
                        organization,
                        COUNT(*)::int AS count

                    FROM users

                    WHERE
                        organization IS NOT NULL

                        AND organization <> ''

                    GROUP BY organization

                    ORDER BY
                        count DESC,
                        organization
                `),

                query(`
                    SELECT
                        COUNT(*)::int AS count

                    FROM appointments

                    WHERE active = TRUE
                `),

                query(`
                    SELECT
                        id,
                        actor,
                        event_type,
                        title,
                        details,
                        target_user_id,
                        organization,
                        created_at

                    FROM activity_events

                    ORDER BY
                        created_at DESC

                    LIMIT 12
                `),

                query(`
                    SELECT
                        COUNT(*)::int AS count

                    FROM notifications

                    WHERE
                        user_id = $1

                        AND read = FALSE
                `,
                [
                    req.session.user.id
                ])

            ]);


            res.json({

                version:
                    "4.1",

                user:
                    req.session.user,

                users:
                    users.rows[0],

                roles:
                    roles.rows,

                organizations:
                    orgs.rows,

                appointments:
                    appointments.rows[0],

                notifications:
                    notifications.rows[0],

                events:
                    events.rows

            });

        } catch (error) {

            console.error(
                "Dashboard V4.1:",
                error
            );

            res.status(500).json({

                error:
                    "Ошибка dashboard V4.1"

            });

        }

    }
);


/*
=========================================================
 PERSONNEL
=========================================================
*/

app.get(
    "/api/v4/personnel",
    requireAuth,
    async (req, res) => {

        try {

            const search =
                String(
                    req.query.search || ""
                ).trim();


            const role =
                String(
                    req.query.role || ""
                ).trim();


            const organization =
                String(
                    req.query.organization || ""
                ).trim();


            const active =
                req.query.active === undefined
                    ? ""
                    : String(
                        req.query.active
                    );


            const result =
                await query(`

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

                            OR username ILIKE
                                '%' || $1 || '%'

                            OR name ILIKE
                                '%' || $1 || '%'
                        )

                        AND
                        (
                            $2 = ''
                            OR role = $2
                        )

                        AND
                        (
                            $3 = ''
                            OR COALESCE(
                                organization,
                                ''
                            ) = $3
                        )

                        AND
                        (
                            $4 = ''
                            OR active =
                                ($4 = 'true')
                        )

                    ORDER BY

                        CASE role

                            WHEN 'Разработчик'
                                THEN 1

                            WHEN 'ГС ГОС'
                                THEN 2

                            WHEN 'ЗГС ГОС'
                                THEN 3

                            WHEN 'ГС гражданских'
                                THEN 4

                            WHEN 'ЗГС гражданских'
                                THEN 5

                            WHEN 'Помощник следящего за гражданской структурой'
                                THEN 6

                            WHEN 'Следящий'
                                THEN 7

                            WHEN 'Помощник следящего'
                                THEN 8

                            WHEN 'Заместитель'
                                THEN 9

                            WHEN 'Лидер'
                                THEN 10

                            ELSE 11

                        END,

                        LOWER(username)

                `,
                [
                    search,
                    role,
                    organization,
                    active
                ]);


            res.json(
                result.rows
            );

        } catch (error) {

            console.error(
                "Personnel V4.1:",
                error
            );

            res.status(500).json({

                error:
                    "Ошибка получения персонала"

            });

        }

    }
);


/*
=========================================================
 PERSONNEL PROFILE
=========================================================
*/

app.get(
    "/api/v4/personnel/:id",
    requireAuth,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                !Number.isSafeInteger(id)
            ) {

                return res.status(400)
                    .json({

                        error:
                            "Некорректный ID"

                    });

            }


            const user =
                await query(`

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

                `,
                [id]);


            if (
                !user.rows.length
            ) {

                return res.status(404)
                    .json({

                        error:
                            "Сотрудник не найден"

                    });

            }


            const [
                history,
                appointments,
                notes
            ] = await Promise.all([

                query(`

                    SELECT

                        action,
                        details,
                        actor,
                        created_at

                    FROM personnel_history

                    WHERE user_id = $1

                    ORDER BY
                        created_at DESC

                    LIMIT 100

                `,
                [id]),

                query(`

                    SELECT

                        role,
                        organization,
                        appointed_by,
                        start_date,
                        end_date,
                        active

                    FROM appointments

                    WHERE user_id = $1

                    ORDER BY
                        start_date DESC

                `,
                [id]),

                query(`

                    SELECT

                        id,
                        author,
                        note,
                        created_at

                    FROM personnel_notes_v4

                    WHERE user_id = $1

                    ORDER BY
                        created_at DESC

                    LIMIT 50

                `,
                [id])

            ]);


            res.json({

                user:
                    user.rows[0],

                history:
                    history.rows,

                appointments:
                    appointments.rows,

                notes:
                    notes.rows

            });

        } catch (error) {

            console.error(
                "Profile V4.1:",
                error
            );

            res.status(500).json({

                error:
                    "Ошибка профиля"

            });

        }

    }
);


/*
=========================================================
 ROLE MANAGEMENT
=========================================================
*/

app.patch(
    "/api/v4/personnel/:id/role",
    requireAuth,
    async (req, res) => {

        try {

            const actor =
                req.session.user;


            const id =
                Number(
                    req.params.id
                );


            const newRole =
                String(
                    req.body.role || ""
                ).trim();


            if (
                !Number.isSafeInteger(id)
            ) {

                return res.status(400)
                    .json({

                        error:
                            "Некорректный ID"

                    });

            }


            if (
                !V41_ALLOWED_ROLES.includes(
                    newRole
                )
            ) {

                return res.status(400)
                    .json({

                        error:
                            "Неизвестная роль"

                    });

            }


            if (
                !v41CanManageRole(
                    actor.role,
                    newRole
                )
            ) {

                return res.status(403)
                    .json({

                        error:
                            "Недостаточно прав для назначения этой роли"

                    });

            }


            const current =
                await query(`

                    SELECT

                        id,
                        username,
                        name,
                        role,
                        organization

                    FROM users

                    WHERE id = $1

                `,
                [id]);


            if (
                !current.rows.length
            ) {

                return res.status(404)
                    .json({

                        error:
                            "Пользователь не найден"

                    });

            }


            const target =
                current.rows[0];


            if (
                actor.id === target.id
            ) {

                return res.status(403)
                    .json({

                        error:
                            "Нельзя изменять собственную роль"

                    });

            }


            if (
                !v41CanManageUser(
                    actor,
                    target
                )
            ) {

                return res.status(403)
                    .json({

                        error:
                            "Нельзя управлять пользователем равного или более высокого уровня"

                    });

            }


            const oldRole =
                target.role;


            if (
                oldRole === newRole
            ) {

                return res.json(
                    target
                );

            }


            const updated =
                await query(`

                    UPDATE users

                    SET role = $1

                    WHERE id = $2

                    RETURNING

                        id,
                        username,
                        name,
                        role,
                        position,
                        organization,
                        vk,
                        avatar_url,
                        active

                `,
                [
                    newRole,
                    id
                ]);


            await query(`

                INSERT INTO role_history
                    (
                        user_id,
                        old_role,
                        new_role,
                        changed_by
                    )

                VALUES
                    ($1, $2, $3, $4)

            `,
            [
                id,
                oldRole,
                newRole,
                actor.username
            ]);


            await query(`

                INSERT INTO personnel_history
                    (
                        user_id,
                        action,
                        details,
                        actor
                    )

                VALUES
                    ($1, $2, $3, $4)

            `,
            [
                id,
                "Изменение роли",
                oldRole +
                    " → " +
                    newRole,
                actor.username
            ]);


            await v41Activity(
                req,
                "role",
                "Изменена роль сотрудника",
                oldRole +
                    " → " +
                    newRole,
                id,
                target.organization || ""
            );


            await query(`

                INSERT INTO notifications
                    (
                        user_id,
                        title,
                        message,
                        type
                    )

                VALUES
                    ($1, $2, $3, $4)

            `,
            [
                id,
                "Изменение роли",
                "Вам назначена роль: " +
                    newRole,
                "role"
            ]);


            res.json(
                updated.rows[0]
            );

        } catch (error) {

            console.error(
                "V4.1 role:",
                error
            );

            res.status(500).json({

                error:
                    "Ошибка изменения роли"

            });

        }

    }
);


/*
=========================================================
 ORGANIZATION ASSIGNMENT
=========================================================
*/

app.patch(
    "/api/v4/personnel/:id/organization",
    requireAuth,
    async (req, res) => {

        try {

            const actor =
                req.session.user;


            if (
                !V41_MANAGER_ROLES.includes(
                    actor.role
                )
            ) {

                return res.status(403)
                    .json({

                        error:
                            "Недостаточно прав"

                    });

            }


            const id =
                Number(
                    req.params.id
                );


            const organization =
                String(
                    req.body.organization || ""
                ).trim();


            const position =
                String(
                    req.body.position || ""
                ).trim();


            if (
                !Number.isSafeInteger(id)
                ||
                !organization
            ) {

                return res.status(400)
                    .json({

                        error:
                            "Укажите сотрудника и структуру"

                    });

            }


            const current =
                await query(`

                    SELECT

                        id,
                        organization,
                        position,
                        username,
                        role

                    FROM users

                    WHERE id = $1

                `,
                [id]);


            if (
                !current.rows.length
            ) {

                return res.status(404)
                    .json({

                        error:
                            "Пользователь не найден"

                    });

            }


            const target =
                current.rows[0];


            if (
                actor.id === target.id
            ) {

                return res.status(403)
                    .json({

                        error:
                            "Нельзя изменять собственное назначение"

                    });

            }


            if (
                !v41CanManageUser(
                    actor,
                    target
                )
            ) {

                return res.status(403)
                    .json({

                        error:
                            "Нельзя управлять пользователем равного или более высокого уровня"

                    });

            }


            const updated =
                await query(`

                    UPDATE users

                    SET

                        organization = $1,

                        position =
                            CASE
                                WHEN $2 <> ''
                                THEN $2
                                ELSE position
                            END,

                        appointed_at =
                            NOW(),

                        appointed_by =
                            $3

                    WHERE id = $4

                    RETURNING

                        id,
                        username,
                        name,
                        role,
                        position,
                        organization,
                        vk,
                        avatar_url,
                        active

                `,
                [
                    organization,
                    position,
                    actor.username,
                    id
                ]);


            await query(`

                INSERT INTO organization_members
                    (
                        user_id,
                        organization,
                        role,
                        position,
                        appointed_by
                    )

                VALUES
                    (
                        $1,
                        $2,
                        (
                            SELECT role
                            FROM users
                            WHERE id = $1
                        ),
                        $3,
                        $4
                    )

            `,
            [
                id,
                organization,
                position,
                actor.username
            ]);


            await query(`

                INSERT INTO personnel_history
                    (
                        user_id,
                        action,
                        details,
                        actor
                    )

                VALUES
                    ($1, $2, $3, $4)

            `,
            [
                id,

                "Назначение в структуру",

                (
                    target.organization ||
                    "Без структуры"
                ) +
                    " → " +
                    organization,

                actor.username
            ]);


            await v41Activity(
                req,
                "organization",
                "Изменено назначение",
                organization,
                id,
                organization
            );


            await query(`

                INSERT INTO notifications
                    (
                        user_id,
                        title,
                        message,
                        type
                    )

                VALUES
                    ($1, $2, $3, $4)

            `,
            [
                id,
                "Новое назначение",
                "Вы назначены в структуру: " +
                    organization,
                "organization"
            ]);


            res.json(
                updated.rows[0]
            );

        } catch (error) {

            console.error(
                "V4.1 organization:",
                error
            );

            res.status(500).json({

                error:
                    "Ошибка назначения"

            });

        }

    }
);


/*
=========================================================
 NOTES
=========================================================
*/

app.post(
    "/api/v4/personnel/:id/notes",
    requireAuth,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const note =
                String(
                    req.body.note || ""
                ).trim();


            if (
                !Number.isSafeInteger(id)
                ||
                !note
            ) {

                return res.status(400)
                    .json({

                        error:
                            "Введите заметку"

                    });

            }


            if (
                note.length > 2000
            ) {

                return res.status(400)
                    .json({

                        error:
                            "Заметка слишком длинная"

                    });

            }


            const actor =
                req.session.user;


            if (
                !V41_MANAGER_ROLES.includes(
                    actor.role
                )
                &&
                actor.role !==
                    "Следящий"
            ) {

                return res.status(403)
                    .json({

                        error:
                            "Недостаточно прав"

                    });

            }


            const target =
                await query(`

                    SELECT
                        id,
                        username

                    FROM users

                    WHERE id = $1

                `,
                [id]);


            if (
                !target.rows.length
            ) {

                return res.status(404)
                    .json({

                        error:
                            "Сотрудник не найден"

                    });

            }


            const result =
                await query(`

                    INSERT INTO personnel_notes_v4
                        (
                            user_id,
                            author,
                            note
                        )

                    VALUES
                        ($1, $2, $3)

                    RETURNING

                        id,
                        author,
                        note,
                        created_at

                `,
                [
                    id,
                    actor.username,
                    note
                ]);


            await v41Activity(
                req,
                "note",
                "Добавлена заметка",
                note.slice(0, 200),
                id
            );


            res.json(
                result.rows[0]
            );

        } catch (error) {

            console.error(
                "V4.1 note:",
                error
            );

            res.status(500).json({

                error:
                    "Ошибка сохранения заметки"

            });

        }

    }
);


/*
=========================================================
 NOTIFICATIONS
=========================================================
*/

app.get(
    "/api/v4/notifications",
    requireAuth,
    async (req, res) => {

        try {

            const result =
                await query(`

                    SELECT

                        id,
                        title,
                        message,
                        type,
                        read,
                        created_at

                    FROM notifications

                    WHERE user_id = $1

                    ORDER BY
                        created_at DESC

                    LIMIT 50

                `,
                [
                    req.session.user.id
                ]);


            res.json(
                result.rows
            );

        } catch (error) {

            console.error(
                "V4.1 notifications:",
                error
            );

            res.status(500).json({

                error:
                    "Ошибка уведомлений"

            });

        }

    }
);


app.patch(
    "/api/v4/notifications/:id/read",
    requireAuth,
    async (req, res) => {

        try {

            const notificationId =
                Number(
                    req.params.id
                );


            if (
                !Number.isSafeInteger(
                    notificationId
                )
            ) {

                return res.status(400)
                    .json({

                        error:
                            "Некорректный ID"

                    });

            }


            const result =
                await query(`

                    UPDATE notifications

                    SET read = TRUE

                    WHERE

                        id = $1

                        AND user_id = $2

                    RETURNING id

                `,
                [
                    notificationId,
                    req.session.user.id
                ]);


            if (
                !result.rows.length
            ) {

                return res.status(404)
                    .json({

                        error:
                            "Уведомление не найдено"

                    });

            }


            res.json({

                success:
                    true

            });

        } catch (error) {

            console.error(
                "V4.1 notification:",
                error
            );

            res.status(500).json({

                error:
                    "Ошибка уведомления"

            });

        }

    }
);


/*
=========================================================
 ACTIVITY
=========================================================
*/

app.get(
    "/api/v4/activity",
    requireAuth,
    async (req, res) => {

        try {

            const result =
                await query(`

                    SELECT

                        id,
                        actor,
                        event_type,
                        title,
                        details,
                        target_user_id,
                        organization,
                        created_at

                    FROM activity_events

                    ORDER BY
                        created_at DESC

                    LIMIT 100

                `);


            res.json(
                result.rows
            );

        } catch (error) {

            console.error(
                "V4.1 activity:",
                error
            );

            res.status(500).json({

                error:
                    "Ошибка активности"

            });

        }

    }
);


/*
=========================================================
 ROLES
=========================================================
*/

app.get(
    "/api/v4/roles",
    requireAuth,
    (req, res) => {

        res.json([

            {
                name:
                    "Разработчик",
                level:
                    100
            },

            {
                name:
                    "ГС ГОС",
                level:
                    50
            },

            {
                name:
                    "ЗГС ГОС",
                level:
                    40
            },

            {
                name:
                    "ГС гражданских",
                level:
                    30
            },

            {
                name:
                    "ЗГС гражданских",
                level:
                    20
            },

            {
                name:
                    "Помощник следящего за гражданской структурой",
                level:
                    15
            },

            {
                name:
                    "Заместитель",
                level:
                    13
            },

            {
                name:
                    "Лидер",
                level:
                    12
            },

            {
                name:
                    "Следящий",
                level:
                    10
            },

            {
                name:
                    "Помощник следящего",
                level:
                    5
            },

            {
                name:
                    "Пользователь",
                level:
                    0
            }

        ]);

    }
);


/*
=========================================================
 ORGANIZATIONS
=========================================================
*/

app.get(
    "/api/v4/organizations",
    requireAuth,
    async (req, res) => {

        try {

            const result =
                await query(`

                    SELECT

                        organization,

                        COUNT(*)::int
                            AS total,

                        COUNT(*)
                            FILTER (
                                WHERE active
                            )::int
                            AS active

                    FROM users

                    WHERE

                        organization IS NOT NULL

                        AND organization <> ''

                    GROUP BY
                        organization

                    ORDER BY
                        organization

                `);


            res.json(
                result.rows
            );

        } catch (error) {

            console.error(
                "V4.1 organizations:",
                error
            );

            res.status(500).json({

                error:
                    "Ошибка организаций"

            });

        }

    }
);


/*
=========================================================
 SYSTEM SETTINGS
=========================================================
*/

app.get(
    "/api/v4/settings",
    requireAuth,
    async (req, res) => {

        try {

            const result =
                await query(`

                    SELECT

                        key,
                        value,
                        updated_by,
                        updated_at

                    FROM system_settings

                    ORDER BY key

                `);


            res.json(
                result.rows
            );

        } catch (error) {

            console.error(
                "V4.1 settings:",
                error
            );

            res.status(500).json({

                error:
                    "Ошибка настроек"

            });

        }

    }
);


