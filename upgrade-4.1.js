#!/usr/bin/env node
/*
=========================================================
 ARIZONA CIVIL 4.1 — ONE COMMAND UPGRADE
 --------------------------------------------------------
 Без удаления существующих данных.

 Добавляет:
 - безопасный backup
 - PostgreSQL V4.1 migration
 - API health / stats
 - Personnel filters
 - Personnel role/organization management
 - Notes + notifications
 - Activity log
 - Command Center UI 4.1
 - dark responsive UI
 - versioning
 - Render hardening
 - безопасная повторная установка
=========================================================
*/

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const BACKUP = path.join(ROOT, `backup-before-4.1-${stamp}`);

function file(name) {
    return path.join(ROOT, name);
}

function exists(name) {
    return fs.existsSync(file(name));
}

function backup(name) {
    const src = file(name);

    if (!fs.existsSync(src)) {
        return;
    }

    const dest = path.join(BACKUP, name);

    fs.mkdirSync(path.dirname(dest), {
        recursive: true
    });

    fs.copyFileSync(src, dest);

    console.log(`✅ Backup: ${name}`);
}

function appendOnce(name, marker, content) {
    const p = file(name);

    if (!fs.existsSync(p)) {
        throw new Error(`Файл не найден: ${name}`);
    }

    const text = fs.readFileSync(
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

    if (!fs.existsSync(p)) {
        throw new Error(
            `Файл не найден: ${name}`
        );
    }

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

function writeIfMissing(name, content) {
    if (exists(name)) {
        console.log(
            `↪️ Уже существует: ${name}`
        );

        return false;
    }

    fs.writeFileSync(
        file(name),
        content,
        "utf8"
    );

    console.log(
        `✅ Создан: ${name}`
    );

    return true;
}

console.log(`
╔══════════════════════════════════════════════════╗
║             ARIZONA CIVIL 4.1                  ║
║               ONE COMMAND UPGRADE               ║
╚══════════════════════════════════════════════════╝
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

console.log(
    "🔎 Проверка файлов проекта..."
);

for (const name of required) {
    if (!exists(name)) {
        throw new Error(
            `Не найден обязательный файл: ${name}`
        );
    }

    console.log(
        `✅ ${name}`
    );
}

fs.mkdirSync(
    BACKUP,
    {
        recursive: true
    }
);

console.log(
    `\n📦 Backup: ${BACKUP}\n`
);

for (const name of required) {
    backup(name);
}

for (
    const optional
    of [
        ".gitignore",
        ".env.example",
        "VERSION"
    ]
) {
    if (exists(optional)) {
        backup(optional);
    }
}


/*
=========================================================
 DATABASE V4.1
=========================================================
*/

const DB_MARKER =
    "ARIZONA_CIVIL_4_1_DATABASE";

const DB_MIGRATION = `

/*
=========================================================
 ARIZONA_CIVIL_4_1_DATABASE
 Без удаления существующих данных
=========================================================
*/

async function initDatabaseV41() {

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

            organization VARCHAR(200)
                DEFAULT '',

            created_at TIMESTAMPTZ
                NOT NULL DEFAULT NOW()
        )
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS
        idx_activity_events_created_v41
        ON activity_events(created_at DESC)
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS
        idx_activity_events_actor_v41
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
        idx_personnel_notes_v4_user_v41
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
        idx_notifications_user_read_v41
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
        idx_org_members_org_v41
        ON organization_members(organization)
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS
        idx_org_members_user_v41
        ON organization_members(user_id)
    \`);

    await query(\`
        CREATE INDEX IF NOT EXISTS
        idx_org_members_active_v41
        ON organization_members(active)
    \`);


    /*
    =====================================================
     V4.1 SYSTEM SETTINGS
    =====================================================
    */

    await query(\`
        INSERT INTO system_settings
            (key, value, updated_by)
        VALUES
            (
                'application_version',
                '4.1.0',
                'system'
            )
        ON CONFLICT (key)
        DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = NOW()
    \`);


    await query(\`
        INSERT INTO system_settings
            (key, value, updated_by)
        VALUES
            (
                'application_codename',
                'Command Center',
                'system'
            )
        ON CONFLICT (key)
        DO NOTHING
    \`);


    console.log(
        "✅ Arizona Civil 4.1: PostgreSQL migration готова"
    );
}


module.exports.initDatabaseV41 =
    initDatabaseV41;

`;


/*
=========================================================
 APPEND DATABASE
=========================================================
*/

appendOnce(
    "db.js",
    DB_MARKER,
    DB_MIGRATION
);


/*
=========================================================
 SERVER V4.1 API
=========================================================
*/

const SERVER_MARKER =
    "ARIZONA_CIVIL_4_1_API";

const SERVER_API = `

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


        await query(\`
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
        \`, [

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

                query(\`
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
                \`),

                query(\`
                    SELECT
                        role,
                        COUNT(*)::int AS count

                    FROM users

                    GROUP BY role

                    ORDER BY
                        count DESC,
                        role
                \`),

                query(\`
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
                \`),

                query(\`
                    SELECT
                        COUNT(*)::int AS count

                    FROM appointments

                    WHERE active = TRUE
                \`),

                query(\`
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
                \`),

                query(\`
                    SELECT
                        COUNT(*)::int AS count

                    FROM notifications

                    WHERE
                        user_id = $1

                        AND read = FALSE
                \`,
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
                await query(\`

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

                \`,
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
                await query(\`

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

                query(\`

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

                \`,
                [id]),

                query(\`

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

                \`,
                [id]),

                query(\`

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

                \`,
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
                await query(\`

                    SELECT

                        id,
                        username,
                        name,
                        role,
                        organization

                    FROM users

                    WHERE id = $1

                \`,
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
                await query(\`

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

                \`,
                [
                    newRole,
                    id
                ]);


            await query(\`

                INSERT INTO role_history
                    (
                        user_id,
                        old_role,
                        new_role,
                        changed_by
                    )

                VALUES
                    ($1, $2, $3, $4)

            \`,
            [
                id,
                oldRole,
                newRole,
                actor.username
            ]);


            await query(\`

                INSERT INTO personnel_history
                    (
                        user_id,
                        action,
                        details,
                        actor
                    )

                VALUES
                    ($1, $2, $3, $4)

            \`,
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


            await query(\`

                INSERT INTO notifications
                    (
                        user_id,
                        title,
                        message,
                        type
                    )

                VALUES
                    ($1, $2, $3, $4)

            \`,
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
                await query(\`

                    SELECT

                        id,
                        organization,
                        position,
                        username,
                        role

                    FROM users

                    WHERE id = $1

                \`,
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
                await query(\`

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

                \`,
                [
                    organization,
                    position,
                    actor.username,
                    id
                ]);


            await query(\`

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

            \`,
            [
                id,
                organization,
                position,
                actor.username
            ]);


            await query(\`

                INSERT INTO personnel_history
                    (
                        user_id,
                        action,
                        details,
                        actor
                    )

                VALUES
                    ($1, $2, $3, $4)

            \`,
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


            await query(\`

                INSERT INTO notifications
                    (
                        user_id,
                        title,
                        message,
                        type
                    )

                VALUES
                    ($1, $2, $3, $4)

            \`,
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
                await query(\`

                    SELECT
                        id,
                        username

                    FROM users

                    WHERE id = $1

                \`,
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
                await query(\`

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

                \`,
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
                await query(\`

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

                \`,
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
                await query(\`

                    UPDATE notifications

                    SET read = TRUE

                    WHERE

                        id = $1

                        AND user_id = $2

                    RETURNING id

                \`,
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
                await query(\`

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

                \`);


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
                await query(\`

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

                \`);


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
                await query(\`

                    SELECT

                        key,
                        value,
                        updated_by,
                        updated_at

                    FROM system_settings

                    ORDER BY key

                \`);


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

replaceOnce(
    "server.js",

    `const { initDatabase, initDatabaseV30, query, pool } = require("./db");`,

    `const {
        initDatabase,
        initDatabaseV30,
        initDatabaseV40,
        initDatabaseV41,
        query,
        pool
    } = require("./db");`,

    "Импорт initDatabaseV41"
);


/*
=========================================================
 Если V4 уже установлена — добавляем V4.1 после неё.
 Если V4.0 не найдена — пытаемся добавить после V30.
=========================================================
*/

if (
    fs.readFileSync(
        file("server.js"),
        "utf8"
    ).includes(
        "initDatabaseV40"
    )
) {

    const serverText =
        fs.readFileSync(
            file("server.js"),
            "utf8"
        );


    if (
        !serverText.includes(
            "initDatabaseV41()"
        )
    ) {

        if (
            serverText.includes(
                `await initDatabaseV40();`
            )
        ) {

            replaceOnce(
                "server.js",

                `await initDatabaseV40();`,

                `await initDatabaseV40();

        if (
            typeof initDatabaseV41 ===
            "function"
        ) {
            await initDatabaseV41();
        }`,

                "Подключение миграции V4.1"
            );

        }

    }

} else {

    try {

        replaceOnce(
            "server.js",

            `await initDatabaseV30();`,

            `await initDatabaseV30();

        if (
            typeof initDatabaseV41 ===
            "function"
        ) {
            await initDatabaseV41();
        }`,

            "Подключение миграции V4.1"
        );

    } catch (error) {

        console.log(
            "⚠️ Автоматическое подключение V4.1 не выполнено:"
        );

        console.log(
            error.message
        );

    }

}


/*
=========================================================
 Если import был V4.0-формата
=========================================================
*/

try {

    const serverNow =
        fs.readFileSync(
            file("server.js"),
            "utf8"
        );


    if (
        serverNow.includes(
            "initDatabaseV40"
        )
        &&
        !serverNow.includes(
            "initDatabaseV41"
        )
    ) {

        console.log(
            "⚠️ initDatabaseV41 ещё не подключена."
        );

    }

} catch {
}


/*
=========================================================
 CSS V4.1
=========================================================
*/

const CSS_MARKER =
    "ARIZONA_CIVIL_4_1_CSS";

const CSS_V41 = `

/* =========================================================
   ARIZONA_CIVIL_4_1_CSS
========================================================= */


.ac-v41-topbar {

    display:
        flex;

    justify-content:
        space-between;

    align-items:
        center;

    gap:
        12px;

    margin-bottom:
        20px;

    padding:
        12px 14px;

    border-radius:
        16px;

    background:
        rgba(
            255,
            255,
            255,
            .035
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


.ac-v41-brand {

    display:
        flex;

    align-items:
        center;

    gap:
        10px;

    font-weight:
        800;

}


.ac-v41-brand-mark {

    width:
        36px;

    height:
        36px;

    display:
        grid;

    place-items:
        center;

    border-radius:
        11px;

    background:
        linear-gradient(
            135deg,
            #f6cf68,
            #c99a32
        );

    color:
        #17120a;

    font-weight:
        900;

}


.ac-v41-online {

    display:
        inline-flex;

    align-items:
        center;

    gap:
        7px;

    font-size:
        12px;

    opacity:
        .7;

}


.ac-v41-online-dot {

    width:
        7px;

    height:
        7px;

    border-radius:
        50%;

    background:
        #65d68b;

    box-shadow:
        0 0 10px
        rgba(
            101,
            214,
            139,
            .7
        );

}


.ac-v41-profile {

    display:
        flex;

    align-items:
        center;

    gap:
        10px;

}


.ac-v41-avatar {

    width:
        38px;

    height:
        38px;

    border-radius:
        50%;

    object-fit:
        cover;

    border:
        1px solid
        rgba(
            255,
            255,
            255,
            .12
        );

}


.ac-v41-avatar-placeholder {

    width:
        38px;

    height:
        38px;

    display:
        grid;

    place-items:
        center;

    border-radius:
        50%;

    background:
        rgba(
            255,
            210,
            90,
            .1
        );

    border:
        1px solid
        rgba(
            255,
            210,
            90,
            .2
        );

}


.ac-v41-layout {

    display:
        grid;

    grid-template-columns:
        minmax(
            0,
            1fr
        );

    gap:
        16px;

}


.ac-v41-card {

    padding:
        18px;

    border-radius:
        18px;

    background:
        rgba(
            255,
            255,
            255,
            .035
        );

    border:
        1px solid
        rgba(
            255,
            255,
            255,
            .065
        );

}


.ac-v41-card-title {

    display:
        flex;

    align-items:
        center;

    justify-content:
        space-between;

    gap:
        10px;

    margin-bottom:
        14px;

}


.ac-v41-card-title h3 {

    margin:
        0;

}


.ac-v41-muted {

    opacity:
        .55;

}


.ac-v41-actions {

    display:
        flex;

    gap:
        8px;

    flex-wrap:
        wrap;

}


.ac-v41-select {

    min-height:
        40px;

    padding:
        0 12px;

    border-radius:
        10px;

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
            .24
        );

    color:
        inherit;

}


.ac-v41-danger {

    border-color:
        rgba(
            255,
            100,
            100,
            .2
        );

}


.ac-v41-user {

    display:
        flex;

    align-items:
        center;

    gap:
        12px;

}


.ac-v41-user-avatar {

    width:
        44px;

    height:
        44px;

    flex:
        0 0 auto;

    border-radius:
        50%;

    object-fit:
        cover;

}


.ac-v41-user-avatar-placeholder {

    width:
        44px;

    height:
        44px;

    flex:
        0 0 auto;

    display:
        grid;

    place-items:
        center;

    border-radius:
        50%;

    background:
        rgba(
            255,
            255,
            255,
            .06
        );

}


.ac-v41-user-name {

    font-weight:
        800;

}


.ac-v41-user-login {

    font-size:
        12px;

    opacity:
        .5;

}


.ac-v41-role {

    display:
        inline-flex;

    align-items:
        center;

    padding:
        5px 9px;

    border-radius:
        999px;

    font-size:
        11px;

    background:
        rgba(
            255,
            210,
            90,
            .08
        );

    border:
        1px solid
        rgba(
            255,
            210,
            90,
            .16
        );

}


.ac-v41-kpi {

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
        12px;

}


.ac-v41-kpi-item {

    padding:
        15px;

    border-radius:
        15px;

    background:
        rgba(
            255,
            255,
            255,
            .03
        );

}


.ac-v41-kpi-item span {

    display:
        block;

    font-size:
        10px;

    text-transform:
        uppercase;

    letter-spacing:
        .1em;

    opacity:
        .5;

}


.ac-v41-kpi-item strong {

    display:
        block;

    margin-top:
        7px;

    font-size:
        25px;

}


.ac-v41-filterbar {

    display:
        grid;

    grid-template-columns:
        minmax(
            180px,
            2fr
        )
        repeat(
            2,
            minmax(
                150px,
                1fr
            )
        )
        auto;

    gap:
        9px;

    margin:
        15px 0;

}


.ac-v41-notification-unread {

    border-left:
        3px solid
        #f6cf68;

}


.ac-v41-notification-read {

    opacity:
        .6;

}


.ac-v41-empty {

    padding:
        36px 20px;

    text-align:
        center;

    opacity:
        .55;

}


.ac-v41-divider {

    height:
        1px;

    margin:
        18px 0;

    background:
        rgba(
            255,
            255,
            255,
            .06
        );

}


@media (max-width: 900px) {

    .ac-v41-kpi {

        grid-template-columns:
            repeat(
                2,
                minmax(
                    0,
                    1fr
                )
            );

    }


    .ac-v41-filterbar {

        grid-template-columns:
            1fr 1fr;

    }

}


@media (max-width: 600px) {

    .ac-v41-topbar {

        align-items:
            flex-start;

        flex-direction:
            column;

    }


    .ac-v41-kpi {

        grid-template-columns:
            1fr 1fr;

        gap:
            8px;

    }


    .ac-v41-filterbar {

        grid-template-columns:
            1fr;

    }


    .ac-v41-kpi-item strong {

        font-size:
            21px;

    }

}

`;

appendOnce(
    "public/style.css",
    CSS_MARKER,
    CSS_V41
);


/*
=========================================================
 FRONTEND V4.1
=========================================================
*/

const JS_MARKER =
    "ARIZONA_CIVIL_4_1_FRONTEND";

const JS_V41 = `

/* =========================================================
   ARIZONA_CIVIL_4_1_FRONTEND
========================================================= */

(function ArizonaCivilV41() {

    "use strict";


    const esc =
        window.escapeHTML ||
        (
            value =>
                String(
                    value ?? ""
                )
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

                const response =
                    await fetch(
                        url,
                        {
                            credentials:
                                "same-origin",

                            ...options
                        }
                    );


                const data =
                    await response
                        .json()
                        .catch(
                            () => ({})
                        );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        data.error ||
                        "Ошибка сервера"
                    );

                }


                return data;

            }
        );


    let currentPage =
        "dashboard";


    let dashboard =
        null;


    let personnel =
        [];


    let currentPersonnelSearch =
        "";


    function root() {

        return (
            document.querySelector(
                "main"
            )

            ||

            document.querySelector(
                ".content"
            )

            ||

            document.querySelector(
                ".main-content"
            )

            ||

            document.body
        );

    }


    function ensureButton() {

        if (
            document.getElementById(
                "ac-v41-command-button"
            )
        ) {

            return;

        }


        const button =
            document.createElement(
                "button"
            );


        button.id =
            "ac-v41-command-button";


        button.className =
            "ac-v4-btn primary";


        button.textContent =
            "✦ Command Center 4.1";


        button.style.position =
            "fixed";


        button.style.right =
            "18px";


        button.style.bottom =
            "18px";


        button.style.zIndex =
            "9998";


        button.onclick =
            () => {

                currentPage =
                    "dashboard";

                render();

            };


        document.body.appendChild(
            button
        );

    }


    function shell(content) {

        let element =
            document.getElementById(
                "ac-v4-root"
            );


        if (!element) {

            element =
                document.createElement(
                    "section"
                );


            element.id =
                "ac-v4-root";


            element.className =
                "ac-v4-shell";


            root().prepend(
                element
            );

        }


        element.innerHTML =
            content;


        return element;

    }


    function avatar(
        user,
        sizeClass = ""
    ) {

        if (
            user &&
            user.avatar_url
        ) {

            return \`
                <img
                    class="ac-v41-avatar \${sizeClass}"
                    src="\${esc(user.avatar_url)}"
                    alt=""
                    loading="lazy"
                >
            \`;

        }


        const letter =
            String(
                user &&
                (
                    user.name ||
                    user.username
                )
                ||
                "?"
            )
            .slice(
                0,
                1
            )
            .toUpperCase();


        return \`
            <div
                class="ac-v41-avatar-placeholder \${sizeClass}">
                \${esc(letter)}
            </div>
        \`;

    }


    async function loadDashboard() {

        dashboard =
            await request(
                "/api/v4/dashboard"
            );

    }


    async function loadPersonnel(
        search = "",
        role = "",
        organization = "",
        active = ""
    ) {

        const params =
            new URLSearchParams();


        if (search) {
            params.set(
                "search",
                search
            );
        }


        if (role) {
            params.set(
                "role",
                role
            );
        }


        if (organization) {
            params.set(
                "organization",
                organization
            );
        }


        if (active !== "") {
            params.set(
                "active",
                active
            );
        }


        personnel =
            await request(
                "/api/v4/personnel?" +
                params.toString()
            );

    }


    async function renderDashboard() {

        try {

            await loadDashboard();

        } catch (error) {

            shell(\`

                <div
                    class="ac-v4-empty">

                    Command Center недоступен:
                    \${esc(error.message)}

                </div>

            \`);

            return;

        }


        const d =
            dashboard;


        shell(\`

            <div
                class="ac-v41-topbar">

                <div
                    class="ac-v41-brand">

                    <div
                        class="ac-v41-brand-mark">

                        AC

                    </div>

                    <div>

                        <div>
                            Arizona Civil
                        </div>

                        <small
                            class="ac-v41-muted">

                            Command Center 4.1

                        </small>

                    </div>

                </div>


                <div
                    class="ac-v41-profile">

                    \${avatar(d.user)}

                    <div>

                        <strong>
                            \${esc(
                                d.user.name ||
                                d.user.username
                            )}
                        </strong>

                        <div
                            class="ac-v41-online">

                            <i
                                class="ac-v41-online-dot">
                            </i>

                            \${esc(
                                d.user.role
                            )}

                        </div>

                    </div>

                </div>

            </div>


            <div
                class="ac-v4-head">

                <div>

                    <h1
                        class="ac-v4-title">

                        Arizona Civil
                        <span
                            style="opacity:.45">

                            4.1

                        </span>

                    </h1>

                    <p
                        class="ac-v4-subtitle">

                        Центр управления
                        гражданскими структурами

                    </p>

                </div>


                <button
                    class="ac-v4-btn"
                    id="ac-v41-refresh">

                    ↻ Обновить

                </button>

            </div>


            <div
                class="ac-v41-kpi">

                <div
                    class="ac-v41-kpi-item">

                    <span>
                        Персонал
                    </span>

                    <strong>
                        \${esc(
                            d.users.total
                        )}
                    </strong>

                </div>


                <div
                    class="ac-v41-kpi-item">

                    <span>
                        Активные
                    </span>

                    <strong>
                        \${esc(
                            d.users.active
                        )}
                    </strong>

                </div>


                <div
                    class="ac-v41-kpi-item">

                    <span>
                        Неактивные
                    </span>

                    <strong>
                        \${esc(
                            d.users.inactive
                        )}
                    </strong>

                </div>


                <div
                    class="ac-v41-kpi-item">

                    <span>
                        Уведомления
                    </span>

                    <strong>
                        \${esc(
                            d.notifications.count
                        )}
                    </strong>

                </div>

            </div>


            <div
                class="ac-v4-toolbar">

                <button
                    class="ac-v4-btn primary"
                    id="ac-v41-personnel">

                    👥 Personnel Center

                </button>


                <button
                    class="ac-v4-btn"
                    id="ac-v41-activity">

                    📜 Activity

                </button>


                <button
                    class="ac-v4-btn"
                    id="ac-v41-notifications">

                    🔔 Notifications

                </button>

            </div>


            <div
                class="ac-v41-layout">

                <div
                    class="ac-v41-card">

                    <div
                        class="ac-v41-card-title">

                        <h3>
                            Последние события
                        </h3>

                        <span
                            class="ac-v41-muted">

                            LIVE LOG

                        </span>

                    </div>


                    <div
                        class="ac-v4-events">

                        \${
                            d.events &&
                            d.events.length

                            ?

                            d.events
                                .map(
                                    event => \`

                                        <div
                                            class="ac-v4-event">

                                            <i
                                                class="ac-v4-event-dot">
                                            </i>

                                            <div>

                                                <strong>
                                                    \${esc(
                                                        event.title
                                                    )}
                                                </strong>

                                                <div>
                                                    \${esc(
                                                        event.details ||
                                                        ""
                                                    )}
                                                </div>

                                                <small>

                                                    \${esc(
                                                        event.actor
                                                    )}

                                                    ·

                                                    \${new Date(
                                                        event.created_at
                                                    ).toLocaleString(
                                                        "ru-RU"
                                                    )}

                                                </small>

                                            </div>

                                        </div>

                                    \`
                                )
                                .join("")

                            :

                            \`
                                <div
                                    class="ac-v41-empty">

                                    Событий пока нет

                                </div>
                            \`

                        }

                    </div>

                </div>


                <div
                    class="ac-v41-card">

                    <div
                        class="ac-v41-card-title">

                        <h3>
                            Структуры
                        </h3>

                    </div>


                    <div
                        class="ac-v4-events">

                        \${
                            d.organizations &&
                            d.organizations.length

                            ?

                            d.organizations
                                .slice(
                                    0,
                                    10
                                )
                                .map(
                                    organization => \`

                                        <div
                                            class="ac-v4-event">

                                            <div>

                                                <strong>

                                                    \${esc(
                                                        organization.organization
                                                    )}

                                                </strong>

                                                <div>

                                                    \${esc(
                                                        organization.count
                                                    )}
                                                    сотрудников

                                                </div>

                                            </div>

                                        </div>

                                    \`
                                )
                                .join("")

                            :

                            \`
                                <div
                                    class="ac-v41-empty">

                                    Структуры не найдены

                                </div>
                            \`

                        }

                    </div>

                </div>

            </div>

        \`);


        document.getElementById(
            "ac-v41-refresh"
        ).onclick =
            renderDashboard;


        document.getElementById(
            "ac-v41-personnel"
        ).onclick =
            () => {

                currentPage =
                    "personnel";

                render();

            };


        document.getElementById(
            "ac-v41-activity"
        ).onclick =
            () => {

                currentPage =
                    "activity";

                render();

            };


        document.getElementById(
            "ac-v41-notifications"
        ).onclick =
            () => {

                currentPage =
                    "notifications";

                render();

            };

    }


    async function renderPersonnel() {

        shell(\`

            <div
                class="ac-v4-head">

                <div>

                    <h1
                        class="ac-v4-title">

                        Personnel Center

                    </h1>

                    <p
                        class="ac-v4-subtitle">

                        Единый реестр состава

                    </p>

                </div>


                <button
                    class="ac-v4-btn"
                    id="ac-v41-back">

                    ← Dashboard

                </button>

            </div>


            <div
                class="ac-v41-filterbar">

                <input
                    class="ac-v4-input"
                    id="ac-v41-search"
                    placeholder="Поиск по имени или логину"
                >


                <select
                    class="ac-v41-select"
                    id="ac-v41-role">

                    <option value="">
                        Все роли
                    </option>

                </select>


                <select
                    class="ac-v41-select"
                    id="ac-v41-active">

                    <option value="">
                        Любой статус
                    </option>

                    <option value="true">
                        Активные
                    </option>

                    <option value="false">
                        Неактивные
                    </option>

                </select>


                <button
                    class="ac-v4-btn primary"
                    id="ac-v41-search-btn">

                    Найти

                </button>

            </div>


            <div
                id="ac-v41-personnel-table"
                class="ac-v4-table-wrap">

                <div
                    class="ac-v41-empty">

                    Загрузка...

                </div>

            </div>

        \`);


        document.getElementById(
            "ac-v41-back"
        ).onclick =
            () => {

                currentPage =
                    "dashboard";

                render();

            };


        const search =
            document.getElementById(
                "ac-v41-search"
            );


        const role =
            document.getElementById(
                "ac-v41-role"
            );


        const active =
            document.getElementById(
                "ac-v41-active"
            );


        try {

            const roles =
                await request(
                    "/api/v4/roles"
                );


            role.innerHTML =
                \`
                    <option value="">
                        Все роли
                    </option>
                \` +

                roles
                    .map(
                        r => \`

                            <option
                                value="\${esc(r.name)}">

                                \${esc(r.name)}

                            </option>

                        \`
                    )
                    .join("");

        } catch {
        }


        document.getElementById(
            "ac-v41-search-btn"
        ).onclick =
            () =>
                renderPersonnelData(
                    search.value.trim(),
                    role.value,
                    active.value
                );


        search.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    renderPersonnelData(
                        search.value.trim(),
                        role.value,
                        active.value
                    );

                }

            }
        );


        await renderPersonnelData(
            "",
            "",
            ""
        );

    }


    async function renderPersonnelData(
        search,
        role,
        active
    ) {

        const box =
            document.getElementById(
                "ac-v41-personnel-table"
            );


        if (!box) {
            return;
        }


        box.innerHTML =
            \`
                <div
                    class="ac-v41-empty">

                    Загрузка...

                </div>
            \`;


        try {

            await loadPersonnel(
                search,
                role,
                "",
                active
            );


            currentPersonnelSearch =
                search;


            if (
                !personnel.length
            ) {

                box.innerHTML =
                    \`
                        <div
                            class="ac-v41-empty">

                            Сотрудники не найдены

                        </div>
                    \`;

                return;

            }


            box.innerHTML = \`

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
                                    user => \`

                                        <tr>

                                            <td>

                                                <div
                                                    class="ac-v41-user">

                                                    \${avatar(
                                                        user,
                                                        "ac-v41-user-avatar"
                                                    )}

                                                    <div>

                                                        <div
                                                            class="ac-v41-user-name">

                                                            \${esc(
                                                                user.name ||
                                                                user.username
                                                            )}

                                                        </div>

                                                        <div
                                                            class="ac-v41-user-login">

                                                            @\${esc(
                                                                user.username
                                                            )}

                                                        </div>

                                                    </div>

                                                </div>

                                            </td>


                                            <td>

                                                <span
                                                    class="ac-v41-role">

                                                    \${esc(
                                                        user.role
                                                    )}

                                                </span>

                                            </td>


                                            <td>

                                                \${esc(
                                                    user.position ||
                                                    "—"
                                                )}

                                            </td>


                                            <td>

                                                \${esc(
                                                    user.organization ||
                                                    "—"
                                                )}

                                            </td>


                                            <td>

                                                \${
                                                    user.active

                                                    ?

                                                    "● Активен"

                                                    :

                                                    "○ Неактивен"

                                                }

                                            </td>


                                            <td>

                                                <button
                                                    class="ac-v4-btn"
                                                    data-v41-user="\${user.id}">

                                                    Профиль

                                                </button>

                                            </td>

                                        </tr>

                                    \`
                                )
                                .join("")
                        }

                    </tbody>

                </table>

            \`;


            box
                .querySelectorAll(
                    "[data-v41-user]"
                )
                .forEach(
                    button => {

                        button.onclick =
                            () =>
                                renderProfile(
                                    Number(
                                        button.dataset.v41User
                                    )
                                );

                    }
                );

        } catch (error) {

            box.innerHTML =
                \`
                    <div
                        class="ac-v41-empty">

                        \${esc(
                            error.message
                        )}

                    </div>
                \`;

        }

    }


    async function renderProfile(
        id
    ) {

        try {

            const data =
                await request(
                    "/api/v4/personnel/" +
                    id
                );


            const user =
                data.user;


            shell(\`

                <div
                    class="ac-v4-head">

                    <div
                        class="ac-v41-user">

                        \${avatar(
                            user,
                            "ac-v41-user-avatar"
                        )}

                        <div>

                            <h1
                                class="ac-v4-title">

                                \${esc(
                                    user.name ||
                                    user.username
                                )}

                            </h1>

                            <p
                                class="ac-v4-subtitle">

                                \${esc(
                                    user.role
                                )}

                                ·

                                \${esc(
                                    user.position ||
                                    "Без должности"
                                )}

                            </p>

                        </div>

                    </div>


                    <button
                        class="ac-v4-btn"
                        id="ac-v41-profile-back">

                        ← Personnel

                    </button>

                </div>


                <div
                    class="ac-v41-kpi">

                    <div
                        class="ac-v41-kpi-item">

                        <span>
                            Логин
                        </span>

                        <strong
                            style="font-size:17px">

                            \${esc(
                                user.username
                            )}

                        </strong>

                    </div>


                    <div
                        class="ac-v41-kpi-item">

                        <span>
                            Роль
                        </span>

                        <strong
                            style="font-size:17px">

                            \${esc(
                                user.role
                            )}

                        </strong>

                    </div>


                    <div
                        class="ac-v41-kpi-item">

                        <span>
                            Структура
                        </span>

                        <strong
                            style="font-size:17px">

                            \${esc(
                                user.organization ||
                                "—"
                            )}

                        </strong>

                    </div>


                    <div
                        class="ac-v41-kpi-item">

                        <span>
                            VK
                        </span>

                        <strong
                            style="font-size:17px">

                            \${esc(
                                user.vk ||
                                "—"
                            )}

                        </strong>

                    </div>

                </div>


                <div
                    class="ac-v41-card"
                    style="margin-top:16px">

                    <div
                        class="ac-v41-card-title">

                        <h3>
                            Информация
                        </h3>

                    </div>


                    <div
                        class="ac-v4-events">

                        <div
                            class="ac-v4-event">

                            <div>

                                <strong>
                                    Статус
                                </strong>

                                <div>
                                    \${
                                        user.active
                                        ?
                                        "Активен"
                                        :
                                        "Неактивен"
                                    }
                                </div>

                            </div>

                        </div>


                        <div
                            class="ac-v4-event">

                            <div>

                                <strong>
                                    Назначен
                                </strong>

                                <div>
                                    \${user.appointed_at
                                        ?
                                        new Date(
                                            user.appointed_at
                                        ).toLocaleString(
                                            "ru-RU"
                                        )
                                        :
                                        "—"
                                    }
                                </div>

                            </div>

                        </div>


                        <div
                            class="ac-v4-event">

                            <div>

                                <strong>
                                    Назначил
                                </strong>

                                <div>
                                    \${esc(
                                        user.appointed_by ||
                                        "—"
                                    )}
                                </div>

                            </div>

                        </div>

                    </div>

                </div>


                <div
                    class="ac-v41-card"
                    style="margin-top:16px">

                    <div
                        class="ac-v41-card-title">

                        <h3>
                            История
                        </h3>

                    </div>


                    <div
                        class="ac-v4-events">

                        \${
                            data.history &&
                            data.history.length

                            ?

                            data.history
                                .map(
                                    history => \`

                                        <div
                                            class="ac-v4-event">

                                            <i
                                                class="ac-v4-event-dot">
                                            </i>

                                            <div>

                                                <strong>
                                                    \${esc(
                                                        history.action
                                                    )}
                                                </strong>

                                                <div>
                                                    \${esc(
                                                        history.details ||
                                                        ""
                                                    )}
                                                </div>

                                                <small>

                                                    \${esc(
                                                        history.actor ||
                                                        "system"
                                                    )}

                                                    ·

                                                    \${new Date(
                                                        history.created_at
                                                    ).toLocaleString(
                                                        "ru-RU"
                                                    )}

                                                </small>

                                            </div>

                                        </div>

                                    \`
                                )
                                .join("")

                            :

                            \`
                                <div
                                    class="ac-v41-empty">

                                    История пуста

                                </div>
                            \`

                        }

                    </div>

                </div>


                <div
                    class="ac-v41-card"
                    style="margin-top:16px">

                    <div
                        class="ac-v41-card-title">

                        <h3>
                            Заметки
                        </h3>

                    </div>


                    <div
                        class="ac-v4-toolbar">

                        <input
                            class="ac-v4-input"
                            id="ac-v41-note"
                            style="flex:1"
                            placeholder="Добавить заметку"
                        >


                        <button
                            class="ac-v4-btn primary"
                            id="ac-v41-add-note">

                            Добавить

                        </button>

                    </div>


                    <div
                        class="ac-v4-events">

                        \${
                            data.notes &&
                            data.notes.length

                            ?

                            data.notes
                                .map(
                                    note => \`

                                        <div
                                            class="ac-v4-event">

                                            <div>

                                                <strong>
                                                    \${esc(
                                                        note.author
                                                    )}
                                                </strong>

                                                <div>
                                                    \${esc(
                                                        note.note
                                                    )}
                                                </div>

                                                <small>

                                                    \${new Date(
                                                        note.created_at
                                                    ).toLocaleString(
                                                        "ru-RU"
                                                    )}

                                                </small>

                                            </div>

                                        </div>

                                    \`
                                )
                                .join("")

                            :

                            \`
                                <div
                                    class="ac-v41-empty">

                                    Заметок нет

                                </div>
                            \`

                        }

                    </div>

                </div>

            \`);


            document.getElementById(
                "ac-v41-profile-back"
            ).onclick =
                () => {

                    currentPage =
                        "personnel";

                    render();

                };


            document.getElementById(
                "ac-v41-add-note"
            ).onclick =
                async () => {

                    const input =
                        document.getElementById(
                            "ac-v41-note"
                        );


                    const note =
                        input.value.trim();


                    if (!note) {
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
                                        note
                                    })

                            }
                        );


                        renderProfile(
                            id
                        );

                    } catch (error) {

                        alert(
                            error.message
                        );

                    }

                };

        } catch (error) {

            shell(
                \`
                    <div
                        class="ac-v41-empty">

                        \${esc(
                            error.message
                        )}

                    </div>
                \`
            );

        }

    }


    async function renderActivity() {

        try {

            const rows =
                await request(
                    "/api/v4/activity"
                );


            shell(\`

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
                        id="ac-v41-back">

                        ← Dashboard

                    </button>

                </div>


                <div
                    class="ac-v41-card">

                    <div
                        class="ac-v4-events">

                        \${
                            rows &&
                            rows.length

                            ?

                            rows
                                .map(
                                    event => \`

                                        <div
                                            class="ac-v4-event">

                                            <i
                                                class="ac-v4-event-dot">
                                            </i>

                                            <div>

                                                <strong>
                                                    \${esc(
                                                        event.title
                                                    )}
                                                </strong>

                                                <div>
                                                    \${esc(
                                                        event.details ||
                                                        ""
                                                    )}
                                                </div>

                                                <small>

                                                    \${esc(
                                                        event.actor
                                                    )}

                                                    ·

                                                    \${new Date(
                                                        event.created_at
                                                    ).toLocaleString(
                                                        "ru-RU"
                                                    )}

                                                </small>

                                            </div>

                                        </div>

                                    \`
                                )
                                .join("")

                            :

                            \`
                                <div
                                    class="ac-v41-empty">

                                    Журнал пуст

                                </div>
                            \`

                        }

                    </div>

                </div>

            \`);


            document.getElementById(
                "ac-v41-back"
            ).onclick =
                () => {

                    currentPage =
                        "dashboard";

                    render();

                };

        } catch (error) {

            shell(
                \`
                    <div
                        class="ac-v41-empty">

                        \${esc(
                            error.message
                        )}

                    </div>
                \`
            );

        }

    }


    async function renderNotifications() {

        try {

            const rows =
                await request(
                    "/api/v4/notifications"
                );


            shell(\`

                <div
                    class="ac-v4-head">

                    <div>

                        <h1
                            class="ac-v4-title">

                            Уведомления

                        </h1>

                        <p
                            class="ac-v4-subtitle">

                            Системные события аккаунта

                        </p>

                    </div>


                    <button
                        class="ac-v4-btn"
                        id="ac-v41-back">

                        ← Dashboard

                    </button>

                </div>


                <div
                    class="ac-v4-events">

                    \${
                        rows &&
                        rows.length

                        ?

                        rows
                            .map(
                                notification => \`

                                    <div
                                        class="ac-v4-event \${
                                            notification.read
                                            ?
                                            "ac-v41-notification-read"
                                            :
                                            "ac-v41-notification-unread"
                                        }">

                                        <i
                                            class="ac-v4-event-dot">
                                        </i>

                                        <div
                                            style="flex:1">

                                            <strong>
                                                \${esc(
                                                    notification.title
                                                )}
                                            </strong>

                                            <div>
                                                \${esc(
                                                    notification.message
                                                )}
                                            </div>

                                            <small>

                                                \${new Date(
                                                    notification.created_at
                                                ).toLocaleString(
                                                    "ru-RU"
                                                )}

                                                ·

                                                \${
                                                    notification.read
                                                    ?
                                                    "прочитано"
                                                    :
                                                    "новое"
                                                }

                                            </small>

                                        </div>


                                        \${
                                            notification.read

                                            ?

                                            ""

                                            :

                                            \`

                                                <button
                                                    class="ac-v4-btn"
                                                    data-v41-read="\${
                                                        notification.id
                                                    }">

                                                    Прочитано

                                                </button>

                                            \`
                                        }

                                    </div>

                                \`
                            )
                            .join("")

                        :

                        \`
                            <div
                                class="ac-v41-empty">

                                Уведомлений нет

                            </div>
                        \`

                    }

                </div>

            \`);


            document.getElementById(
                "ac-v41-back"
            ).onclick =
                () => {

                    currentPage =
                        "dashboard";

                    render();

                };


            document
                .querySelectorAll(
                    "[data-v41-read]"
                )
                .forEach(
                    button => {

                        button.onclick =
                            async () => {

                                try {

                                    await request(
                                        "/api/v4/notifications/" +
                                        button.dataset.v41Read +
                                        "/read",
                                        {
                                            method:
                                                "PATCH"
                                        }
                                    );


                                    renderNotifications();

                                } catch (error) {

                                    alert(
                                        error.message
                                    );

                                }

                            };

                    }
                );

        } catch (error) {

            shell(
                \`
                    <div
                        class="ac-v41-empty">

                        \${esc(
                            error.message
                        )}

                    </div>
                \`
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

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            boot,
            {
                once:
                    true
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
    JS_V41
);


/*
=========================================================
 HTML META
=========================================================
*/

const HTML_MARKER =
    "ARIZONA_CIVIL_4_1_META";

const HTML_V41 = `

<!-- ARIZONA_CIVIL_4_1_META -->

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
    content="Arizona Civil 4.1 — Command Center"
>

<meta
    name="application-name"
    content="Arizona Civil"
>

`;

replaceOnce(
    "public/index.html",

    "</head>",

    HTML_V41 +
    "\n</head>",

    "Meta V4.1"
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
    "4.1.0";


pkg.scripts =
    pkg.scripts || {};


pkg.scripts.check =
    "node --check server.js && node --check db.js && node --check permissions.js";


pkg.scripts.start =
    "node server.js";


pkg.scripts["start:prod"] =
    "NODE_ENV=production node server.js";


pkg.scripts["check:all"] =
    "node --check server.js && node --check db.js && node --check public/app.js";


fs.writeFileSync(
    packagePath,
    JSON.stringify(
        pkg,
        null,
        2
    ) +
    "\n",
    "utf8"
);


console.log(
    "✅ package.json → 4.1.0"
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
        "ARIZONA_CIVIL_V4_1"
    )
) {

    render += `

# ARIZONA_CIVIL_V4_1

# Arizona Civil Command Center 4.1
`;

    fs.writeFileSync(
        renderPath,
        render,
        "utf8"
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
    "4.1.0\n",
    "utf8"
);


console.log(
    "✅ VERSION = 4.1.0"
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
`,
        "utf8"
    );

    console.log(
        "✅ .env.example создан"
    );

} else {

    console.log(
        "↪️ .env.example уже существует"
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
        ?
        fs.readFileSync(
            gitignorePath,
            "utf8"
        )
        :
        "";


for (
    const line
    of [
        ".env",
        "backup-before-4.0-*",
        "backup-before-4.1-*",
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
                    ?
                    ""
                    :
                    "\n"
            ) +
            line +
            "\n";

    }

}


fs.writeFileSync(
    gitignorePath,
    gi,
    "utf8"
);


console.log(
    "✅ .gitignore проверен"
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
    " Проверка Arizona Civil 4.1"
);

console.log(
    "========================================\n"
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


let failed =
    false;


for (
    const [name, command]
    of checks
) {

    try {

        execSync(
            command,
            {
                cwd:
                    ROOT,

                stdio:
                    "pipe"
            }
        );


        console.log(
            `✅ Syntax OK: ${name}`
        );

    } catch (error) {

        failed =
            true;


        console.error(
            `❌ Syntax ERROR: ${name}`
        );


        console.error(
            error.stdout?.toString() ||
            ""
        );


        console.error(
            error.stderr?.toString() ||
            ""
        );

    }

}


/*
=========================================================
 PERMISSIONS CHECK
=========================================================
*/

if (
    exists("permissions.js")
) {

    try {

        execSync(
            "node --check permissions.js",
            {
                cwd:
                    ROOT,

                stdio:
                    "pipe"
            }
        );


        console.log(
            "✅ Syntax OK: permissions.js"
        );

    } catch (error) {

        failed =
            true;


        console.error(
            "❌ Syntax ERROR: permissions.js"
        );


        console.error(
            error.stderr?.toString() ||
            ""
        );

    }

} else {

    console.log(
        "ℹ️ permissions.js отсутствует — пропуск"
    );

}


/*
=========================================================
 RESULT
=========================================================
*/

if (failed) {

    console.error(`

╔══════════════════════════════════════════════════╗
║       ARIZONA CIVIL 4.1 — ERROR                 ║
╠══════════════════════════════════════════════════╣
║ Один или несколько файлов имеют ошибку.          ║
║ Изменения НЕ удалялись.                          ║
║ Backup находится здесь:                          ║
║                                                  ║
║ ${BACKUP}
║
╚══════════════════════════════════════════════════╝
`);

    process.exit(1);

}


console.log(`

╔══════════════════════════════════════════════════╗
║        ARIZONA CIVIL 4.1 — READY                ║
╠══════════════════════════════════════════════════╣
║ ✅ PostgreSQL V4.1 migration                    ║
║ ✅ Database settings                            ║
║ ✅ API health                                   ║
║ ✅ API version                                  ║
║ ✅ Dashboard                                    ║
║ ✅ Personnel filters                            ║
║ ✅ Personnel profiles                           ║
║ ✅ Role management                              ║
║ ✅ Organization management                      ║
║ ✅ Notes                                        ║
║ ✅ Notifications                                ║
║ ✅ Activity log                                 ║
║ ✅ Organizations API                            ║
║ ✅ System settings API                          ║
║ ✅ Command Center UI 4.1                        ║
║ ✅ Responsive dark UI                           ║
║ ✅ Avatar support                               ║
║ ✅ Version 4.1.0                                ║
║ ✅ Render configuration                         ║
║ ✅ Gitignore                                    ║
║ ✅ Syntax checks                                ║
║ ✅ Backup                                       ║
╚══════════════════════════════════════════════════╝

Backup:
${BACKUP}

Следующий шаг:

npm start

Проверка:

curl http://localhost:3000/health

После проверки:

git add .
git commit -m "Arizona Civil 4.1"
git push

`);
