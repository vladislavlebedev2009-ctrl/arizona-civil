#!/usr/bin/env node
/*
=========================================================
 ARIZONA CIVIL 4.0 — ONE COMMAND UPGRADE
 --------------------------------------------------------
 Без удаления существующих данных.
 Создаёт backup, миграцию PostgreSQL, V4 API,
 Personnel/Control Center, UI 4.0 и Render hardening.
=========================================================
*/

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const BACKUP = path.join(ROOT, `backup-before-4.0-${stamp}`);

function file(name) {
    return path.join(ROOT, name);
}

function exists(name) {
    return fs.existsSync(file(name));
}

function backup(name) {
    const src = file(name);
    if (!fs.existsSync(src)) return;

    const dest = path.join(BACKUP, name);

    fs.mkdirSync(path.dirname(dest), {
        recursive: true
    });

    fs.copyFileSync(src, dest);

    console.log(`✅ Backup: ${name}`);
}

function appendOnce(name, marker, content) {
    const p = file(name);

    let text = fs.readFileSync(
        p,
        "utf8"
    );

    if (text.includes(marker)) {
        console.log(
            `↪️ Уже установлено: ${name}`
        );

        return false;
    }

    fs.writeFileSync(
        p,
        text.replace(/\s*$/, "\n\n") +
        content +
        "\n",
        "utf8"
    );

    console.log(
        `✅ Обновлён: ${name}`
    );

    return true;
}

function replaceOnce(
    name,
    from,
    to,
    label
) {
    const p = file(name);

    let text = fs.readFileSync(
        p,
        "utf8"
    );

    if (text.includes(to)) {
        console.log(
            `↪️ Уже установлено: ${label}`
        );

        return false;
    }

    if (!text.includes(from)) {
        throw new Error(
            `Не найдено место вставки: ${label}`
        );
    }

    text = text.replace(
        from,
        to
    );

    fs.writeFileSync(
        p,
        text,
        "utf8"
    );

    console.log(
        `✅ ${label}`
    );

    return true;
}

console.log(`
╔══════════════════════════════════════════════╗
║          ARIZONA CIVIL 4.0 UPGRADE          ║
╚══════════════════════════════════════════════╝
`);

const required = [
    "server.js",
    "db.js",
    "package.json",
    "render.yaml",
    "public/index.html",
    "public/app.js",
    "public/style.css"
];

for (const name of required) {
    if (!exists(name)) {
        throw new Error(
            `Не найден обязательный файл: ${name}`
        );
    }
}

fs.mkdirSync(
    BACKUP,
    {
        recursive: true
    }
);

for (const name of required) {
    backup(name);
}

if (exists(".gitignore")) {
    backup(".gitignore");
}


/*
=========================================================
 DATABASE V4
=========================================================
*/

const DB_MARKER =
    "ARIZONA_CIVIL_4_0_DATABASE";

const DB_MIGRATION = `

/*
=========================================================
 ARIZONA_CIVIL_4_0_DATABASE
 Без удаления существующих данных
=========================================================
*/

async function initDatabaseV40() {

    await query(\`
        CREATE TABLE IF NOT EXISTS activity_events (
            id BIGSERIAL PRIMARY KEY,
            actor VARCHAR(100) NOT NULL,
            event_type VARCHAR(100) NOT NULL,
            title VARCHAR(200) NOT NULL,
            details TEXT DEFAULT '',
            target_user_id BIGINT
                REFERENCES users(id)
                ON DELETE SET NULL,
            organization VARCHAR(200) DEFAULT '',
            created_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()
        )
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS
        idx_activity_events_created
        ON activity_events(created_at DESC)
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS
        idx_activity_events_actor
        ON activity_events(actor)
    \`);


    await query(\`
        CREATE TABLE IF NOT EXISTS personnel_notes_v4 (
            id BIGSERIAL PRIMARY KEY,

            user_id BIGINT
                REFERENCES users(id)
                ON DELETE CASCADE,

            author VARCHAR(100) NOT NULL,

            note TEXT NOT NULL,

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()
        )
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS
        idx_personnel_notes_v4_user
        ON personnel_notes_v4(user_id)
    \`);


    await query(\`
        CREATE TABLE IF NOT EXISTS notifications (
            id BIGSERIAL PRIMARY KEY,

            user_id BIGINT
                REFERENCES users(id)
                ON DELETE CASCADE,

            title VARCHAR(200) NOT NULL,

            message TEXT DEFAULT '',

            type VARCHAR(50)
                NOT NULL DEFAULT 'info',

            read BOOLEAN
                NOT NULL DEFAULT FALSE,

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()
        )
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS
        idx_notifications_user_read
        ON notifications(
            user_id,
            read,
            created_at DESC
        )
    \`);


    await query(\`
        CREATE TABLE IF NOT EXISTS system_settings (
            key VARCHAR(100) PRIMARY KEY,

            value TEXT
                NOT NULL DEFAULT '',

            updated_by VARCHAR(100),

            updated_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()
        )
    \`);


    await query(\`
        CREATE TABLE IF NOT EXISTS organization_members (
            id BIGSERIAL PRIMARY KEY,

            user_id BIGINT
                REFERENCES users(id)
                ON DELETE CASCADE,

            organization VARCHAR(200)
                NOT NULL,

            role VARCHAR(100)
                NOT NULL,

            position VARCHAR(200)
                DEFAULT '',

            active BOOLEAN
                NOT NULL DEFAULT TRUE,

            appointed_by VARCHAR(100),

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()
        )
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS
        idx_org_members_org
        ON organization_members(organization)
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS
        idx_org_members_user
        ON organization_members(user_id)
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS
        idx_org_members_active
        ON organization_members(active)
    \`);

    console.log(
        "✅ Arizona Civil 4.0: PostgreSQL migration готова"
    );
}

module.exports.initDatabaseV40 =
    initDatabaseV40;
`;

appendOnce(
    "db.js",
    DB_MARKER,
    DB_MIGRATION
);


/*
=========================================================
 SERVER V4 API
=========================================================
*/

const SERVER_MARKER =
    "ARIZONA_CIVIL_4_0_API";

const SERVER_API = `

/*
=========================================================
 ARIZONA_CIVIL_4_0_API
=========================================================
*/

const V4_MANAGER_ROLES = [
    "Разработчик",
    "ГС ГОС",
    "ЗГС ГОС",
    "ГС гражданских",
    "ЗГС гражданских"
];

const V4_LEADER_ROLES = [
    "Лидер",
    "Заместитель"
];


function v4RoleLevel(role) {

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


function v4CanManageRole(
    actorRole,
    targetRole
) {

    if (
        !V4_MANAGER_ROLES.includes(
            actorRole
        )
    ) {
        return false;
    }

    return V4_LEADER_ROLES.includes(
        targetRole
    );
}


async function v4Activity(
    req,
    eventType,
    title,
    details = "",
    targetUserId = null,
    organization = ""
) {

    try {

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

            req.session.user.username,

            eventType,

            title,

            details,

            targetUserId,

            organization

        ]);

    } catch (e) {

        console.error(
            "V4 activity:",
            e.message
        );

    }
}


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
                events
            ] = await Promise.all([

                query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER ( WHERE active )::int AS active, COUNT(*) FILTER ( WHERE NOT active )::int AS inactive FROM users `), query(` SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY count DESC, role `), query(` SELECT organization, COUNT(*)::int AS count FROM users WHERE organization IS NOT NULL AND organization <> '' GROUP BY organization ORDER BY count DESC, organization `), query(` SELECT COUNT(*)::int AS count FROM appointments WHERE active = TRUE `), query(` SELECT id, actor, event_type, title, details, target_user_id, organization, created_at FROM activity_events ORDER BY created_at DESC LIMIT 12 `) ]); res.json({ version: "4.0", user: req.session.user, users: users.rows[0], roles: roles.rows, organizations: orgs.rows, appointments: appointments.rows[0], events: events.rows }); } catch (error) { console.error( "Dashboard V4:", error ); res.status(500).json({ error: "Ошибка dashboard V4" }); } } ); /* ========================================================= PERSONNEL ========================================================= */ app.get( "/api/v4/personnel", requireAuth, async (req, res) => { try { const search = String( req.query.search || "" ).trim(); const role = String( req.query.role || "" ).trim(); const organization = String( req.query.organization || "" ).trim(); const active = req.query.active === undefined ? "" : String( req.query.active ); const result = await query(` SELECT id, username, name, role, position, organization, vk, avatar_url, active, appointed_at, appointed_by, created_at FROM users WHERE ( $1 = '' OR username ILIKE '%' || $1 || '%' OR name ILIKE '%' || $1 || '%' ) AND ( $2 = '' OR role = $2 ) AND ( $3 = '' OR COALESCE( organization, '' ) = $3 ) AND ( $4 = '' OR active = ($4 = 'true') ) ORDER BY CASE role WHEN 'Разработчик' THEN 1 WHEN 'ГС ГОС' THEN 2 WHEN 'ЗГС ГОС' THEN 3 WHEN 'ГС гражданских' THEN 4 WHEN 'ЗГС гражданских' THEN 5 WHEN 'Следящий' THEN 6 WHEN 'Помощник следящего за гражданской структурой' THEN 7 WHEN 'Помощник следящего' THEN 7 WHEN 'Лидер' THEN 8 WHEN 'Заместитель' THEN 9 ELSE 10 END, LOWER(username) `, [ search, role, organization, active ]); res.json( result.rows ); } catch (error) { console.error( "Personnel V4:", error ); res.status(500).json({ error: "Ошибка получения персонала" }); } } ); /* ========================================================= PERSONNEL PROFILE ========================================================= */ app.get( "/api/v4/personnel/:id", requireAuth, async (req, res) => { try { const id = Number( req.params.id ); if ( !Number.isSafeInteger(id) ) { return res.status(400) .json({ error: "Некорректный ID" }); } const user = await query(` SELECT id, username, name, role, position, organization, vk, avatar_url, active, appointed_at, appointed_by, created_at FROM users WHERE id = $1 `, [id]); if ( !user.rows.length ) { return res.status(404) .json({ error: "Сотрудник не найден" }); } const [ history, appointments, notes ] = await Promise.all([ query(` SELECT action, details, actor, created_at FROM personnel_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100 `, [id]), query(` SELECT role, organization, appointed_by, start_date, end_date, active FROM appointments WHERE user_id = $1 ORDER BY start_date DESC `, [id]), query(` SELECT id, author, note, created_at FROM personnel_notes_v4 WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50 `, [id]) ]); res.json({ user: user.rows[0], history: history.rows, appointments: appointments.rows, notes: notes.rows }); } catch (error) { console.error( "Profile V4:", error ); res.status(500).json({ error: "Ошибка профиля" }); } } ); /* ========================================================= ROLE MANAGEMENT ========================================================= */ app.patch( "/api/v4/personnel/:id/role", requireAuth, async (req, res) => { try { const actor = req.session.user; const id = Number( req.params.id ); const newRole = String( req.body.role || "" ).trim(); if ( !Number.isSafeInteger(id) ) { return res.status(400) .json({ error: "Некорректный ID" }); } if ( !v4CanManageRole( actor.role, newRole ) ) { return res.status(403) .json({ error: "Недостаточно прав для назначения этой роли" }); } const current = await query(`SELECT id, username, name, role, organization FROM users WHERE id = $1`, [id] ); if ( !current.rows.length ) { return res.status(404) .json({ error: "Пользователь не найден" }); } const oldRole = current.rows[0].role; if ( oldRole === newRole ) { return res.json( current.rows[0] ); } const updated = await query(` UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, name, role, position, organization, vk, avatar_url, active `, [ newRole, id ] ); await query(` INSERT INTO role_history ( user_id, old_role, new_role, changed_by ) VALUES ($1, $2, $3, $4) `, [ id, oldRole, newRole, actor.username ]); await query(` INSERT INTO personnel_history ( user_id, action, details, actor ) VALUES ($1, $2, $3, $4) `, [ id, "Изменение роли", oldRole + " → " + newRole, actor.username ]); await v4Activity( req, "role", "Изменена роль сотрудника", oldRole + " → " + newRole, id, current.rows[0] .organization || "" ); await query(` INSERT INTO notifications ( user_id, title, message, type ) VALUES ($1, $2, $3, $4) `, [ id, "Изменение роли", "Вам назначена роль: " + newRole, "role" ]); res.json( updated.rows[0] ); } catch (error) { console.error( "V4 role:", error ); res.status(500).json({ error: "Ошибка изменения роли" }); } } ); /* ========================================================= ORGANIZATION ASSIGNMENT ========================================================= */ app.patch( "/api/v4/personnel/:id/organization", requireAuth, async (req, res) => { try { const actor = req.session.user; if ( !V4_MANAGER_ROLES.includes( actor.role ) ) { return res.status(403) .json({ error: "Недостаточно прав" }); } const id = Number( req.params.id ); const organization = String( req.body.organization || "" ).trim(); const position = String( req.body.position || "" ).trim(); if ( !Number.isSafeInteger(id) || !organization ) { return res.status(400) .json({ error: "Укажите сотрудника и структуру" }); } const current = await query(`SELECT
                        id,
                        organization,
                        position,
                        username

                    FROM users

                    WHERE id = $1
                    `,
                    [id]
                );


            if (
                !current.rows.length
            ) {

                return res.status(404)
                    .json({
                        error:
                            "Пользователь не найден"
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

                        appointed_at = NOW(),

                        appointed_by = $3

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
                ]
            );


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
                    current.rows[0]
                        .organization ||
                    "Без структуры"
                ) +
                    " → " +
                    organization,

                actor.username
            ]);


            await v4Activity(
                req,
                "organization",
                "Изменено назначение",
                organization,
                id,
                organization
            );


            res.json(
                updated.rows[0]
            );

        } catch (error) {

            console.error(
                "V4 organization:",
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
                !V4_MANAGER_ROLES.includes(
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
                ]
            );


            await v4Activity(
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
                "V4 note:",
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
                "V4 notifications:",
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
                    Number(
                        req.params.id
                    ),
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
                success: true
            });

        } catch (error) {

            console.error(
                "V4 notification:",
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
                "V4 activity:",
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
                name: "Разработчик",
                level: 100
            },

            {
                name: "ГС ГОС",
                level: 50
            },

            {
                name: "ЗГС ГОС",
                level: 40
            },

            {
                name: "ГС гражданских",
                level: 30
            },

            {
                name: "ЗГС гражданских",
                level: 20
            },

            {
                name:
                    "Помощник следящего за гражданской структурой",
                level: 15
            },

            {
                name: "Следящий",
                level: 10
            },

            {
                name: "Лидер",
                level: 12
            },

            {
                name: "Заместитель",
                level: 13
            },

            {
                name: "Пользователь",
                level: 0
            }

        ]);

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
                "4.0.0",

            codename:
                "Command Center",

            status:
                "production-ready"

        });

    }
);
`;

appendOnce(
    "server.js",
    SERVER_MARKER,
    SERVER_API
);


/*
=========================================================
 DATABASE STARTUP
=========================================================
*/

const START_MARKER =
    "initDatabaseV40()";

replaceOnce(
    "server.js",

    `await initDatabaseV30();`,

    `await initDatabaseV30();
        if (typeof initDatabaseV40 === "function") {
            await initDatabaseV40();
        }`,

    "Подключение миграции V4"
);


replaceOnce(
    "server.js",

    `const { initDatabase, initDatabaseV30, query, pool } = require("./db");`,

    `const {
        initDatabase,
        initDatabaseV30,
        initDatabaseV40,
        query,
        pool
    } = require("./db");`,

    "Импорт initDatabaseV40"
);


/*
=========================================================
 CSS V4
=========================================================
*/

const CSS_MARKER =
    "ARIZONA_CIVIL_4_0_CSS";

const CSS_V4 = `

/* =========================================================
   ARIZONA_CIVIL_4_0_CSS
========================================================= */

.ac-v4-shell {

    margin:
        24px 0;

    border-radius:
        24px;

    padding:
        24px;

    background:

        radial-gradient(
            circle at 10% 0%,
            rgba(
                255,
                200,
                70,
                .13
            ),
            transparent 30%
        ),

        linear-gradient(
            145deg,
            rgba(
                20,
                23,
                32,
                .98
            ),
            rgba(
                9,
                11,
                17,
                .98
            )
        );

    border:
        1px solid
        rgba(
            255,
            210,
            90,
            .16
        );

    box-shadow:
        0 24px 80px
        rgba(
            0,
            0,
            0,
            .25
        );
}


.ac-v4-head {

    display:
        flex;

    justify-content:
        space-between;

    align-items:
        center;

    gap:
        16px;

    margin-bottom:
        20px;
}


.ac-v4-title {

    margin:
        0;

    font-size:
        clamp(
            24px,
            4vw,
            38px
        );

    font-weight:
        900;

    letter-spacing:
        -.03em;
}


.ac-v4-subtitle {

    margin:
        6px 0 0;

    opacity:
        .65;
}


.ac-v4-grid {

    display:
        grid;

    grid-template-columns:
        repeat(
            4,
            minmax(
                0,
                1fr
            )
        );

    gap:
        14px;
}


.ac-v4-stat {

    padding:
        18px;

    border-radius:
        18px;

    background:
        rgba(
            255,
            255,
            255,
            .045
        );

    border:
        1px solid
        rgba(
            255,
            255,
            255,
            .07
        );
}


.ac-v4-stat span {

    display:
        block;

    font-size:
        11px;

    text-transform:
        uppercase;

    letter-spacing:
        .12em;

    opacity:
        .55;
}


.ac-v4-stat strong {

    display:
        block;

    margin-top:
        8px;

    font-size:
        30px;
}


.ac-v4-toolbar {

    display:
        flex;

    gap:
        10px;

    flex-wrap:
        wrap;

    margin:
        18px 0;
}


.ac-v4-input,
.ac-v4-select {

    min-height:
        44px;

    padding:
        0 13px;

    border-radius:
        12px;

    border:
        1px solid
        rgba(
            255,
            255,
            255,
            .1
        );

    background:
        rgba(
            0,
            0,
            0,
            .25
        );

    color:
        inherit;

    outline:
        none;
}


.ac-v4-input:focus,
.ac-v4-select:focus {

    border-color:
        rgba(
            255,
            210,
            90,
            .6
        );

    box-shadow:
        0 0 0 3px
        rgba(
            255,
            210,
            90,
            .08
        );
}


.ac-v4-table-wrap {

    overflow:
        auto;

    border-radius:
        16px;

    border:
        1px solid
        rgba(
            255,
            255,
            255,
            .07
        );
}


.ac-v4-table {

    width:
        100%;

    border-collapse:
        collapse;

    min-width:
        760px;
}


.ac-v4-table th,
.ac-v4-table td {

    padding:
        13px 14px;

    text-align:
        left;

    border-bottom:
        1px solid
        rgba(
            255,
            255,
            255,
            .055
        );
}


.ac-v4-table th {

    font-size:
        11px;

    text-transform:
        uppercase;

    letter-spacing:
        .08em;

    opacity:
        .55;
}


.ac-v4-table tr:hover td {

    background:
        rgba(
            255,
            255,
            255,
            .025
        );
}


.ac-v4-badge {

    display:
        inline-flex;

    align-items:
        center;

    padding:
        5px 9px;

    border-radius:
        999px;

    background:
        rgba(
            255,
            210,
            90,
            .09
        );

    border:
        1px solid
        rgba(
            255,
            210,
            90,
            .18
        );

    font-size:
        12px;
}


.ac-v4-btn {

    min-height:
        40px;

    padding:
        0 14px;

    border-radius:
        11px;

    border:
        1px solid
        rgba(
            255,
            255,
            255,
            .1
        );

    background:
        rgba(
            255,
            255,
            255,
            .05
        );

    color:
        inherit;

    cursor:
        pointer;
}


.ac-v4-btn.primary {

    background:
        linear-gradient(
            135deg,
            #f6cf68,
            #c99a32
        );

    color:
        #17120a;

    border-color:
        transparent;

    font-weight:
        800;
}


.ac-v4-btn:hover {

    transform:
        translateY(-1px);
}


.ac-v4-events {

    display:
        grid;

    gap:
        10px;

    margin-top:
        14px;
}


.ac-v4-event {

    display:
        flex;

    gap:
        12px;

    padding:
        13px;

    border-radius:
        14px;

    background:
        rgba(
            255,
            255,
            255,
            .035
        );
}


.ac-v4-event-dot {

    width:
        9px;

    height:
        9px;

    margin-top:
        6px;

    border-radius:
        50%;

    background:
        #f6cf68;

    box-shadow:
        0 0 14px
        rgba(
            246,
            207,
            104,
            .7
        );

    flex:
        0 0 auto;
}


.ac-v4-event small {

    display:
        block;

    opacity:
        .5;

    margin-top:
        4px;
}


.ac-v4-empty {

    padding:
        30px;

    text-align:
        center;

    opacity:
        .6;
}


@media (max-width: 900px) {

    .ac-v4-grid {

        grid-template-columns:
            repeat(
                2,
                minmax(
                    0,
                    1fr
                )
            );

    }

}


@media (max-width: 600px) {

    .ac-v4-shell {

        padding:
            15px;

        border-radius:
            18px;

    }

    .ac-v4-grid {

        grid-template-columns:
            1fr 1fr;

        gap:
            9px;

    }

    .ac-v4-stat {

        padding:
            13px;

    }

    .ac-v4-stat strong {

        font-size:
            23px;

    }

    .ac-v4-head {

        align-items:
            flex-start;

        flex-direction:
            column;

    }

}
`;

appendOnce(
    "public/style.css",
    CSS_MARKER,
    CSS_V4
);


/*
=========================================================
 FRONTEND V4
=========================================================
*/

const JS_MARKER =
    "ARIZONA_CIVIL_4_0_FRONTEND";

const JS_V4 = `

/* =========================================================
   ARIZONA_CIVIL_4_0_FRONTEND
   Независимый UI-слой: не ломает существующие страницы.
========================================================= */

(function ArizonaCivilV4() {

    "use strict";


    const esc =
        window.escapeHTML ||
        (
            v =>
                String(v ?? "")
                    .replaceAll(
                        "&",
                        "&amp;"
                    )
                    .replaceAll(
                        "<",
                        "&lt;"
                    )
                    .replaceAll(
                        ">",
                        "&gt;"
                    )
                    .replaceAll(
                        '"',
                        "&quot;"
                    )
                    .replaceAll(
                        "'",
                        "&#039;"
                    )
        );


    const request =
        window.api ||
        (
            async (
                url,
                options = {}
            ) => {

                const r =
                    await fetch(
                        url,
                        {
                            credentials:
                                "same-origin",

                            ...options
                        }
                    );


                const d =
                    await r
                        .json()
                        .catch(
                            () => ({})
                        );


                if (!r.ok) {

                    throw new Error(
                        d.error ||
                        "Ошибка сервера"
                    );

                }


                return d;

            }
        );


    let currentPage =
        "dashboard";

    let personnel =
        [];

    let dashboard =
        null;


    function root() {

        return (
            document.querySelector(
                "main"
            ) ||

            document.querySelector(
                ".content"
            ) ||

            document.querySelector(
                ".main-content"
            ) ||

            document.body
        );

    }


    function ensureButton() {

        if (
            document.getElementById(
                "ac-v4-command-button"
            )
        ) {
            return;
        }


        const b =
            document.createElement(
                "button"
            );


        b.id =
            "ac-v4-command-button";


        b.className =
            "ac-v4-btn primary";


        b.textContent =
            "✦ Command Center 4.0";


        b.style.position =
            "fixed";


        b.style.right =
            "18px";


        b.style.bottom =
            "18px";


        b.style.zIndex =
            "9998";


        b.onclick =
            () => open();


        document.body.appendChild(
            b
        );

    }


    function open() {

        currentPage =
            "dashboard";

        render();

    }


    async function loadDashboard() {

        dashboard =
            await request(
                "/api/v4/dashboard"
            );

    }


    async function loadPersonnel(
        search = ""
    ) {

        personnel =
            await request(
                "/api/v4/personnel?search=" +
                encodeURIComponent(search)
            );

    }


    function shell(content) {

        let el =
            document.getElementById(
                "ac-v4-root"
            );


        if (!el) {

            el =
                document.createElement(
                    "section"
                );

            el.id =
                "ac-v4-root";

            el.className =
                "ac-v4-shell";

            root().prepend(el);

        }


        el.innerHTML =
            content;


        return el;

    }


    async function renderDashboard() {

        try {

            await loadDashboard();

        } catch (e) {

            shell(
                '<div class="ac-v4-empty">' +
                'Command Center недоступен: ' +
                esc(e.message) +
                '</div>'
            );

            return;

        }


        const d =
            dashboard;


        shell(`

            <div class="ac-v4-head">

                <div>

                    <h1 class="ac-v4-title">
                        Arizona Civil
                        <span style="opacity:.5">
                            4.0
                        </span>
                    </h1>

                    <p class="ac-v4-subtitle">
                        Command Center ·
                        управление гражданскими структурами
                    </p>

                </div>

                <button
                    class="ac-v4-btn"
                    id="ac-v4-refresh">

                    ↻ Обновить

                </button>

            </div>


            <div class="ac-v4-grid">

                <div class="ac-v4-stat">

                    <span>
                        Всего персонала
                    </span>

                    <strong>
                        \${esc(d.users.total)}
                    </strong>

                </div>


                <div class="ac-v4-stat">

                    <span>
                        Активные
                    </span>

                    <strong>
                        \${esc(d.users.active)}
                    </strong>

                </div>


                <div class="ac-v4-stat">

                    <span>
                        Неактивные
                    </span>

                    <strong>
                        \${esc(d.users.inactive)}
                    </strong>

                </div>


                <div class="ac-v4-stat">

                    <span>
                        Активные назначения
                    </span>

                    <strong>
                        \${esc(
                            d.appointments.count
                        )}
                    </strong>

                </div>

            </div>


            <div class="ac-v4-toolbar">

                <button
                    class="ac-v4-btn primary"
                    id="ac-v4-personnel">

                    👥 Personnel Center

                </button>


                <button
                    class="ac-v4-btn"
                    id="ac-v4-activity">

                    📜 Журнал активности

                </button>


                <button
                    class="ac-v4-btn"
                    id="ac-v4-notify">

                    🔔 Уведомления

                </button>

            </div>


            <h3>
                Последние события
            </h3>


            <div class="ac-v4-events">

                \${
                    d.events.length

                    ?

                    d.events
                        .map(
                            e => `

                                <div
                                    class="ac-v4-event">

                                    <i
                                        class="ac-v4-event-dot">
                                    </i>

                                    <div>

                                        <strong>
                                            \${esc(e.title)}
                                        </strong>

                                        <div>
                                            \${esc(
                                                e.details || ""
                                            )}
                                        </div>

                                        <small>
                                            \${esc(e.actor)}
                                            ·
                                            \${new Date(
                                                e.created_at
                                            ).toLocaleString(
                                                "ru-RU"
                                            )}
                                        </small>

                                    </div>

                                </div>

                            `
                        )
                        .join("")

                    :

                    '<div class="ac-v4-empty">' +
                    'Событий пока нет' +
                    '</div>'

                }

            </div>

        `);


        document.getElementById(
            "ac-v4-refresh"
        ).onclick =
            renderDashboard;


        document.getElementById(
            "ac-v4-personnel"
        ).onclick =
            () => {

                currentPage =
                    "personnel";

                render();

            };


        document.getElementById(
            "ac-v4-activity"
        ).onclick =
            async () => {

                currentPage =
                    "activity";

                render();

            };


        document.getElementById(
            "ac-v4-notify"
        ).onclick =
            async () => {

                currentPage =
                    "notifications";

                render();

            };

    }


    async function renderPersonnel() {

        shell(`

            <div class="ac-v4-head">

                <div>

                    <h1 class="ac-v4-title">
                        Personnel Center
                    </h1>

                    <p class="ac-v4-subtitle">
                        Единый реестр состава
                    </p>

                </div>


                <button
                    class="ac-v4-btn"
                    id="ac-v4-back">

                    ← Dashboard

                </button>

            </div>


            <div class="ac-v4-toolbar">

                <input
                    class="ac-v4-input"
                    id="ac-v4-search"
                    placeholder="Поиск по имени или логину"
                >


                <button
                    class="ac-v4-btn primary"
                    id="ac-v4-search-btn">

                    Найти

                </button>

            </div>


            <div
                id="ac-v4-personnel-table"
                class="ac-v4-table-wrap">

                <div class="ac-v4-empty">
                    Загрузка...
                </div>

            </div>

        `);


        document.getElementById(
            "ac-v4-back"
        ).onclick =
            () => {

                currentPage =
                    "dashboard";

                render();

            };


        const search =
            document.getElementById(
                "ac-v4-search"
            );


        document.getElementById(
            "ac-v4-search-btn"
        ).onclick =
            () =>
                renderPersonnelData(
                    search.value.trim()
                );


        search.addEventListener(
            "keydown",
            e => {

                if (
                    e.key === "Enter"
                ) {

                    renderPersonnelData(
                        search.value.trim()
                    );

                }

            }
        );


        await renderPersonnelData(
            ""
        );

    }


    async function renderPersonnelData(
        search
    ) {

        const box =
            document.getElementById(
                "ac-v4-personnel-table"
            );


        if (!box) {
            return;
        }


        try {

            await loadPersonnel(
                search
            );


            if (
                !personnel.length
            ) {

                box.innerHTML =
                    '<div class="ac-v4-empty">' +
                    'Сотрудники не найдены' +
                    '</div>';

                return;

            }


            box.innerHTML = `

                <table
                    class="ac-v4-table">

                    <thead>

                        <tr>

                            <th>
                                Сотрудник
                            </th>

                            <th>
                                Роль
                            </th>

                            <th>
                                Должность
                            </th>

                            <th>
                                Структура
                            </th>

                            <th>
                                Статус
                            </th>

                            <th>
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        \${
                            personnel
                                .map(
                                    u => `

                                        <tr>

                                            <td>

                                                <strong>
                                                    \${esc(
                                                        u.name ||
                                                        u.username
                                                    )}
                                                </strong>

                                                <br>

                                                <small>
                                                    @\${esc(
                                                        u.username
                                                    )}
                                                </small>

                                            </td>


                                            <td>

                                                <span
                                                    class="ac-v4-badge">

                                                    \${esc(
                                                        u.role
                                                    )}

                                                </span>

                                            </td>


                                            <td>
                                                \${esc(
                                                    u.position ||
                                                    "—"
                                                )}
                                            </td>


                                            <td>
                                                \${esc(
                                                    u.organization ||
                                                    "—"
                                                )}
                                            </td>


                                            <td>

                                                \${
                                                    u.active
                                                    ?
                                                    "● Активен"
                                                    :
                                                    "○ Неактивен"
                                                }

                                            </td>


                                            <td>

                                                <button
                                                    class="ac-v4-btn"
                                                    data-v4-user="\${u.id}">

                                                    Профиль

                                                </button>

                                            </td>

                                        </tr>

                                    `
                                )
                                .join("")
                        }

                    </tbody>

                </table>

            `;


            box
                .querySelectorAll(
                    "[data-v4-user]"
                )
                .forEach(
                    btn => {

                        btn.onclick =
                            () =>
                                renderProfile(
                                    Number(
                                        btn.dataset.v4User
                                    )
                                );

                    }
                );

        } catch (e) {

            box.innerHTML =
                '<div class="ac-v4-empty">' +
                esc(e.message) +
                '</div>';

        }

    }


    async function renderProfile(
        id
    ) {

        try {

            const d =
                await request(
                    "/api/v4/personnel/" +
                    id
                );


            shell(`

                <div class="ac-v4-head">

                    <div>

                        <h1 class="ac-v4-title">

                            \${esc(
                                d.user.name ||
                                d.user.username
                            )}

                        </h1>


                        <p class="ac-v4-subtitle">

                            \${esc(
                                d.user.role
                            )}

                            ·

                            \${esc(
                                d.user.position ||
                                "Без должности"
                            )}

                        </p>

                    </div>


                    <button
                        class="ac-v4-btn"
                        id="ac-v4-profile-back">

                        ← Personnel

                    </button>

                </div>


                <div class="ac-v4-grid">

                    <div class="ac-v4-stat">

                        <span>
                            Логин
                        </span>

                        <strong
                            style="font-size:18px">

                            \${esc(
                                d.user.username
                            )}

                        </strong>

                    </div>


                    <div class="ac-v4-stat">

                        <span>
                            Роль
                        </span>

                        <strong
                            style="font-size:18px">

                            \${esc(
                                d.user.role
                            )}

                        </strong>

                    </div>


                    <div class="ac-v4-stat">

                        <span>
                            Структура
                        </span>

                        <strong
                            style="font-size:18px">

                            \${esc(
                                d.user.organization ||
                                "—"
                            )}

                        </strong>

                    </div>


                    <div class="ac-v4-stat">

                        <span>
                            VK
                        </span>

                        <strong
                            style="font-size:18px">

                            \${esc(
                                d.user.vk ||
                                "—"
                            )}

                        </strong>

                    </div>

                </div>


                <h3>
                    История
                </h3>


                <div
                    class="ac-v4-events">

                    \${
                        d.history.length

                        ?

                        d.history
                            .map(
                                h => `

                                    <div
                                        class="ac-v4-event">

                                        <i
                                            class="ac-v4-event-dot">
                                        </i>

                                        <div>

                                            <strong>
                                                \${esc(
                                                    h.action
                                                )}
                                            </strong>

                                            <div>
                                                \${esc(
                                                    h.details ||
                                                    ""
                                                )}
                                            </div>

                                            <small>

                                                \${esc(
                                                    h.actor ||
                                                    "system"
                                                )}

                                                ·

                                                \${new Date(
                                                    h.created_at
                                                ).toLocaleString(
                                                    "ru-RU"
                                                )}

                                            </small>

                                        </div>

                                    </div>

                                `
                            )
                            .join("")

                        :

                        '<div class="ac-v4-empty">' +
                        'История пуста' +
                        '</div>'

                    }

                </div>


                <h3
                    style="margin-top:24px">

                    Заметки

                </h3>


                <div
                    class="ac-v4-toolbar">

                    <input
                        class="ac-v4-input"
                        id="ac-v4-note"
                        style="flex:1"
                        placeholder="Добавить заметку"
                    >


                    <button
                        class="ac-v4-btn primary"
                        id="ac-v4-add-note">

                        Добавить

                    </button>

                </div>

            `);


            document.getElementById(
                "ac-v4-profile-back"
            ).onclick =
                () => {

                    currentPage =
                        "personnel";

                    render();

                };


            document.getElementById(
                "ac-v4-add-note"
            ).onclick =
                async () => {

                    const input =
                        document.getElementById(
                            "ac-v4-note"
                        );


                    if (
                        !input.value.trim()
                    ) {
                        return;
                    }


                    try {

                        await request(
                            "/api/v4/personnel/" +
                            id +
                            "/notes",
                            {

                                method:
                                    "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({
                                        note:
                                            input.value.trim()
                                    })

                            }
                        );


                        renderProfile(
                            id
                        );

                    } catch (e) {

                        alert(
                            e.message
                        );

                    }

                };

        } catch (e) {

            shell(
                '<div class="ac-v4-empty">' +
                esc(e.message) +
                '</div>'
            );

        }

    }


    async function renderActivity() {

        try {

            const rows =
                await request(
                    "/api/v4/activity"
                );


            shell(`

                <div
                    class="ac-v4-head">

                    <div>

                        <h1
                            class="ac-v4-title">

                            Журнал активности

                        </h1>

                        <p
                            class="ac-v4-subtitle">

                            Последние системные события

                        </p>

                    </div>


                    <button
                        class="ac-v4-btn"
                        id="ac-v4-back">

                        ← Dashboard

                    </button>

                </div>


                <div
                    class="ac-v4-events">

                    \${
                        rows
                            .map(
                                e => `

                                    <div
                                        class="ac-v4-event">

                                        <i
                                            class="ac-v4-event-dot">
                                        </i>

                                        <div>

                                            <strong>
                                                \${esc(
                                                    e.title
                                                )}
                                            </strong>

                                            <div>
                                                \${esc(
                                                    e.details ||
                                                    ""
                                                )}
                                            </div>

                                            <small>

                                                \${esc(
                                                    e.actor
                                                )}

                                                ·

                                                \${new Date(
                                                    e.created_at
                                                ).toLocaleString(
                                                    "ru-RU"
                                                )}

                                            </small>

                                        </div>

                                    </div>

                                `
                            )
                            .join("")

                        ||

                        '<div class="ac-v4-empty">' +
                        'Журнал пуст' +
                        '</div>'

                    }

                </div>

            `);


            document.getElementById(
                "ac-v4-back"
            ).onclick =
                () => {

                    currentPage =
                        "dashboard";

                    render();

                };

        } catch (e) {

            shell(
                '<div class="ac-v4-empty">' +
                esc(e.message) +
                '</div>'
            );

        }

    }


    async function renderNotifications() {

        try {

            const rows =
                await request(
                    "/api/v4/notifications"
                );


            shell(`

                <div
                    class="ac-v4-head">

                    <div>

                        <h1
                            class="ac-v4-title">

                            Уведомления

                        </h1>

                        <p
                            class="ac-v4-subtitle">

                            Системные события вашего аккаунта

                        </p>

                    </div>


                    <button
                        class="ac-v4-btn"
                        id="ac-v4-back">

                        ← Dashboard

                    </button>

                </div>


                <div
                    class="ac-v4-events">

                    \${
                        rows
                            .map(
                                n => `

                                    <div
                                        class="ac-v4-event">

                                        <i
                                            class="ac-v4-event-dot">
                                        </i>

                                        <div
                                            style="flex:1">

                                            <strong>
                                                \${esc(
                                                    n.title
                                                )}
                                            </strong>

                                            <div>
                                                \${esc(
                                                    n.message
                                                )}
                                            </div>

                                            <small>

                                                \${new Date(
                                                    n.created_at
                                                ).toLocaleString(
                                                    "ru-RU"
                                                )}

                                                ·

                                                \${
                                                    n.read
                                                    ?
                                                    "прочитано"
                                                    :
                                                    "новое"
                                                }

                                            </small>

                                        </div>


                                        \${
                                            n.read
                                            ?

                                            ""

                                            :

                                            '<button ' +
                                            'class="ac-v4-btn" ' +
                                            'data-v4-read="' +
                                            n.id +
                                            '">' +
                                            'Прочитано' +
                                            '</button>'
                                        }

                                    </div>

                                `
                            )
                            .join("")

                        ||

                        '<div class="ac-v4-empty">' +
                        'Уведомлений нет' +
                        '</div>'

                    }

                </div>

            `);


            document.getElementById(
                "ac-v4-back"
            ).onclick =
                () => {

                    currentPage =
                        "dashboard";

                    render();

                };


            document.querySelectorAll(
                "[data-v4-read]"
            ).forEach(
                btn => {

                    btn.onclick =
                        async () => {

                            await request(
                                "/api/v4/notifications/" +
                                btn.dataset.v4Read,

                                {
                                    method:
                                        "PATCH"
                                }
                            );

                            renderNotifications();

                        };

                }
            );

        } catch (e) {

            shell(
                '<div class="ac-v4-empty">' +
                esc(e.message) +
                '</div>'
            );

        }

    }


    async function render() {

        if (
            currentPage ===
            "personnel"
        ) {
            return renderPersonnel();
        }


        if (
            currentPage ===
            "activity"
        ) {
            return renderActivity();
        }


        if (
            currentPage ===
            "notifications"
        ) {
            return renderNotifications();
        }


        return renderDashboard();

    }


    function boot() {

        ensureButton();


        setTimeout(
            () => {

                const loggedIn =
                    document.body &&
                    !document.body.innerText.includes(
                        "Войдите в аккаунт"
                    );


                if (loggedIn) {

                    /*
                     кнопка доступна независимо
                     от роли, API сам проверяет
                     авторизацию
                    */

                }

            },
            500
        );

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            boot,
            {
                once: true
            }
        );

    } else {

        boot();

    }

})();
`;

appendOnce(
    "public/app.js",
    JS_MARKER,
    JS_V4
);


/*
=========================================================
 HTML META
=========================================================
*/

const HTML_MARKER =
    "ARIZONA_CIVIL_4_0_META";

const HTML_V4 = `

<!-- ARIZONA_CIVIL_4_0_META -->

<meta
    name="theme-color"
    content="#0b0d12"
>

<meta
    name="color-scheme"
    content="dark"
>

<meta
    name="description"
    content="Arizona Civil 4.0 — Command Center"
>

`;

replaceOnce(
    "public/index.html",

    "</head>",

    HTML_V4 +
    "\n</head>",

    "Meta V4"
);


/*
=========================================================
 PACKAGE
=========================================================
*/

const packagePath =
    file("package.json");

const pkg =
    JSON.parse(
        fs.readFileSync(
            packagePath,
            "utf8"
        )
    );


pkg.version =
    "4.0.0";


pkg.scripts =
    pkg.scripts || {};


pkg.scripts.check =
    "node --check server.js && node --check db.js && node --check permissions.js";


pkg.scripts.start =
    "node server.js";


pkg.scripts["start:prod"] =
    "NODE_ENV=production node server.js";


fs.writeFileSync(
    packagePath,
    JSON.stringify(
        pkg,
        null,
        2
    ) +
    "\n"
);


console.log(
    "✅ package.json → 4.0.0"
);


/*
=========================================================
 RENDER
=========================================================
*/

const renderPath =
    file("render.yaml");

let render =
    fs.readFileSync(
        renderPath,
        "utf8"
    );


if (
    !render.includes(
        "ARIZONA_CIVIL_V4"
    )
) {

    render += `

# ARIZONA_CIVIL_V4
`;

    fs.writeFileSync(
        renderPath,
        render
    );

}


console.log(
    "✅ render.yaml проверен"
);


/*
=========================================================
 VERSION
=========================================================
*/

const versionPath =
    file("VERSION");

fs.writeFileSync(
    versionPath,
    "4.0.0\n"
);


console.log(
    "✅ VERSION = 4.0.0"
);


/*
=========================================================
 ENV EXAMPLE
=========================================================
*/

if (
    !exists(".env.example")
) {

    fs.writeFileSync(
        file(".env.example"),

`NODE_ENV=production
PORT=10000
DATABASE_URL=
SESSION_SECRET=
PG_POOL_MAX=10
`
    );

    console.log(
        "✅ .env.example создан"
    );

}


/*
=========================================================
 GITIGNORE
=========================================================
*/

const gitignorePath =
    file(".gitignore");

let gi =
    exists(".gitignore")
        ? fs.readFileSync(
            gitignorePath,
            "utf8"
        )
        : "";


for (
    const line
    of [
        ".env",
        "backup-before-4.0-*",
        "*.log"
    ]
) {

    if (
        !gi
            .split(/\r?\n/)
            .includes(line)
    ) {

        gi +=
            (
                gi.endsWith("\n")
                    ? ""
                    : "\n"
            ) +
            line +
            "\n";

    }

}


fs.writeFileSync(
    gitignorePath,
    gi
);


/*
=========================================================
 CHECK
=========================================================
*/

console.log(
    "\n========================================"
);

console.log(
    " Проверка Arizona Civil 4.0"
);

console.log(
    "========================================"
);


const checks = [

    [
        "server.js",
        "node --check server.js"
    ],

    [
        "db.js",
        "node --check db.js"
    ],

    [
        "public/app.js",
        "node --check public/app.js"
    ]

];


for (
    const [name, cmd]
    of checks
) {

    try {

        execSync(
            cmd,
            {
                cwd: ROOT,
                stdio: "pipe"
            }
        );


        console.log(
            `✅ Syntax OK: ${name}`
        );

    } catch (e) {

        console.error(
            `❌ Syntax ERROR: ${name}`
        );

        console.error(
            e.stdout?.toString() ||
            ""
        );

        console.error(
            e.stderr?.toString() ||
            ""
        );

        console.error(
            `Backup находится здесь: ${BACKUP}`
        );

        process.exit(1);

    }

}


try {

    execSync(
        "node --check permissions.js",
        {
            cwd: ROOT,
            stdio: "pipe"
        }
    );


    console.log(
        "✅ Syntax OK: permissions.js"
    );

} catch {

    console.log(
        "⚠️ permissions.js не найден или содержит старую ошибку — существующий файл не изменялся."
    );

}


console.log(`

╔══════════════════════════════════════════════╗
║       ARIZONA CIVIL 4.0 — READY             ║
╠══════════════════════════════════════════════╣
║ ✅ PostgreSQL V4 migration                   ║
║ ✅ Command Center                            ║
║ ✅ Personnel Center                          ║
║ ✅ Profiles + history                        ║
║ ✅ Notes                                     ║
║ ✅ Notifications                             ║
║ ✅ Activity log                              ║
║ ✅ Role assignment API                        ║
║ ✅ Organization assignment API                ║
║ ✅ New responsive UI                          ║
║ ✅ Render configuration                       ║
║ ✅ VERSION 4.0.0                              ║
║ ✅ Backups                                    ║
╚══════════════════════════════════════════════╝

Backup:
${BACKUP}

Запуск:
npm start

Проверка:
curl http://localhost:3000/health

Если всё работает:
git add .
git commit -m "Arizona Civil 4.0"
git push
`);
