const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SERVER = path.join(ROOT, "server.js");
const APP = path.join(ROOT, "public/app.js");
const CSS = path.join(ROOT, "public/style.css");

const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);

function backup(file, name) {
    const target = `${file}.backup-${name}-${stamp}`;
    fs.copyFileSync(file, target);
    console.log(`✅ Backup: ${path.basename(target)}`);
}

backup(SERVER, "v201");
backup(APP, "v201");
backup(CSS, "v201");

let server = fs.readFileSync(SERVER, "utf8");
let app = fs.readFileSync(APP, "utf8");
let css = fs.readFileSync(CSS, "utf8");

/* =========================================================
   ROLES
========================================================= */

if (!server.includes('ASSISTANT: "Помощник следящего"')) {
    server = server.replace(
        /FOLLOWER:\s*"Следящий"/,
        `ASSISTANT: "Помощник следящего",
    FOLLOWER: "Следящий"`
    );
}

if (!server.includes("[ROLES.ASSISTANT]: 5")) {
    server = server.replace(
        /(\[ROLES\.USER\]:\s*0,)/,
        `$1
    [ROLES.ASSISTANT]: 5,`
    );
}

server = server.replace(
    /\[ROLES\.FOLLOWER\]:\s*10/,
    "[ROLES.FOLLOWER]: 10"
);

/* =========================================================
   ROLE PERMISSIONS
========================================================= */

if (!server.includes("ARIZONA_CIVIL_201_PERMISSIONS")) {
    const marker = "function createDatabase() {";

    const permissions = `
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

`;

    server = server.replace(marker, permissions + marker);
}

/* =========================================================
   DATABASE MIGRATION
========================================================= */

if (!server.includes("ARIZONA_CIVIL_201_MIGRATION")) {
    const marker = "async function startServer() {";

    const migration = `
/* =========================================================
   ARIZONA_CIVIL_201_MIGRATION
========================================================= */

async function initArizonaCivil201() {
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

    console.log("✅ Arizona Civil 2.0.1: миграция БД завершена");
}

`;

    server = server.replace(marker, migration + marker);
}

/* =========================================================
   START SERVER
========================================================= */

if (!server.includes("await initArizonaCivil201();")) {
    server = server.replace(
        /await initDatabase\(\);/,
        `await initDatabase();
        await initArizonaCivil201();`
    );
}

/* =========================================================
   ASSISTANT API
========================================================= */

if (!server.includes("ARIZONA_CIVIL_201_ASSISTANT_API")) {
    const marker = 'app.post(\n    "/api/supervisors",';

    const api = `
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

            const result = await query(\`
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
            \`, [
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
                \`
                    SELECT id, name
                    FROM supervisors
                    WHERE id = $1
                    AND role = $2
                \`,
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
                \`
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
                \`,
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
                \`
                    SELECT id
                    FROM supervisors
                    WHERE id = $1
                    AND role = $2
                \`,
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
                \`
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
                \`,
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
                \`
                    DELETE FROM supervisors
                    WHERE id = $1
                    AND role = $2

                    RETURNING
                        id,
                        name
                \`,
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

`;

    server = server.replace(
        marker,
        api + marker
    );
}

/* =========================================================
   SUPERVISOR GET — V2 FIELDS
========================================================= */

server = server.replace(
    /SELECT\s+id,\s*name,\s*role,\s*position,\s*created_at,\s*updated_at\s+FROM supervisors/gi,
`SELECT
                    id,
                    name,
                    role,
                    position,
                    supervisor_id,
                    vk,
                    avatar_url,
                    created_at,
                    updated_at
                FROM supervisors`
);

fs.writeFileSync(SERVER, server);

/* =========================================================
   FRONTEND V2
========================================================= */

if (!app.includes("ARIZONA_CIVIL_201_FRONTEND")) {

app += `

/* =========================================================
   ARIZONA_CIVIL_201_FRONTEND
========================================================= */

const CIVIL_ASSISTANT_ROLE =
    "Помощник следящего";

const CIVIL_ASSISTANT_POSITION =
    "Помощник следящего за гражданской структурой";


async function loadSupervisorsV201() {

    const container =
        $("supervisor-list");

    if (!container) return;

    try {

        const list =
            await api("/api/supervisors");

        const supervisors =
            list.filter(
                x =>
                    x.role !==
                    CIVIL_ASSISTANT_ROLE
            );

        const assistants =
            list.filter(
                x =>
                    x.role ===
                    CIVIL_ASSISTANT_ROLE
            );

        const map =
            new Map();

        assistants.forEach(
            assistant => {

                const owner =
                    String(
                        assistant.supervisor_id
                    );

                if (!map.has(owner)) {
                    map.set(owner, []);
                }

                map.get(owner).push(
                    assistant
                );
            }
        );

        container.innerHTML = \`
            <div class="supervisors-v201">

                \${supervisors
                    .map(
                        supervisor =>
                            supervisorCardV201(
                                supervisor,
                                map.get(
                                    String(supervisor.id)
                                ) || []
                            )
                    )
                    .join("")}

            </div>
        \`;

    } catch (error) {

        container.innerHTML = \`
            <div class="supervisors-empty">

                <h3>
                    Не удалось загрузить следящих
                </h3>

                <p>
                    \${escapeHTML(
                        error.message || ""
                    )}
                </p>

            </div>
        \`;
    }
}


function supervisorCardV201(
    supervisor,
    assistants
) {

    const avatar =
        supervisor.avatar_url
            ? \`
                <img
                    src="\${escapeHTML(
                        supervisor.avatar_url
                    )}">
              \`
            : escapeHTML(
                (
                    supervisor.name ||
                    "?"
                )
                .charAt(0)
                .toUpperCase()
            );

    return \`
        <article class="supervisor-v201-card">

            <div class="supervisor-v201-header">

                <div class="supervisor-v201-avatar">
                    \${avatar}
                </div>

                <div class="supervisor-v201-title">

                    <small>
                        СЛЕДЯЩИЙ
                    </small>

                    <h3>
                        \${escapeHTML(
                            supervisor.name ||
                            "—"
                        )}
                    </h3>

                    <span>
                        \${escapeHTML(
                            supervisor.position ||
                            "Следящий"
                        )}
                    </span>

                </div>

                <div class="supervisor-v201-status">
                    ACTIVE
                </div>

            </div>


            <div class="supervisor-v201-info">

                <div>
                    <small>VK</small>
                    <span>
                        \${escapeHTML(
                            supervisor.vk ||
                            "Не указан"
                        )}
                    </span>
                </div>

                <div>
                    <small>ПОМОЩНИКОВ</small>
                    <span>
                        \${assistants.length}
                    </span>
                </div>

            </div>


            <section class="supervisor-v201-assistants">

                <div class="supervisor-v201-section-title">
                    ПОМОЩНИКИ
                </div>

                \${
                    assistants.length
                        ? assistants
                            .map(
                                assistant =>
                                    assistantCardV201(
                                        assistant
                                    )
                            )
                            .join("")
                        : \`
                            <div class="supervisor-v201-empty">
                                Помощников нет
                            </div>
                          \`
                }

            </section>


            <div class="supervisor-v201-actions">

                \${
                    Number(
                        typeof level === "function"
                            ? level()
                            : 0
                    ) >= 10
                        ? \`
                            <button
                                onclick="openAssistantV201(
                                    \${Number(supervisor.id)}
                                )">
                                ＋ Помощник
                            </button>
                          \`
                        : ""
                }

            </div>

        </article>
    \`;
}


function assistantCardV201(
    assistant
) {

    const avatar =
        assistant.avatar_url
            ? \`
                <img
                    src="\${escapeHTML(
                        assistant.avatar_url
                    )}">
              \`
            : escapeHTML(
                (
                    assistant.name ||
                    "?"
                )
                .charAt(0)
                .toUpperCase()
            );

    return \`
        <div class="supervisor-v201-assistant">

            <div class="supervisor-v201-assistant-avatar">
                \${avatar}
            </div>

            <div class="supervisor-v201-assistant-data">

                <strong>
                    \${escapeHTML(
                        assistant.name
                    )}
                </strong>

                <span>
                    \${CIVIL_ASSISTANT_POSITION}
                </span>

                <small>
                    VK:
                    \${escapeHTML(
                        assistant.vk ||
                        "—"
                    )}
                </small>

            </div>

            \${
                Number(
                    typeof level === "function"
                        ? level()
                        : 0
                ) >= 10
                    ? \`
                        <button
                            onclick="editAssistantV201(
                                \${Number(assistant.id)}
                            )">
                            ✎
                        </button>

                        <button
                            onclick="deleteAssistantV201(
                                \${Number(assistant.id)}
                            )">
                            🗑
                        </button>
                      \`
                    : ""
            }

        </div>
    \`;
}


window.openAssistantV201 =
async function(supervisorId) {

    const list =
        await api("/api/supervisors");

    const supervisor =
        list.find(
            x =>
                Number(x.id) ===
                Number(supervisorId)
        );

    if (!supervisor) {
        alert("Следящий не найден");
        return;
    }

    $("modal-content").innerHTML = \`

        <div class="neon-modal-header">

            <span>
                ARIZONA CIVIL 2.0
            </span>

            <h2>
                Новый помощник
            </h2>

            <p>
                Должность фиксирована
            </p>

        </div>


        <form id="assistant-v201-form">

            <div class="modern-form-group">

                <label>
                    Имя / ник
                </label>

                <input
                    id="assistant-v201-name"
                    placeholder="Nick_Name"
                    required>

            </div>


            <div class="modern-form-group">

                <label>
                    VK
                </label>

                <input
                    id="assistant-v201-vk"
                    placeholder="https://vk.com/id...">

            </div>


            <div class="modern-form-group">

                <label>
                    Avatar URL
                </label>

                <input
                    id="assistant-v201-avatar"
                    placeholder="https://...">

            </div>


            <div class="modern-form-group">

                <label>
                    Следящий
                </label>

                <input
                    value="\${escapeHTML(
                        supervisor.name
                    )}"
                    disabled>

            </div>


            <button
                class="gold-btn"
                type="submit">

                Создать помощника

            </button>

        </form>
    \`;

    $("modal").classList.add("show");


    $("assistant-v201-form")
        .addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                try {

                    await api(
                        "/api/supervisors/assistants",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({

                                    name:
                                        $(
                                            "assistant-v201-name"
                                        )
                                        .value
                                        .trim(),

                                    vk:
                                        $(
                                            "assistant-v201-vk"
                                        )
                                        .value
                                        .trim(),

                                    avatar_url:
                                        $(
                                            "assistant-v201-avatar"
                                        )
                                        .value
                                        .trim(),

                                    supervisor_id:
                                        Number(
                                            supervisor.id
                                        )
                                })
                        }
                    );

                    closeModal();

                    await loadSupervisorsV201();

                } catch (error) {

                    alert(
                        error.message ||
                        "Ошибка создания"
                    );
                }
            }
        );
};


window.editAssistantV201 =
async function(id) {

    const list =
        await api(
            "/api/supervisors/assistants"
        );

    const assistant =
        list.find(
            x =>
                Number(x.id) ===
                Number(id)
        );

    if (!assistant) {
        alert("Помощник не найден");
        return;
    }

    const supervisors =
        (await api(
            "/api/supervisors"
        ))
        .filter(
            x =>
                x.role ===
                "Следящий"
        );

    $("modal-content").innerHTML = \`

        <div class="neon-modal-header">

            <span>
                ARIZONA CIVIL 2.0
            </span>

            <h2>
                Изменение помощника
            </h2>

        </div>


        <form id="assistant-v201-form">

            <div class="modern-form-group">

                <label>
                    Имя / ник
                </label>

                <input
                    id="assistant-v201-name"
                    value="\${escapeHTML(
                        assistant.name
                    )}"
                    required>

            </div>


            <div class="modern-form-group">

                <label>
                    VK
                </label>

                <input
                    id="assistant-v201-vk"
                    value="\${escapeHTML(
                        assistant.vk || ""
                    )}">

            </div>


            <div class="modern-form-group">

                <label>
                    Avatar URL
                </label>

                <input
                    id="assistant-v201-avatar"
                    value="\${escapeHTML(
                        assistant.avatar_url || ""
                    )}">

            </div>


            <div class="modern-form-group">

                <label>
                    Следящий
                </label>

                <select
                    id="assistant-v201-owner">

                    \${supervisors
                        .map(
                            supervisor =>
                                \`
                                    <option
                                        value="\${Number(
                                            supervisor.id
                                        )}"
                                        \${
                                            Number(
                                                supervisor.id
                                            ) ===
                                            Number(
                                                assistant.supervisor_id
                                            )
                                                ? "selected"
                                                : ""
                                        }>

                                        \${escapeHTML(
                                            supervisor.name
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

                Сохранить

            </button>

        </form>
    \`;

    $("modal").classList.add("show");


    $("assistant-v201-form")
        .addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                try {

                    await api(
                        "/api/supervisors/assistants/" +
                        Number(id),
                        {
                            method: "PATCH",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({

                                    name:
                                        $(
                                            "assistant-v201-name"
                                        )
                                        .value
                                        .trim(),

                                    vk:
                                        $(
                                            "assistant-v201-vk"
                                        )
                                        .value
                                        .trim(),

                                    avatar_url:
                                        $(
                                            "assistant-v201-avatar"
                                        )
                                        .value
                                        .trim(),

                                    supervisor_id:
                                        Number(
                                            $(
                                                "assistant-v201-owner"
                                            )
                                            .value
                                        )
                                })
                        }
                    );

                    closeModal();

                    await loadSupervisorsV201();

                } catch (error) {

                    alert(
                        error.message ||
                        "Ошибка сохранения"
                    );
                }
            }
        );
};


window.deleteAssistantV201 =
async function(id) {

    if (
        !confirm(
            "Удалить помощника?"
        )
    ) {
        return;
    }

    try {

        await api(
            "/api/supervisors/assistants/" +
            Number(id),
            {
                method: "DELETE"
            }
        );

        await loadSupervisorsV201();

    } catch (error) {

        alert(
            error.message ||
            "Ошибка удаления"
        );
    }
};


/*
    Подменяем старую функцию последней
    версией V2.0.1.
*/

window.loadSupervisors =
    loadSupervisorsV201;

try {
    loadSupervisors =
        loadSupervisorsV201;
} catch (_) {}

`;

fs.writeFileSync(APP, app);
}

/* =========================================================
   CSS
========================================================= */

if (!css.includes("ARIZONA_CIVIL_201_CSS")) {

css += `

/* =========================================================
   ARIZONA_CIVIL_201_CSS
========================================================= */

.supervisors-v201 {

    display: grid;

    grid-template-columns:
        repeat(
            auto-fit,
            minmax(340px, 1fr)
        );

    gap: 20px;

}


.supervisor-v201-card {

    position: relative;

    overflow: hidden;

    padding: 22px;

    border-radius: 24px;

    border:
        1px solid
        rgba(255,255,255,.10);

    background:
        linear-gradient(
            145deg,
            rgba(24,25,34,.98),
            rgba(10,11,17,.98)
        );

    box-shadow:
        0 18px 50px
        rgba(0,0,0,.28);

    transition:
        transform .2s ease,
        border-color .2s ease;

}


.supervisor-v201-card:hover {

    transform:
        translateY(-3px);

    border-color:
        rgba(255,210,90,.35);

}


.supervisor-v201-header {

    display: flex;

    align-items: center;

    gap: 14px;

}


.supervisor-v201-avatar {

    width: 62px;
    height: 62px;

    flex:
        0 0 62px;

    display: grid;

    place-items: center;

    overflow: hidden;

    border-radius: 18px;

    background:
        rgba(255,255,255,.08);

    font-size: 25px;

    font-weight: 800;

}


.supervisor-v201-avatar img {

    width: 100%;
    height: 100%;

    object-fit: cover;

}


.supervisor-v201-title {

    min-width: 0;

}


.supervisor-v201-title small {

    display: block;

    font-size: 9px;

    letter-spacing:
        1.6px;

    opacity: .45;

}


.supervisor-v201-title h3 {

    margin:
        3px 0;

    font-size: 20px;

}


.supervisor-v201-title span {

    font-size: 12px;

    opacity: .65;

}


.supervisor-v201-status {

    margin-left: auto;

    padding:
        6px 9px;

    border-radius: 999px;

    font-size: 9px;

    letter-spacing:
        1px;

    background:
        rgba(50,220,130,.10);

}


.supervisor-v201-info {

    display: grid;

    grid-template-columns:
        1fr 1fr;

    gap: 10px;

    margin:
        20px 0;

}


.supervisor-v201-info > div {

    padding:
        12px;

    border-radius:
        14px;

    background:
        rgba(255,255,255,.035);

}


.supervisor-v201-info small {

    display: block;

    font-size: 9px;

    opacity: .45;

}


.supervisor-v201-info span {

    display: block;

    margin-top:
        5px;

    font-size: 12px;

}


.supervisor-v201-assistants {

    padding-top:
        15px;

    border-top:
        1px solid
        rgba(255,255,255,.08);

}


.supervisor-v201-section-title {

    margin-bottom:
        10px;

    font-size: 9px;

    letter-spacing:
        1.5px;

    opacity: .45;

}


.supervisor-v201-assistant {

    display: flex;

    align-items: center;

    gap: 10px;

    padding:
        10px;

    margin-top:
        7px;

    border-radius:
        14px;

    background:
        rgba(255,255,255,.035);

}


.supervisor-v201-assistant-avatar {

    width: 38px;
    height: 38px;

    flex:
        0 0 38px;

    display: grid;

    place-items: center;

    overflow: hidden;

    border-radius:
        12px;

    background:
        rgba(255,255,255,.08);

    font-weight:
        700;

}


.supervisor-v201-assistant-avatar img {

    width: 100%;
    height: 100%;

    object-fit: cover;

}


.supervisor-v201-assistant-data {

    flex: 1;

    min-width: 0;

}


.supervisor-v201-assistant-data strong {

    display: block;

    font-size: 13px;

}


.supervisor-v201-assistant-data span {

    display: block;

    margin-top:
        2px;

    font-size: 10px;

    opacity: .55;

}


.supervisor-v201-assistant-data small {

    display: block;

    margin-top:
        3px;

    font-size: 9px;

    opacity: .4;

}


.supervisor-v201-assistant button {

    width: 32px;
    height: 32px;

    border: 0;

    border-radius:
        10px;

    background:
        rgba(255,255,255,.06);

    cursor: pointer;

}


.supervisor-v201-empty {

    padding:
        12px;

    font-size: 12px;

    opacity: .45;

}


.supervisor-v201-actions {

    display: flex;

    gap: 8px;

    margin-top:
        16px;

}


.supervisor-v201-actions button {

    flex: 1;

    padding:
        10px;

    border:
        1px solid
        rgba(255,255,255,.10);

    border-radius:
        12px;

    background:
        rgba(255,255,255,.05);

    cursor: pointer;

}


@media (max-width: 600px) {

    .supervisors-v201 {

        grid-template-columns:
            1fr;

    }

    .supervisor-v201-info {

        grid-template-columns:
            1fr;

    }

}

`;

fs.writeFileSync(CSS, css);
}

console.log("");
console.log("========================================");
console.log("✅ ARIZONA CIVIL 2.0.1");
console.log("========================================");
console.log("✅ Помощник следящего — уровень 5");
console.log("✅ Следящий — уровень 10");
console.log("✅ ЗГС гражданских — уровень 20");
console.log("✅ ГС гражданских — уровень 30");
console.log("✅ ЗГС ГОС — уровень 40");
console.log("✅ ГС ГОС — уровень 50");
console.log("✅ Разработчик — уровень 100");
console.log("");
console.log("Помощник:");
console.log("→ Помощник следящего за гражданской структурой");
console.log("");
console.log("Старые должности сохранены.");
console.log("Старые данные сохранены.");
console.log("VK + avatar_url сохранены.");
console.log("Привязка помощника к следящему добавлена.");
console.log("========================================");
