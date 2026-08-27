const fs = require("fs");

const serverFile = "server.js";
const appFile = "public/app.js";

function backup(file) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = `${file}.backup-vk-avatar-${stamp}`;
    fs.copyFileSync(file, backupFile);
    console.log(`✅ Backup: ${backupFile}`);
}

backup(serverFile);
backup(appFile);

let server = fs.readFileSync(serverFile, "utf8");
let app = fs.readFileSync(appFile, "utf8");

/*
==================================================
SERVER — VK PROFILE HELPER
==================================================
*/

if (!server.includes("async function getVkProfile(")) {

    const marker = "/*\n=========================================\n AUTH";

    if (!server.includes(marker)) {
        throw new Error("Не найдено место для вставки VK helper в server.js");
    }

    const helper = `
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
                : \`https://\${input}\`
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
            \`https://api.vk.com/method/users.get?\${params}\`
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

`;

    server = server.replace(
        marker,
        helper + "\n" + marker
    );

    console.log("✅ getVkProfile() добавлен");

} else {

    console.log("ℹ️ getVkProfile() уже существует");
}


/*
==================================================
SERVER — POST LEADERS
==================================================
*/

const oldInsert = `
            const id = Date.now();

            const result = await query(
                \`
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
                \`,
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
`;

const newInsert = `
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
                    ? \`✅ VK avatar найден: \${structure} → \${vkProfile.screen_name}\`
                    : \`ℹ️ VK avatar не найден: \${structure}\`
            );

            const result = await query(
                \`
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
                \`,
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
`;

if (server.includes(oldInsert)) {

    server = server.replace(
        oldInsert,
        newInsert
    );

    console.log(
        "✅ POST /api/leaders теперь получает VK avatar"
    );

} else if (
    server.includes("const vkProfile =") &&
    server.includes("avatarUrl")
) {

    console.log(
        "ℹ️ POST /api/leaders уже поддерживает avatar_url"
    );

} else {

    throw new Error(
        "Не найден текущий INSERT лидера в server.js"
    );
}


/*
==================================================
APP.JS — LEADER AVATAR
==================================================
*/

const oldLeaderName = `
    const leaderName =
        leader?.leader || "Не назначен";
`;

const newLeaderName = `
    const leaderName =
        leader?.leader || "Не назначен";

    const leaderAvatar =
        leader?.avatar_url || "";

    const leaderAvatarHTML =
        leaderAvatar
            ? \`
                <img
                    src="\${escapeHTML(leaderAvatar)}"
                    alt="Аватар \${escapeHTML(leaderName)}"
                    class="organization-leader-avatar"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    onerror="this.style.display='none';"
                >
              \`
            : \`
                <div class="organization-leader-avatar organization-leader-avatar-placeholder">
                    \${escapeHTML(
                        leaderName
                            .trim()
                            .charAt(0)
                            .toUpperCase() || "?"
                    )}
                </div>
              \`;
`;

if (app.includes(oldLeaderName) && !app.includes("const leaderAvatar =")) {

    app = app.replace(
        oldLeaderName,
        newLeaderName
    );

    console.log(
        "✅ Аватар лидера добавлен в organizationCard()"
    );

} else if (app.includes("const leaderAvatar =")) {

    console.log(
        "ℹ️ Аватар лидера уже добавлен"
    );

} else {

    throw new Error(
        "Не найден leaderName в organizationCard()"
    );
}


/*
==================================================
APP.JS — INSERT AVATAR HTML
==================================================
*/

const leaderNameHtml = `
                    <strong>
                        \${escapeHTML(leaderName)}
                    </strong>
`;

const leaderNameHtmlWithAvatar = `
                    <div class="organization-leader-row">

                        \${leaderAvatarHTML}

                        <strong>
                            \${escapeHTML(leaderName)}
                        </strong>

                    </div>
`;

if (
    app.includes(leaderNameHtml) &&
    !app.includes("organization-leader-row")
) {

    app = app.replace(
        leaderNameHtml,
        leaderNameHtmlWithAvatar
    );

    console.log(
        "✅ HTML аватара лидера добавлен"
    );

} else if (app.includes("organization-leader-row")) {

    console.log(
        "ℹ️ HTML аватара лидера уже существует"
    );

} else {

    console.warn(
        "⚠️ Стандартный блок имени лидера не найден — попробуем CSS отдельно"
    );
}


/*
==================================================
APP.JS — RETURN AVATAR FROM LEADER ROW
==================================================
*/

const leaderRowVk = `
            <td>
                \${vkLink(l.vk)}
            </td>
`;

const leaderRowVkNew = `
            <td>
                \${vkLink(l.vk)}
            </td>
`;

if (app.includes(leaderRowVk)) {

    app = app.replace(
        leaderRowVk,
        leaderRowVkNew
    );

    console.log(
        "✅ Таблица лидеров сохранена без изменений"
    );
}


/*
==================================================
CSS — AVATAR
==================================================
*/

const cssFile = "public/style.css";
let css = fs.readFileSync(cssFile, "utf8");

if (!css.includes(".organization-leader-avatar")) {

    css += `

/* =========================================
   VK LEADER AVATAR
   ========================================= */

.organization-leader-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.organization-leader-avatar {
    width: 42px;
    height: 42px;
    min-width: 42px;
    border-radius: 50%;
    object-fit: cover;
    display: block;
    border: 2px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
}

.organization-leader-avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 17px;
    color: #fff;
}

`;

    fs.writeFileSync(cssFile, css);

    console.log(
        "✅ CSS аватара добавлен"
    );

} else {

    console.log(
        "ℹ️ CSS аватара уже существует"
    );
}


/*
==================================================
WRITE
==================================================
*/

fs.writeFileSync(serverFile, server);
fs.writeFileSync(appFile, app);

console.log("");
console.log("========================================");
console.log(" VK LEADER AVATAR UPDATE");
console.log("========================================");
console.log("✅ server.js обновлён");
console.log("✅ public/app.js обновлён");
console.log("✅ public/style.css обновлён");
console.log("========================================");
