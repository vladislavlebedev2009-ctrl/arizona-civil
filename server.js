const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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
    DEVELOPER: "Разработчик",
    GS_GOS: "ГС ГОС",
    ZGS_GOS: "ЗГС ГОС",
    GS_CIVIL: "ГС гражданских",
    ZGS_CIVIL: "ЗГС гражданских",
    FOLLOWER: "Следящий"
};

const ROLE_LEVEL = {
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

app.post("/api/auth/login", (req, res) => {

    const {
        username,
        password
    } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: "Введите логин и пароль"
        });
    }

    const data = loadData();

    const user = data.users.find(
        x => x.username.toLowerCase() ===
             username.toLowerCase()
    );

    if (!user) {
        return res.status(401).json({
            error: "Неверный логин или пароль"
        });
    }

    if (
        user.password !==
        hashPassword(password)
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

    journal(
        data,
        user.username,
        "Авторизация",
        `Вход в систему как ${user.role}`
    );

    saveData(data);

    res.json({
        success: true,
        user: req.session.user
    });
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
    (req, res) => {

        const data = loadData();

        res.json(
            data.users.map(u => ({
                id: u.id,
                username: u.username,
                role: u.role
            }))
        );
    }
);

app.post(
    "/api/users",
    requireRole(ROLES.DEVELOPER),
    (req, res) => {

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

        const data = loadData();

        if (
            data.users.some(
                x =>
                    x.username.toLowerCase() ===
                    username.toLowerCase()
            )
        ) {
            return res.status(409).json({
                error: "Такой пользователь уже существует"
            });
        }

        const user = {
            id: Date.now(),
            username,
            password: hashPassword(password),
            role
        };

        data.users.push(user);

        journal(
            data,
            req.session.user.username,
            "Создание пользователя",
            `${username} — ${role}`
        );

        saveData(data);

        res.json({
            id: user.id,
            username: user.username,
            role: user.role
        });
    }
);

app.patch(
    "/api/users/:id/role",
    requireRole(ROLES.DEVELOPER),
    (req, res) => {

        const data = loadData();

        const user = data.users.find(
            x => x.id === Number(req.params.id)
        );

        if (!user) {
            return res.status(404).json({
                error: "Пользователь не найден"
            });
        }

        const { role } = req.body;

        if (!Object.values(ROLES).includes(role)) {
            return res.status(400).json({
                error: "Неизвестная роль"
            });
        }

        user.role = role;

        journal(
            data,
            req.session.user.username,
            "Изменение роли",
            `${user.username} → ${role}`
        );

        saveData(data);

        res.json({
            success: true
        });
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
    (req, res) => {

        const data = loadData();

        res.json(
            data.leaders.sort(
                (a, b) =>
                    new Date(a.end_date) -
                    new Date(b.end_date)
            )
        );
    }
);

app.post(
    "/api/leaders",
    requireRole(ROLES.ZGS_CIVIL),
    (req, res) => {

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

        const data = loadData();

        const item = {
            id: Date.now(),
            structure,
            leader,
            vk: vk || "",
            start_date,
            end_date,
            status: "Активен"
        };

        data.leaders.push(item);

        journal(
            data,
            req.session.user.username,
            "Добавление лидера",
            `${structure}: ${leader}`
        );

        saveData(data);

        res.json(item);
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
    (req, res) => {

        const amount = Number(req.body.days);

        if (!Number.isInteger(amount)) {
            return res.status(400).json({
                error: "Введите целое количество дней"
            });
        }

        const data = loadData();

        const leader =
            findLeader(data, req.params.id);

        if (!leader) {
            return res.status(404).json({
                error: "Лидер не найден"
            });
        }

        const oldDate = leader.end_date;

        const date = new Date(
            leader.end_date + "T00:00:00"
        );

        date.setDate(
            date.getDate() + amount
        );

        leader.end_date =
            date.toISOString().slice(0, 10);

        journal(
            data,
            req.session.user.username,
            amount >= 0
                ? "Добавление дней"
                : "Снятие дней",
            `${leader.structure}: ${leader.leader}; ${amount} дней`
        );

        saveData(data);

        res.json({
            success: true,
            old_date: oldDate,
            new_date: leader.end_date
        });
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
    (req, res) => {

        const data = loadData();

        const index =
            data.leaders.findIndex(
                x => x.id === Number(req.params.id)
            );

        if (index === -1) {
            return res.status(404).json({
                error: "Лидер не найден"
            });
        }

        const leader =
            data.leaders[index];

        data.leaders.splice(index, 1);

        journal(
            data,
            req.session.user.username,
            "Снятие лидера",
            `${leader.structure}: ${leader.leader}`
        );

        saveData(data);

        res.json({
            success: true
        });
    }
);

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
 SUPERVISORS
=========================================
*/

app.get(
    "/api/supervisors",
    requireAuth,
    (req, res) => {

        const data = loadData();

        res.json(data.supervisors);
    }
);

app.post(
    "/api/supervisors",
    requireRole(ROLES.ZGS_CIVIL),
    (req, res) => {

        const {
            name,
            role = ROLES.FOLLOWER,
            position = "Следящий"
        } = req.body;

        if (!name) {
            return res.status(400).json({
                error: "Введите имя"
            });
        }

        const data = loadData();

        const supervisor = {
            id: Date.now(),
            name,
            role,
            position,
            created_at:
                new Date().toISOString()
        };

        data.supervisors.push(supervisor);

        journal(
            data,
            req.session.user.username,
            "Добавлен следящий",
            `${name}: ${position}`
        );

        saveData(data);

        res.json(supervisor);
    }
);

app.patch(
    "/api/supervisors/:id",
    requireRole(ROLES.ZGS_CIVIL),
    (req, res) => {

        const data = loadData();

        const supervisor =
            data.supervisors.find(
                x =>
                    x.id ===
                    Number(req.params.id)
            );

        if (!supervisor) {
            return res.status(404).json({
                error: "Следящий не найден"
            });
        }

        if (req.body.position) {
            supervisor.position =
                req.body.position;
        }

        if (req.body.role) {

            if (
                req.session.user.role !==
                ROLES.DEVELOPER
            ) {
                return res.status(403).json({
                    error:
                        "Только разработчик может менять роль"
                });
            }

            supervisor.role =
                req.body.role;
        }

        journal(
            data,
            req.session.user.username,
            "Изменение следящего",
            `${supervisor.name}: ${supervisor.position}`
        );

        saveData(data);

        res.json(supervisor);
    }
);

app.delete(
    "/api/supervisors/:id",
    requireRole(ROLES.ZGS_CIVIL),
    (req, res) => {

        const data = loadData();

        const index =
            data.supervisors.findIndex(
                x =>
                    x.id ===
                    Number(req.params.id)
            );

        if (index === -1) {
            return res.status(404).json({
                error: "Следящий не найден"
            });
        }

        const supervisor =
            data.supervisors[index];

        data.supervisors.splice(index, 1);

        journal(
            data,
            req.session.user.username,
            "Удаление следящего",
            supervisor.name
        );

        saveData(data);

        res.json({
            success: true
        });
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
 STATIC
=========================================
*/

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

app.listen(PORT, () => {

    console.log("");
    console.log("================================");
    console.log("       ARIZONA CIVIL");
    console.log("================================");
    console.log(`Сайт: http://localhost:${PORT}`);
    console.log("Авторизация: ВКЛ");
    console.log("Роль разработчика: ВЫСШАЯ");
    console.log("================================");
    console.log("");
});
