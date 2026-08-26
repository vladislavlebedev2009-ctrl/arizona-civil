require('dotenv').config();
const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { initDatabase, query } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

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
    FOLLOWER: "Следящий"
};

const ROLE_LEVEL = {
    [ROLES.USER]: 0,
    [ROLES.FOLLOWER]: 10,
    [ROLES.ZGS_CIVIL]: 20,
    [ROLES.GS_CIVIL]: 30,
    [ROLES.ZGS_GOS]: 40,
    [ROLES.GS_GOS]: 50,
    [ROLES.DEVELOPER]: 100
};

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

// Статические файлы сайта: CSS, JS, изображения и т.д.
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
    secret: process.env.SESSION_SECRET ||
        "CHANGE_THIS_SECRET_ARIZONA_CIVIL",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

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
                active
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
            role: user.role
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

            const result = await query(
                `
                INSERT INTO leaders
                    (
                        id,
                        organization,
                        name,
                        nickname,
                        start_date,
                        end_date,
                        status
                    )
                VALUES
                    ($1, $2, $3, $4, $5, $6, 'Активен')
                RETURNING
                    id,
                    organization AS structure,
                    name AS leader,
                    nickname AS vk,
                    start_date,
                    end_date,
                    status
                `,
                [
                    id,
                    structure,
                    leader,
                    vk || "",
                    start_date,
                    end_date
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

async function startServer() {

    try {
        await initDatabase();

        app.listen(PORT, () => {

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