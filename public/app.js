const organizations = [
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

let leaders = [];
let penalties = [];
let deputiesData = [];
let supervisorsData = [];
let currentUser = null;

const $ = id => document.getElementById(id);

const ROLE_LEVEL = {
    "Следящий": 10,
    "ЗГС гражданских": 20,
    "ГС гражданских": 30,
    "ЗГС ГОС": 40,
    "ГС ГОС": 50,
    "Разработчик": 100
};

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function api(url, options = {}) {

    const response = await fetch(url, {
        credentials: "same-origin",
        ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Ошибка сервера");
    }

    return data;
}


/* DATABASE DATA LOADER */

async function loadData() {

    console.log("🔄 Загрузка данных PostgreSQL...");

    try {

        const leadersResult =
            await api("/api/leaders");

        console.log(
            "👑 /api/leaders:",
            leadersResult
        );

        leaders =
            Array.isArray(leadersResult)
                ? leadersResult
                : [];

    } catch (error) {

        console.error(
            "❌ Ошибка загрузки лидеров:",
            error
        );

        leaders = [];
    }

    try {

        const deputiesResult =
            await api("/api/deputies");

        deputiesData =
            Array.isArray(deputiesResult)
                ? deputiesResult
                : [];

    } catch (error) {

        console.error(
            "❌ Ошибка загрузки заместителей:",
            error
        );

        deputiesData = [];
    }

    try {

        const supervisorsResult =
            await api("/api/supervisors");

        supervisorsData =
            Array.isArray(supervisorsResult)
                ? supervisorsResult
                : [];

    } catch (error) {

        console.error(
            "❌ Ошибка загрузки следящих:",
            error
        );

        supervisorsData = [];
    }

    console.log(
        "✅ PostgreSQL данные:",
        {
            leaders: leaders.length,
            deputies: deputiesData.length,
            supervisors: supervisorsData.length
        }
    );

    if (
        typeof renderLeaders === "function"
    ) {
        renderLeaders();
    }

    if (
        typeof renderOrganizations === "function"
    ) {
        renderOrganizations();
    }

    if (
        typeof renderSupervisors === "function"
    ) {
        renderSupervisors();
    }
}

/* LOGIN */


$("show-register").addEventListener("click", () => {

    $("login-form").classList.add("hidden");
    $("show-register").classList.add("hidden");
    $("back-to-login").classList.remove("hidden");
    $("register-form").classList.remove("hidden");

    $("login-error").textContent = "";
    $("register-error").textContent = "";
});

$("show-login").addEventListener("click", () => {

    $("register-form").classList.add("hidden");
    $("back-to-login").classList.add("hidden");
    $("login-form").classList.remove("hidden");
    $("show-register").classList.remove("hidden");

    $("login-error").textContent = "";
    $("register-error").textContent = "";
});

$("register-form").addEventListener("submit", async event => {

    event.preventDefault();

    const username = $("register-username").value.trim();
    const password = $("register-password").value;
    const confirmPassword = $("register-password-confirm").value;

    $("register-error").textContent = "";

    if (password !== confirmPassword) {
        $("register-error").textContent =
            "Пароли не совпадают";
        return;
    }

    try {

        const result = await api("/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        });

        $("register-form").reset();

        $("register-form").classList.add("hidden");
        $("back-to-login").classList.add("hidden");
        $("login-form").classList.remove("hidden");
        $("show-register").classList.remove("hidden");

        $("login-username").value = username;
        $("login-password").value = "";

        $("login-error").textContent =
            "Регистрация успешна. Теперь войдите в аккаунт.";

    } catch (error) {

        $("register-error").textContent =
            error.message || "Ошибка регистрации";
    }
});

$("login-form").addEventListener("submit", async event => {

    event.preventDefault();

    $("login-error").textContent = "";

    try {

        const user = await api("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: $("login-username").value.trim(),
                password: $("login-password").value
            })
        });

        currentUser = user.user;

        showApp();

    } catch (error) {

        $("login-error").textContent = error.message;
    }
});

async function checkAuth() {

    try {

        const result = await api("/api/auth/me");

        if (result.authenticated) {

            currentUser = result.user;

            showApp();

            return;
        }

    } catch {}

    $("login-screen").classList.remove("hidden");
    $("app").classList.add("hidden");
}

function showApp() {

    $("login-screen").classList.add("hidden");
    $("app").classList.remove("hidden");

    $("profile-name").textContent =
        currentUser.username;

    $("profile-role").textContent =
        currentUser.role;

    const profileAvatar = $("profile-avatar");

    if (currentUser.avatar_url) {
        profileAvatar.innerHTML = `
            <img
                src="${escapeHTML(currentUser.avatar_url)}"
                alt="${escapeHTML(currentUser.username)}"
                style="
                    width:100%;
                    height:100%;
                    border-radius:50%;
                    object-fit:cover;
                    display:block;
                "
                referrerpolicy="no-referrer"
                onerror="this.parentElement.textContent='${escapeHTML(
                    currentUser.username.charAt(0).toUpperCase()
                )}';"
            >
        `;
    } else {
        profileAvatar.textContent =
            currentUser.username.charAt(0).toUpperCase();
    }

    applyPermissions();

    loadData();
    loadDeputies();
    loadUsers();
    loadJournal();
    loadSupervisors();
}

/* PERMISSIONS */

function level() {

    return ROLE_LEVEL[currentUser?.role] || 0;
}

function applyPermissions() {

    const currentLevel = level();

    document.querySelectorAll(".developer-only")
        .forEach(el => {

            el.style.display =
                currentLevel >= 100 ? "" : "none";
        });

    document.querySelectorAll(".permission-zgs")
        .forEach(el => {

            el.style.display =
                currentLevel >= 20 ? "" : "none";
        });

    const penaltiesButton =
        document.querySelector('[data-page="penalties"]');

    if (penaltiesButton) {

        penaltiesButton.style.display =
            currentLevel >= 10 ? "" : "none";
    }
}

/* LOGOUT */

$("logout-btn").addEventListener("click", async () => {

    try {

        await api("/api/auth/logout", {
            method: "POST"
        });

    } finally {

        location.reload();
    }
});

/* DEPUTIES */


async function loadCivilData() {

    try {

        const data = await api("/api/data");

        if (Array.isArray(data.leaders)) {
            leaders = data.leaders;
        }

        if (Array.isArray(data.deputies)) {
            deputiesData = data.deputies;
        }

        if (Array.isArray(data.penalties)) {
            penalties = data.penalties;
        }

        renderLeaders();
        renderOrganizations();

    } catch (error) {

        console.error(
            "Ошибка загрузки данных гражданских структур:",
            error
        );
    }
}

async function loadDeputies() {

    try {

        deputiesData =
            await api("/api/deputies");

        renderDeputies();

    } catch (error) {

        console.error(
            "Ошибка загрузки заместителей:",
            error
        );

        deputiesData = [];
    }
}

/* ORGANIZATIONS */

function organizationCard(organization) {

    const letter =
        organization.trim().charAt(0).toUpperCase();

    const leader =
        Array.isArray(leaders)
            ? leaders.find(
                x => x.structure === organization
            )
            : null;

    const organizationDeputies =
        organization === "Конгресс"
            ? []
            : (
                Array.isArray(deputiesData)
                    ? deputiesData.filter(
                        x => x.structure === organization
                    )
                    : []
            );

    const leaderName =
        leader?.leader || "Не назначен";

    const leaderAvatar =
        leader?.avatar_url || "";

    const leaderAvatarHTML =
        leaderAvatar
            ? `
                <img
                    src="${escapeHTML(leaderAvatar)}"
                    alt="${escapeHTML(leaderName)}"
                    class="organization-leader-avatar"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    onerror="this.style.display='none';"
                >
              `
            : `
                <div class="organization-leader-avatar organization-leader-avatar-placeholder">
                    ${escapeHTML(
                        leaderName
                            .trim()
                            .charAt(0)
                            .toUpperCase() || "?"
                    )}
                </div>
              `;

    const endDate =
        leader?.end_date || null;

    const daysLeft =
        endDate
            ? getDaysLeft(endDate)
            : 0;

    let termHTML = "—";

    if (leader && endDate) {

        if (daysLeft > 0) {

            termHTML = `
                <span class="org-days-active">
                    ${daysLeft} ${daysWord(daysLeft)}
                </span>
            `;

        } else {

            termHTML = `
                <span class="org-days-expired">
                    Срок истёк
                </span>
            `;
        }
    }

    const deputiesHTML =
        organization === "Конгресс"
            ? `<div class="org-deputy-empty">—</div>`
            : organizationDeputies.length
                ? organizationDeputies.map(d => `
                    <div
                        class="org-deputy"
                        onclick="event.stopPropagation()"
                    >

                        <div class="org-deputy-info">

                            <strong>
                                ${escapeHTML(
                                    d.deputy ||
                                    d.name ||
                                    "Без имени"
                                )}
                            </strong>

                            ${
                                d.vk
                                    ? `
                                        <div class="org-deputy-vk">
                                            ${vkLink(d.vk)}
                                        </div>
                                      `
                                    : ""
                            }

                        </div>

                        <button
                            type="button"
                            class="danger-btn org-deputy-delete"
                            onclick="
                                event.stopPropagation();
                                deleteDeputyFromOrganization(${Number(d.id)})
                            "
                        >
                            🗑
                        </button>

                    </div>
                `).join("")
                : `<div class="org-deputy-empty">Не назначены</div>`;

    return `
        <article
            class="organization-card"
            onclick="openOrganizationDetails('${escapeHTML(organization)}')"
            role="button"
            tabindex="0"
            onkeydown="
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openOrganizationDetails('${escapeHTML(organization)}');
                }
            "
        >

            <div class="organization-glow"></div>

            <div class="organization-top">

                <div class="organization-icon">
                    ${escapeHTML(letter)}
                </div>

                <div class="organization-heading">

                    <span class="organization-type">
                        ГРАЖДАНСКАЯ СТРУКТУРА
                    </span>

                    <h3>
                        ${escapeHTML(organization)}
                    </h3>

                </div>

                <div class="organization-status">

                    <i></i>

                    ${
                        leader && daysLeft > 0
                            ? "ACTIVE"
                            : "NO LEADER"
                    }

                </div>

            </div>

            <div class="organization-divider"></div>

            <div class="organization-info">

                <div class="organization-info-item">

                    <span>ЛИДЕР</span>

                    <div class="organization-leader-row">

                        ${leaderAvatarHTML}

                        <strong>
                            ${escapeHTML(leaderName)}
                        </strong>

                    </div>

                    ${
                        leader?.vk
                            ? `
                                <div class="organization-vk">
                                    ${vkLink(leader.vk)}
                                </div>
                              `
                            : ""
                    }

                </div>

                <div class="organization-info-item">

                    <span>
                        ЗАМЕСТИТЕЛИ
                        ${
                            organizationDeputies.length
                                ? `(${organizationDeputies.length})`
                                : ""
                        }
                    </span>

                    <div class="organization-deputies">
                        ${deputiesHTML}
                    </div>

                </div>

                <div class="organization-info-item">

                    <span>ДО КОНЦА СРОКА</span>

                    <strong>
                        ${termHTML}
                    </strong>

                </div>

            </div>

            <div class="organization-footer">

                <span>
                    <b>ARIZONA RP</b>
                    • Нажмите для подробной информации
                </span>

                <span>
                    →
                </span>

            </div>

        </article>
    `;
}


/*
=========================================
 ПОДРОБНАЯ КАРТОЧКА ОРГАНИЗАЦИИ
=========================================
*/

function openOrganizationDetails(organization) {

    const leader =
        Array.isArray(leaders)
            ? leaders.find(
                x => x.structure === organization
            )
            : null;

    const organizationDeputies =
        organization === "Конгресс"
            ? []
            : (
                Array.isArray(deputiesData)
                    ? deputiesData.filter(
                        x => x.structure === organization
                    )
                    : []
            );

    const leaderName =
        leader?.leader || "Не назначен";

    const leaderAvatar =
        leader?.avatar_url || "";

    const days =
        leader?.end_date
            ? getDaysLeft(leader.end_date)
            : 0;

    const avatarHTML =
        leaderAvatar
            ? `
                <img
                    src="${escapeHTML(leaderAvatar)}"
                    alt="${escapeHTML(leaderName)}"
                    style="
                        width:130px;
                        height:130px;
                        border-radius:50%;
                        object-fit:cover;
                        display:block;
                        margin:0 auto 15px;
                    "
                    loading="lazy"
                    referrerpolicy="no-referrer"
                >
              `
            : `
                <div style="
                    width:130px;
                    height:130px;
                    border-radius:50%;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    margin:0 auto 15px;
                    font-size:46px;
                    font-weight:700;
                    background:rgba(255,255,255,.08);
                    border:1px solid rgba(255,255,255,.15);
                ">
                    ${escapeHTML(
                        leaderName
                            .trim()
                            .charAt(0)
                            .toUpperCase() || "?"
                    )}
                </div>
              `;

    const deputiesHTML =
        organizationDeputies.length
            ? organizationDeputies.map(d => `
                <div style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:15px;
                    padding:12px 0;
                    border-bottom:1px solid rgba(255,255,255,.08);
                ">

                    <div>
                        <strong>
                            ${escapeHTML(
                                d.deputy ||
                                d.name ||
                                "Без имени"
                            )}
                        </strong>

                        ${
                            d.position
                                ? `
                                    <div style="
                                        font-size:12px;
                                        opacity:.6;
                                        margin-top:3px;
                                    ">
                                        ${escapeHTML(d.position)}
                                    </div>
                                  `
                                : ""
                        }
                    </div>

                    ${
                        d.vk
                            ? vkLink(d.vk)
                            : `<span style="opacity:.5;">VK не указан</span>`
                    }

                </div>
            `).join("")
            : `
                <div style="opacity:.6;">
                    Заместители не назначены
                </div>
            `;


    const canEditLeader =
        ["ЗГС гражданских", "ГС гражданских", "Разработчик"]
            .includes(currentUser?.role);

    const canManageDeputies =
        ["ГС гражданских", "Разработчик"]
            .includes(currentUser?.role);

    const organizationControls =
        (canEditLeader || canManageDeputies)
            ? `
                <div style="
                    margin-top:25px;
                    padding-top:20px;
                    border-top:1px solid rgba(255,255,255,.1);
                ">

                    <div style="
                        font-size:12px;
                        opacity:.65;
                        margin-bottom:12px;
                    ">
                        УПРАВЛЕНИЕ ОРГАНИЗАЦИЕЙ
                    </div>

                    <div style="
                        display:flex;
                        flex-wrap:wrap;
                        gap:10px;
                    ">

                        ${
                            canEditLeader && leader
                                ? `
                                    <button
                                        type="button"
                                        class="gold-btn"
                                        onclick="
                                            event.stopPropagation();
                                            closeModal();
                                            editLeader(${Number(leader.id)})
                                        "
                                    >
                                        ✏️ Изменить лидера
                                    </button>
                                  `
                                : ""
                        }

                        ${
                            canManageDeputies
                                ? `
                                    <button
                                        type="button"
                                        class="gold-btn"
                                        onclick="
                                            event.stopPropagation();
                                            closeModal();
                                            openDeputyModal('${escapeHTML(organization)}')
                                        "
                                    >
                                        ➕ Добавить заместителя
                                    </button>
                                  `
                                : ""
                        }

                        ${
                            canEditLeader && leader
                                ? `
                                    <button
                                        type="button"
                                        class="danger-btn"
                                        onclick="
                                            event.stopPropagation();
                                            removeLeaderFromOrganization(${Number(leader.id)}, '${escapeHTML(organization)}')
                                        "
                                    >
                                        🗑️ Снять лидера
                                    </button>
                                  `
                                : ""
                        }

                    </div>

                </div>
              `
            : "";

    $("modal-content").innerHTML = `

        <div class="neon-modal-head">

            <span>
                ARIZONA RP • УПРАВЛЕНИЕ
            </span>

            <h2>
                ${escapeHTML(organization)}
            </h2>

            <p>
                Подробная информация о гражданской структуре
            </p>

        </div>

        <div style="
            text-align:center;
            padding:10px 0 20px;
        ">

            ${avatarHTML}

            <h2 style="margin:0 0 6px;">
                ${escapeHTML(leaderName)}
            </h2>

            <div style="
                font-size:13px;
                opacity:.65;
            ">
                Лидер организации
            </div>

            ${
                leader?.vk
                    ? `
                        <div style="margin-top:10px;">
                            ${vkLink(leader.vk)}
                        </div>
                      `
                    : ""
            }

        </div>

        <div class="organization-info">

            <div class="organization-info-item">

                <span>СТАТУС</span>

                <strong>
                    ${
                        leader && days > 0
                            ? "Активна"
                            : "Нет активного лидера"
                    }
                </strong>

            </div>

            <div class="organization-info-item">

                <span>НАЧАЛО СРОКА</span>

                <strong>
                    ${
                        leader?.start_date
                            ? formatDate(leader.start_date)
                            : "—"
                    }
                </strong>

            </div>

            <div class="organization-info-item">

                <span>КОНЕЦ СРОКА</span>

                <strong>
                    ${
                        leader?.end_date
                            ? formatDate(leader.end_date)
                            : "—"
                    }
                </strong>

            </div>

            <div class="organization-info-item">

                <span>ОСТАЛОСЬ</span>

                <strong>
                    ${
                        leader
                            ? (
                                days > 0
                                    ? `${days} ${daysWord(days)}`
                                    : "Срок истёк"
                              )
                            : "—"
                    }
                </strong>

            </div>

        </div>

        <div style="
            margin-top:25px;
        ">

            <div style="
                font-size:12px;
                opacity:.65;
                margin-bottom:10px;
                letter-spacing:.5px;
            ">
                ЗАМЕСТИТЕЛИ
                ${
                    organizationDeputies.length
                        ? ` • ${organizationDeputies.length}`
                        : ""
                }
            </div>

            ${deputiesHTML}

        </div>

        ${organizationControls}

        <div class="neon-form-actions" style="margin-top:25px;">

            <button
                type="button"
                class="secondary-btn"
                onclick="closeModal()"
            >
                Закрыть
            </button>

        </div>
    `;

    $("modal").classList.add("show");
}


window.editLeader = editLeader;

window.openDeputyModal = openDeputyModal;

window.removeLeaderFromOrganization = removeLeaderFromOrganization;

window.deleteDeputyFromOrganization = deleteDeputyFromOrganization;

window.closeModal = closeModal;

window.openOrganizationDetails = openOrganizationDetails;

async function removeLeaderFromOrganization(id, organization) {

    if (!confirm(
        `Снять текущего лидера организации «${organization}»?`
    )) {
        return;
    }

    try {

        await api(`/api/leaders/${Number(id)}`, {
            method: "DELETE"
        });

        closeModal();

        await loadData();

        if (typeof loadDeputies === "function") {
            await loadDeputies();
        }

        if (typeof renderOrganizations === "function") {
            renderOrganizations();
        }

        if (typeof renderLeaders === "function") {
            renderLeaders();
        }

        alert("Лидер снят");

    } catch (error) {

        console.error(
            "Ошибка снятия лидера:",
            error
        );

        alert(
            error.message ||
            "Не удалось снять лидера"
        );
    }
}

/* Удаление заместителя непосредственно из карточки организации */

async function deleteDeputyFromOrganization(id) {

    if (
        !confirm(
            "Вы действительно хотите удалить этого заместителя?"
        )
    ) {
        return;
    }

    try {

        await api(
            `/api/deputies/${Number(id)}`,
            {
                method: "DELETE"
            }
        );

        await loadData();

        alert("Заместитель удалён");

    } catch (error) {

        console.error(
            "Ошибка удаления заместителя:",
            error
        );

        alert(
            error.message ||
            "Не удалось удалить заместителя"
        );
    }
}

function daysWord(days) {

    const n = Math.abs(Number(days)) % 100;
    const n1 = n % 10;

    if (n > 10 && n < 20) {
        return "дней";
    }

    if (n1 === 1) {
        return "день";
    }

    if (n1 >= 2 && n1 <= 4) {
        return "дня";
    }

    return "дней";
}


function renderOrganizations() {

    $("organization-grid").innerHTML =
        organizations.map(organizationCard).join("");

    const allOrganizations = $("all-organizations");

    if (allOrganizations) {
        allOrganizations.innerHTML = "";
    }
}


/* LEADERS */

function getDaysLeft(endDate) {

    if (!endDate) return 0;

    const end = new Date(endDate);

    if (Number.isNaN(end.getTime())) return 0;

    const now = new Date();

    const diff = end.getTime() - now.getTime();

    return Math.max(
        0,
        Math.ceil(diff / 86400000)
    );
}

function formatDate(date) {

    if (!date) return "—";

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
        return String(date);
    }

    return d.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function vkLink(url) {

    if (!url) return "—";

    const value = String(url).trim();

    if (!/^https?:\/\//i.test(value)) {
        return escapeHTML(value);
    }

    return `
        <a
            href="${escapeHTML(value)}"
            target="_blank"
            rel="noopener noreferrer"
            class="vk-link"
        >
            VK
        </a>
    `;
}

function statusHTML(status, endDate) {

    const days = getDaysLeft(endDate);

    if (
        status !== "Активен" ||
        days <= 0
    ) {
        return '<span class="status expired">Завершён</span>';
    }

    return '<span class="status active">Активен</span>';
}

function leaderRow(l) {

    const days = getDaysLeft(l.end_date);

    return `
        <tr>

            <td>
                <b>${escapeHTML(l.structure || "—")}</b>
            </td>

            <td>
                ${escapeHTML(l.leader || "—")}
            </td>

            <td>
                ${vkLink(l.vk)}
            </td>

            <td>
                ${formatDate(l.start_date)}
            </td>

            <td>
                ${formatDate(l.end_date)}
            </td>

            <td class="days">
                ${days} дн.
            </td>

            <td>
                ${statusHTML(l.status, l.end_date)}
            </td>

            <td>
                <div style="display:flex;gap:8px;flex-wrap:wrap">

                    <button
                        type="button"
                        class="secondary-btn"
                        onclick="editLeader(${Number(l.id)})">
                        ✏️ Редактировать
                    </button>

                    <button
                        type="button"
                        class="danger-btn leader-delete-btn"
                        onclick="deleteLeader(${Number(l.id)})">
                        🗑 Удалить
                    </button>

                </div>
            </td>

        </tr>
    `;
}

async function editLeader(id) {

    const leader = leaders.find(
        x => Number(x.id) === Number(id)
    );

    if (!leader) {
        alert("Лидер не найден");
        return;
    }

    const organizationOptions =
        organizations.map(org => `
            <option
                value="${escapeHTML(org)}"
                ${org === leader.structure ? "selected" : ""}>
                ${escapeHTML(org)}
            </option>
        `).join("");

    $("modal-content").innerHTML = `

        <div class="neon-modal-head">

            <span>УПРАВЛЕНИЕ • ЛИДЕРЫ</span>

            <h2>Редактирование лидера</h2>

            <p>
                Изменение данных руководителя
            </p>

        </div>

        <form id="edit-leader-form">

            <div class="form-group">

                <label>Гражданская структура</label>

                <select
                    id="edit-leader-structure"
                    required>

                    ${organizationOptions}

                </select>

            </div>

            <div class="form-group">

                <label>Имя / Nick_Name</label>

                <input
                    id="edit-leader-name"
                    value="${escapeHTML(leader.leader || "")}"
                    autocomplete="off"
                    required>

            </div>

            <div class="form-group">

                <label>VK</label>

                <input
                    id="edit-leader-vk"
                    value="${escapeHTML(leader.vk || "")}"
                    placeholder="https://vk.com/username"
                    autocomplete="off">

                <small>
                    При изменении VK аватар обновится автоматически.
                </small>

            </div>

            <div class="leader-date-grid">

                <div class="form-group">

                    <label>Начало срока</label>

                    <input
                        id="edit-leader-start"
                        type="date"
                        value="${leader.start_date || ""}"
                        required>

                </div>

                <div class="form-group">

                    <label>Конец срока</label>

                    <input
                        id="edit-leader-end"
                        type="date"
                        value="${leader.end_date || ""}"
                        required>

                </div>

            </div>

            <div class="neon-form-actions">

                <button
                    type="button"
                    class="secondary-btn"
                    onclick="closeModal()">

                    Отмена

                </button>

                <button
                    type="submit"
                    class="gold-btn">

                    💾 Сохранить

                </button>

            </div>

        </form>
    `;

    $("modal").classList.add("show");

    $("edit-leader-form").addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const structure =
                $("edit-leader-structure").value;

            const name =
                $("edit-leader-name").value.trim();

            const vk =
                $("edit-leader-vk").value.trim();

            const start_date =
                $("edit-leader-start").value;

            const end_date =
                $("edit-leader-end").value;

            if (!structure || !name || !start_date || !end_date) {
                alert("Заполните обязательные поля");
                return;
            }

            if (end_date < start_date) {
                alert(
                    "Дата окончания не может быть раньше даты начала"
                );
                return;
            }

            try {

                await api(`/api/leaders/${Number(id)}`, {

                    method: "PUT",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        structure,
                        leader: name,
                        vk,
                        start_date,
                        end_date
                    })

                });

                closeModal();

                await loadData();

                if (typeof renderOrganizations === "function") {
                    renderOrganizations();
                }

                if (typeof renderLeaders === "function") {
                    renderLeaders();
                }

                alert("✅ Данные лидера обновлены");

            } catch (error) {

                alert(
                    error.message ||
                    "Не удалось изменить данные лидера"
                );
            }
        }
    );
}

function renderLeaders() {

    const table = $("all-leaders-table");

    if (!table) {
        console.error("❌ all-leaders-table не найден");
        return;
    }

    if (!Array.isArray(leaders)) {
        console.error("❌ leaders не является массивом:", leaders);
        table.innerHTML = `
            <tr>
                <td colspan="8">
                    Ошибка загрузки лидеров
                </td>
            </tr>
        `;
        return;
    }

    if (leaders.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    Лидеры не назначены
                </td>
            </tr>
        `;

        return;
    }

    table.innerHTML =
        leaders.map(leaderRow).join("");
}

/* DEPUTIES */

function renderDeputies() {

    const table = $("all-deputies-table");

    if (!table) return;

    table.innerHTML =
        deputiesData.length
            ? deputiesData.map(d => `

                <tr>

                    <td>
                        <b>${escapeHTML(d.structure || "—")}</b>
                    </td>

                    <td>
                        ${escapeHTML(d.deputy || d.name || "—")}
                    </td>

                    <td>
                        ${escapeHTML(d.vk || "—")}
                    </td>

                    <td>
                        ${formatDate(
                            d.created_at
                                ? d.created_at.slice(0, 10)
                                : ""
                        )}
                    </td>

                    <td>

                        <div class="deputy-actions">

                            <button
                                type="button"
                                class="edit-btn"
                                onclick="changeDeputyName(
                                    ${Number(d.id)},
                                    '${escapeHTML(d.deputy || d.name || "")}'
                                )">

                                ✏️ Сменить ник

                            </button>

                            <button
                                type="button"
                                class="danger-btn"
                                onclick="deleteDeputy(${Number(d.id)})">

                                🗑 Удалить

                            </button>

                        </div>

                    </td>

                </tr>

            `).join("")
            : emptyRow(5, "Заместителей пока нет");
}

async function openDeputyModal(selectedOrganization = '') {

    const availableOrganizations =
        organizations.filter(x => x !== "Конгресс");

    const options =
        availableOrganizations.map(x => `
            <option value="${escapeHTML(x)}">
                ${escapeHTML(x)}
            </option>
        `).join("");

    $("modal-content").innerHTML = `

        <div class="neon-modal-header">

            <span>УПРАВЛЕНИЕ</span>

            <h2>Добавить заместителя</h2>

            <p>
                Назначение заместителя гражданской структуры
            </p>

        </div>

        <form id="deputy-form">

            <div class="form-group">

                <label>Гражданская структура</label>

                <select
                    id="deputy-structure"
                    required>

                    <option value="">
                        Выберите организацию
                    </option>

                    ${options}

                </select>

            </div>

            <div class="form-group">

                <label>Имя / Nick_Name</label>

                <input
                    id="deputy-name"
                    placeholder="Например: Nick_Name"
                    autocomplete="off"
                    required>

            </div>

            <div class="form-group">

                <label>VK</label>

                <input
                    id="deputy-vk"
                    placeholder="https://vk.com/username"
                    autocomplete="off">

            </div>

            <div class="neon-form-actions">

                <button
                    type="button"
                    class="secondary-btn"
                    onclick="closeModal()">

                    Отмена

                </button>

                <button
                    type="submit"
                    class="gold-btn">

                    Добавить заместителя

                </button>

            </div>

        </form>
    `;

    $("modal").classList.add("show");

    if (selectedOrganization) {
        const structureSelect =
            $("deputy-structure");

        if (structureSelect) {
            structureSelect.value =
                selectedOrganization;
        }
    }

    $("deputy-form").addEventListener(
        "submit",
        createDeputy
    );
}

async function createDeputy(event) {

    event.preventDefault();

    const structure =
        $("deputy-structure").value;

    const name =
        $("deputy-name").value.trim();

    const vk =
        $("deputy-vk").value.trim();

    if (!structure || !name) {

        alert("Заполните обязательные поля");

        return;
    }

    if (structure === "Конгресс") {

        alert(
            "У Конгресса нет должности заместителя."
        );

        return;
    }

    try {

        await api("/api/deputies", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                structure,
                deputy: name,
                vk
            })

        });

        closeModal();

        await loadDeputies();

        renderDeputies();

        renderOrganizations();

        alert("Заместитель добавлен");

    } catch (error) {

        alert(
            error.message ||
            "Не удалось добавить заместителя"
        );
    }
}

async function deleteDeputy(id) {

    if (!confirm(
        "Удалить этого заместителя?"
    )) {
        return;
    }

    try {

        await api(
            `/api/deputies/${Number(id)}`,
            {
                method: "DELETE"
            }
        );

        await loadDeputies();

        renderDeputies();

        renderOrganizations();

    } catch (error) {

        alert(
            error.message ||
            "Не удалось удалить заместителя"
        );
    }
}

/* PENALTIES */

function renderPenalties() {

    $("penalties-table").innerHTML =
        penalties.length
            ? penalties.map(p => `

                <tr>

                    <td>
                        <b>
                            ${escapeHTML(p.structure || "—")}
                        </b>
                    </td>

                    <td>
                        ${escapeHTML(p.leader || "—")}
                    </td>

                    <td>
                        ${escapeHTML(p.type)}
                    </td>

                    <td>
                        ${escapeHTML(p.reason)}
                    </td>

                    <td>
                        ${
                            p.amount
                                ? Number(p.amount)
                                    .toLocaleString("ru-RU") + " $"
                                : "—"
                        }
                    </td>

                    <td>
                        ${formatDate(p.date)}
                    </td>

                </tr>

            `).join("")
            : emptyRow(6, "Наказаний пока нет");

    $("stat-penalties").textContent =
        penalties.length;
}


/* DELETE LEADER */

async function deleteLeader(id) {

    if (!confirm(
        "Вы действительно хотите удалить этого лидера?"
    )) {
        return;
    }

    try {

        await api(`/api/leaders/${Number(id)}`, {
            method: "DELETE"
        });

        leaders = await api("/api/leaders");

        await loadDeputies();

        renderOrganizations();

        if (typeof renderLeaders === "function") {
            renderLeaders();
        }

        if (typeof renderOrganizations === "function") {
            renderOrganizations();
        }

        alert("Лидер удалён");

    } catch (error) {

        console.error(
            "Ошибка удаления лидера:",
            error
        );

        alert(
            error.message ||
            "Не удалось удалить лидера"
        );
    }
}



/* CHANGE DEPUTY NICKNAME */

async function changeDeputyName(id, currentName) {

    const newName =
        prompt(
            "Введите новый ник заместителя:",
            currentName || ""
        );

    if (newName === null) {
        return;
    }

    const name =
        newName.trim();

    if (!name) {

        alert("Ник не может быть пустым");

        return;
    }

    if (name === currentName) {
        return;
    }

    try {

        await api(
            `/api/deputies/${Number(id)}`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    deputy: name
                })
            }
        );

        await loadDeputies();

        renderDeputies();

        renderOrganizations();

        alert("Ник заместителя изменён");

    } catch (error) {

        alert(
            error.message ||
            "Не удалось изменить ник"
        );
    }
}

/* SUPERVISORS */

async function loadSupervisors() {

    try {

        const list =
            await api("/api/supervisors");

        const container =
            $("supervisor-list");

        container.innerHTML =
            list.length
                ? list.map(s => `

                    <div class="supervisor-row">

                        <div style="
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            gap:15px;
                            flex-wrap:wrap;">

                            <div>

                                <div class="supervisor-name">
                                    ${escapeHTML(s.name)}
                                </div>

                                <div class="supervisor-position">
                                    ${escapeHTML(s.position || "Следящий")}
                                </div>

                                ${
                                    s.role
                                    ? `
                                    <div style="
                                        margin-top:7px;
                                        color:#ff69dc;
                                        font-size:11px;
                                        font-weight:700;">
                                        ${escapeHTML(s.role)}
                                    </div>
                                    `
                                    : ""
                                }

                            </div>

                            <div style="
                                display:flex;
                                gap:8px;
                                flex-wrap:wrap;">

                                <button
                                    class="gold-btn"
                                    onclick="editSupervisor(${s.id})">
                                    ✎ Изменить
                                </button>

                                <button
                                    class="danger-btn"
                                    onclick="deleteSupervisor(${s.id})">
                                    🗑 Удалить
                                </button>

                            </div>

                        </div>

                    </div>

                `).join("")
                : `
                    <div class="empty-state" style="padding:35px;text-align:center;">
                        <div style="font-size:35px;">♟</div>
                        <h3>Следящих пока нет</h3>
                        <p>Добавьте первого ответственного.</p>
                    </div>
                `;

    } catch (error) {

        console.error(error);

    }
}

$("add-supervisor-btn").onclick =
    openSupervisorModal;

function openSupervisorModal() {

    $("modal-content").innerHTML = `

        <h2>Добавить следящего</h2>

        <p style="
            color:#9292b2;
            margin-bottom:20px;">
            Назначьте ответственного за гражданские структуры
        </p>

        <div class="form-group">
            <label>Имя / ник</label>
            <input
                id="supervisor-name"
                placeholder="Nick_Name">
        </div>

        <div class="form-group">
            <label>Должность</label>

            <select id="supervisor-position">

                
                
                
                
                
                
                
                
                

            </select>
        </div>

        <button
            class="gold-btn"
            style="width:100%;margin-top:10px"
            onclick="saveSupervisor()">

            Добавить следящего

        </button>
    `;

    $("modal").classList.add("show");
}

async function saveSupervisor() {

    const name =
        $("supervisor-name").value.trim();

    const position =
        $("supervisor-position").value;

    if (!name) {

        alert("Введите имя или ник");

        return;
    }

    try {

        await api("/api/supervisors", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name,
                position
            })

        });

        closeModal();

        await loadSupervisors();

    } catch (error) {

        alert(error.message);
    }
}

async function editSupervisor(id) {

    try {

        const list =
            await api("/api/supervisors");

        const supervisor =
            list.find(x => Number(x.id) === Number(id));

        if (!supervisor) {

            alert("Следящий не найден");

            return;
        }

        $("modal-content").innerHTML = `

            <h2>Изменить следящего</h2>

            <div class="form-group">

                <label>Имя / ник</label>

                <input
                    id="edit-supervisor-name"
                    value="${escapeHTML(supervisor.name)}">

            </div>

            <div class="form-group">

                <label>Должность</label>

                <select id="edit-supervisor-position">

                    ${[
                        "Следящий за Правительством",
                        "Следящий за ГЦЛ",
                        "Следящий за СМИ",
                        "Следящий за Страховой компанией",
                        "Следящий за больницами",
                        "Следящий за Прокуратурой",
                        "Следящий за Адвокатурой",
                        "Следящий за Конгрессом",
                        "Следящий за Пожарным департаментом"
                    ].map(position => `
                        <option
                            ${position === supervisor.position ? "selected" : ""}>
                            ${escapeHTML(position)}
                        </option>
                    `).join("")}

                </select>

            </div>

            ${
                level() >= 100
                ? `
                    <div class="form-group">

                        <label>Роль</label>

                        <select id="edit-supervisor-role">

                            ${Object.keys(ROLE_LEVEL)
                                .map(role => `
                                    <option
                                        ${role === supervisor.role ? "selected" : ""}>
                                        ${escapeHTML(role)}
                                    </option>
                                `)
                                .join("")}

                        </select>

                    </div>
                `
                : ""
            }

            <button
                class="gold-btn"
                style="width:100%"
                onclick="updateSupervisor(${id})">

                Сохранить изменения

            </button>
        `;

        $("modal").classList.add("show");

    } catch (error) {

        alert(error.message);

    }
}

async function updateSupervisor(id) {

    const name =
        $("edit-supervisor-name").value.trim();

    const position =
        $("edit-supervisor-position").value;

    const payload = {
        name,
        position
    };

    const roleElement =
        $("edit-supervisor-role");

    if (roleElement) {

        payload.role =
            roleElement.value;
    }

    if (!name) {

        alert("Введите имя");

        return;
    }

    try {

        await api(`/api/supervisors/${id}`, {

            method: "PATCH",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(payload)

        });

        closeModal();

        await loadSupervisors();

    } catch (error) {

        alert(error.message);
    }
}

async function deleteSupervisor(id) {

    if (!confirm("Удалить этого следящего?")) {
        return;
    }

    try {

        await api(`/api/supervisors/${id}`, {
            method: "DELETE"
        });

        await loadSupervisors();

    } catch (error) {

        alert(error.message);
    }
}

/* USERS */

async function loadUsers() {

    if (level() < 100) return;

    try {

        const users = await api("/api/users");

        $("users-table").innerHTML =
            users.map(u => {

                const isMe =
                    Number(u.id) ===
                    Number(currentUser?.id);

                const statusHTML = u.active
                    ? `<span style="
                            color:#42d392;
                            font-weight:600;">
                            ● Активен
                       </span>`
                    : `<span style="
                            color:#ff5c5c;
                            font-weight:600;">
                            ● Заблокирован
                       </span>`;

                const actionHTML = isMe
                    ? `<span style="opacity:.5;">
                            Это вы
                       </span>`
                    : `
                        <div style="
                            display:flex;
                            gap:8px;
                            align-items:center;
                            flex-wrap:wrap;">

                            <select
                                onchange="changeUserRole(${u.id}, this.value)">

                                ${Object.keys(ROLE_LEVEL)
                                    .map(role => `
                                        <option
                                            value="${escapeHTML(role)}"
                                            ${role === u.role ? "selected" : ""}>
                                            ${escapeHTML(role)}
                                        </option>
                                    `)
                                    .join("")}

                            </select>

                            ${
                                u.active
                                ? `
                                    <button
                                        class="danger-btn"
                                        onclick="changeUserStatus(${u.id}, false, '${escapeHTML(u.username)}')">
                                        🔒 Заблокировать
                                    </button>
                                  `
                                : `
                                    <button
                                        class="gold-btn"
                                        onclick="changeUserStatus(${u.id}, true, '${escapeHTML(u.username)}')">
                                        🔓 Разблокировать
                                    </button>
                                  `
                            }

                        </div>
                    `;

                return `
                    <tr>

                        <td>
                            <b>
                                ${escapeHTML(u.username)}
                            </b>
                        </td>

                        <td>
                            ${escapeHTML(u.role)}
                        </td>

                        <td>
                            ${statusHTML}
                        </td>

                        <td>
                            ${actionHTML}
                        </td>

                    </tr>
                `;

            }).join("");

    } catch (error) {

        console.error(error);

        alert(
            error.message ||
            "Не удалось загрузить пользователей"
        );
    }
}

$("add-user-btn").onclick =
    openUserModal;

function openUserModal() {

    $("modal-content").innerHTML = `

        <h2>Добавить пользователя</h2>

        <form id="user-form">

            <div class="form-group">
                <label>Логин</label>
                <input name="username" required>
            </div>

            <div class="form-group">
                <label>Пароль</label>
                <input
                    name="password"
                    type="password"
                    required>
            </div>

            <div class="form-group">

                <label>Роль</label>

                <select name="role">

                    ${Object.keys(ROLE_LEVEL)
                        .map(role => `
                            <option>
                                ${escapeHTML(role)}
                            </option>
                        `)
                        .join("")}

                </select>

            </div>

            <button class="gold-btn"
                    style="width:100%">

                Создать пользователя

            </button>

        </form>
    `;

    $("modal").classList.add("show");

    $("user-form")
        .addEventListener("submit", createUser);
}

async function createUser(event) {

    event.preventDefault();

    const data =
        Object.fromEntries(
            new FormData(event.target).entries()
        );

    try {

        await api("/api/users", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        closeModal();

        loadUsers();

    } catch (error) {

        alert(error.message);
    }
}

async function changeUserRole(id, role) {

    try {

        await api(`/api/users/${id}/role`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ role })
        });

        alert("Роль изменена");

    } catch (error) {

        alert(error.message);

        loadUsers();
    }
}


async function changeUserStatus(id, active, username) {

    const action =
        active
            ? "разблокировать"
            : "заблокировать";

    const confirmed = confirm(
        `Вы действительно хотите ${action} пользователя "${username}"?`
    );

    if (!confirmed) {
        loadUsers();
        return;
    }

    try {

        await api(`/api/users/${id}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                active
            })
        });

        alert(
            active
                ? "Пользователь разблокирован"
                : "Пользователь заблокирован"
        );

        await loadUsers();

    } catch (error) {

        alert(
            error.message ||
            "Не удалось изменить статус"
        );

        await loadUsers();
    }
}


/* JOURNAL */

async function loadJournal() {

    if (level() < 100) return;

    try {

        const journal =
            await api("/api/audit");

        $("journal-table").innerHTML =
            journal.map(item => {

                const date =
                    item.created_at
                        ? new Date(item.created_at)
                            .toLocaleString("ru-RU")
                        : "—";

                const actor =
                    escapeHTML(
                        item.actor || "—"
                    );

                const action =
                    escapeHTML(
                        item.action || "—"
                    );

                const details =
                    escapeHTML(
                        item.details || "—"
                    );

                return `
                    <tr>

                        <td>
                            ${date}
                        </td>

                        <td>
                            <b>${actor}</b>
                        </td>

                        <td>
                            ${action}
                        </td>

                        <td>
                            ${details}
                        </td>

                    </tr>
                `;

            }).join("");

    } catch (error) {

        console.error(
            "Ошибка загрузки журнала:",
            error
        );

        $("journal-table").innerHTML = `
            <tr>
                <td colspan="4"
                    style="text-align:center; opacity:.6;">
                    Не удалось загрузить журнал
                </td>
            </tr>
        `;
    }
}




/* LEADER BUTTON */

(function initLeaderButton() {

    const button =
        document.getElementById("add-leader-btn");

    if (!button) {

        console.error(
            "❌ Кнопка add-leader-btn не найдена"
        );

        return;
    }

    button.onclick = null;

    button.addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            console.log(
                "✅ Кнопка добавления лидера нажата"
            );

            openLeaderModal();
        }
    );

    console.log(
        "✅ Кнопка добавления лидера подключена"
    );

})();

function openLeaderModal() {

    const organizationOptions =
        organizations.map(org => `
            <option value="${escapeHTML(org)}">
                ${escapeHTML(org)}
            </option>
        `).join("");

    $("modal-content").innerHTML = `

        <div class="neon-modal-head">

            <span>УПРАВЛЕНИЕ • ЛИДЕРЫ</span>

            <h2>Добавить лидера</h2>

            <p>
                Назначение руководителя гражданской структуры
            </p>

        </div>

        <form id="leader-form">

            <div class="form-group">

                <label>Гражданская структура</label>

                <select
                    id="leader-structure"
                    name="structure"
                    required>

                    <option value="">
                        Выберите организацию
                    </option>

                    ${organizationOptions}

                </select>

            </div>

            <div class="form-group">

                <label>Имя / Nick_Name</label>

                <input
                    id="leader-name"
                    name="leader"
                    placeholder="Например: Nick_Name"
                    autocomplete="off"
                    required>

            </div>

            <div class="form-group">

                <label>VK</label>

                <input
                    id="leader-vk"
                    name="vk"
                    placeholder="https://vk.com/username"
                    autocomplete="off">

            </div>

            <div class="leader-date-grid">

                <div class="form-group">

                    <label>Начало срока</label>

                    <input
                        id="leader-start-date"
                        name="start_date"
                        type="date"
                        required>

                </div>

                <div class="form-group">

                    <label>Конец срока</label>

                    <input
                        id="leader-end-date"
                        name="end_date"
                        type="date"
                        required>

                </div>

            </div>

            <div class="neon-form-actions">

                <button
                    type="button"
                    class="secondary-btn"
                    onclick="closeModal()">

                    Отмена

                </button>

                <button
                    type="submit"
                    class="gold-btn">

                    Добавить лидера

                </button>

            </div>

        </form>
    `;

    $("modal").classList.add("show");

    const form = $("leader-form");

    if (!form) {
        console.error("Форма лидера не создана");
        return;
    }

    form.addEventListener("submit", createLeader);

    const today =
        new Date().toISOString().slice(0, 10);

    $("leader-start-date").value = today;

    const endDate =
        new Date();

    endDate.setDate(
        endDate.getDate() + 30
    );

    $("leader-end-date").value =
        endDate.toISOString().slice(0, 10);
}


async function createLeader(event) {

    event.preventDefault();

    const structure =
        $("leader-structure").value;

    const leader =
        $("leader-name").value.trim();

    const vk =
        $("leader-vk").value.trim();

    const start_date =
        $("leader-start-date").value;

    const end_date =
        $("leader-end-date").value;

    if (!structure) {
        alert("Выберите организацию");
        return;
    }

    if (!leader) {
        alert("Введите имя или ник лидера");
        return;
    }

    if (!start_date || !end_date) {
        alert("Укажите срок лидера");
        return;
    }

    if (end_date < start_date) {
        alert("Дата окончания не может быть раньше даты начала");
        return;
    }

    /*
     * Дополнительная защита интерфейса:
     * в одной организации может быть только один лидер.
     */

    const existingLeader =
        leaders.find(
            x => x.structure === structure
        );

    if (existingLeader) {

        alert(
            `В организации "${structure}" уже назначен лидер:\n\n` +
            existingLeader.leader
        );

        return;
    }

    try {

        await api("/api/leaders", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                structure,
                leader,
                vk,
                start_date,
                end_date
            })
        });

        closeModal();

        await loadData();

        if (typeof renderOrganizations === "function") {
            loadDeputies()
    .then(() => {
        renderOrganizations();
    })
    .catch(error => {
        console.error(
            "Ошибка инициализации заместителей:",
            error
        );

        renderOrganizations();
    });
        }

        alert("Лидер успешно добавлен");

    } catch (error) {

        alert(
            error.message ||
            "Не удалось добавить лидера"
        );
    }
}

function emptyRow(columns, text) {

    return `
        <tr>
            <td colspan="${columns}"
                style="
                    text-align:center;
                    color:#8d929b;
                    padding:35px
                ">
                ${escapeHTML(text)}
            </td>
        </tr>
    `;
}

function closeModal() {

    $("modal")
        .classList.remove("show");
}

$("modal").addEventListener(
    "click",
    event => {

        if (event.target === $("modal")) {
            closeModal();
        }

    }
);

renderOrganizations();

checkAuth();

/* =========================================================
   ARIZONA CIVIL — FINAL UI / NAVIGATION
   ========================================================= */

(() => {

    const pageTitles = {
        dashboard: {
            section: "ARIZONA CIVIL",
            title: "Обзор",
            description: "Центр управления гражданскими структурами"
        },
        organizations: {
            section: "СТРУКТУРЫ",
            title: "Организации",
            description: "Все гражданские структуры сервера"
        },
        leaders: {
            section: "УПРАВЛЕНИЕ",
            title: "Лидеры",
            description: "Контроль лидеров и сроков полномочий"
        },
        penalties: {
            section: "ДИСЦИПЛИНА",
            title: "Наказания",
            description: "Предупреждения и выговоры"
        },
        supervisors: {
            section: "АДМИНИСТРАЦИЯ",
            title: "Следящие",
            description: "ГС, ЗГС и ответственные за структуры"
        },
        journal: {
            section: "ИСТОРИЯ",
            title: "Журнал",
            description: "История действий панели"
        },
        users: {
            section: "SYSTEM",
            title: "Пользователи",
            description: "Управление аккаунтами и доступами"
        }
    };

    function switchPage(pageId) {

        const page =
            document.getElementById(pageId);

        if (!page) return;

        document
            .querySelectorAll(".page")
            .forEach(el => {
                el.classList.remove("active-page");
                el.style.display = "none";
            });

        document
            .querySelectorAll(".nav-item")
            .forEach(el => {
                el.classList.remove("active");
            });

        page.classList.add("active-page");
        page.style.display = "";

        const button =
            document.querySelector(
                `.nav-item[data-page="${pageId}"]`
            );

        if (button) {
            button.classList.add("active");
        }

        const info =
            pageTitles[pageId];

        if (info) {

            const description =
                document.getElementById(
                    "page-description"
                );

            if (description) {
                description.textContent =
                    info.description;
            }

            const mobileTitle =
                document.querySelector(
                    ".mobile-title"
                );

            if (mobileTitle) {
                mobileTitle.textContent =
                    info.title;
            }
        }

        if (pageId === "organizations") {
            if (typeof renderOrganizations === "function") {
                renderOrganizations();
            }
        }

        if (pageId === "leaders") {
            if (typeof loadData === "function") {
                loadData();
            }
        }

        if (pageId === "penalties") {
            if (typeof renderPenalties === "function") {
                renderPenalties();
            }
        }

        if (pageId === "supervisors") {
            loadSupervisors();
        }

        if (pageId === "journal") {
            loadJournal();
        }

        if (pageId === "users" && level() >= 100) {
            loadUsers();
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    window.switchPage =
        switchPage;

    /*
     * Capture phase.
     * Перехватываем старый обработчик,
     * чтобы страницы больше не показывали dashboard.
     */

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".nav-item[data-page]"
                );

            if (!button) return;

            const page =
                button.dataset.page;

            if (!document.getElementById(page)) {
                return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();

            switchPage(page);

        },
        true
    );

})();


/* =========================================================
   SUPERVISORS — MODERN UI
   ========================================================= */

async function loadSupervisors() {

    try {

        const list =
            await api("/api/supervisors");

        const container =
            $("supervisor-list");

        if (!container) return;

        container.innerHTML =
            list.length
                ? `
                    <div class="supervisors-modern-grid">

                        ${list.map(supervisorCard).join("")}

                    </div>
                  `
                : `
                    <div class="supervisors-empty">

                        <div class="empty-neon-icon">
                            ♟
                        </div>

                        <h3>Следящих пока нет</h3>

                        <p>
                            Добавьте первого ответственного
                            за гражданские структуры.
                        </p>

                        ${
                            level() >= 20
                            ? `
                                <button
                                    class="gold-btn"
                                    onclick="openSupervisorModal()">
                                    + Добавить следящего
                                </button>
                              `
                            : ""
                        }

                    </div>
                  `;

    } catch (error) {

        console.error(error);

        const container =
            $("supervisor-list");

        if (container) {
            container.innerHTML = `
                <div class="supervisors-empty">
                    <div class="empty-neon-icon">!</div>
                    <h3>Не удалось загрузить следящих</h3>
                    <p>${escapeHTML(error.message || "")}</p>
                </div>
            `;
        }
    }
}


function supervisorCard(s) {

    const role =
        s.role || "Пользователь";

    const position =
        s.position || "Следящий";

    const isDeveloper =
        level() >= 100;

    return `

        <article class="supervisor-modern-card">

            <div class="supervisor-card-glow"></div>

            <div class="supervisor-modern-top">

                <div class="supervisor-modern-avatar">
                    ${escapeHTML(
                        (s.name || "?")
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>

                <div class="supervisor-modern-name">

                    <span>
                        СЛЕДЯЩИЙ
                    </span>

                    <h3>
                        ${escapeHTML(s.name)}
                    </h3>

                </div>

                <div class="supervisor-live">
                    <i></i>
                    ACTIVE
                </div>

            </div>

            <div class="supervisor-modern-divider"></div>

            <div class="supervisor-data">

                <div>

                    <span>ДОЛЖНОСТЬ</span>

                    <strong>
                        ${escapeHTML(position)}
                    </strong>

                </div>

                <div>

                    <span>СИСТЕМНАЯ РОЛЬ</span>

                    <strong class="neon-role">
                        ${escapeHTML(role)}
                    </strong>

                </div>

            </div>

            ${
                level() >= 20
                ? `
                    <div class="supervisor-actions">

                        <button
                            class="supervisor-edit-btn"
                            onclick="editSupervisor(${Number(s.id)})">

                            ✎ Изменить

                        </button>

                        <button
                            class="supervisor-delete-btn"
                            onclick="deleteSupervisor(${Number(s.id)}, '${escapeHTML(s.name)}')">

                            🗑 Удалить

                        </button>

                    </div>
                  `
                : ""
            }

        </article>
    `;
}


/* =========================================================
   SUPERVISOR MODAL
   ========================================================= */

function openSupervisorModal(supervisor = null) {

    const editing =
        Boolean(supervisor);

    const positions = [

        "ГС ГОС",

        "ЗГС ГОС",

        "ГС гражданских",

        "ЗГС гражданских",

        "Следящий за Правительством",

        "Следящий за ГЦЛ",

        "Следящий за СМИ",

        "Следящий за Страховой компанией",

        "Следящий за больницами",

        "Следящий за Прокуратурой",

        "Следящий за Адвокатурой",

        "Следящий за Конгрессом",

        "Следящий за Пожарным департаментом"

    ];

    $("modal-content").innerHTML = `

        <div class="neon-modal-header">

            <span>
                ${editing
                    ? "УПРАВЛЕНИЕ"
                    : "АДМИНИСТРАЦИЯ"}
            </span>

            <h2>
                ${editing
                    ? "Изменить следящего"
                    : "Новый следящий"}
            </h2>

            <p>
                ${editing
                    ? "Изменение полномочий и должности"
                    : "Добавление ответственного"}
            </p>

        </div>

        <form id="supervisor-modern-form">

            <div class="modern-form-group">

                <label>Имя / ник</label>

                <input
                    id="supervisor-name"
                    value="${editing
                        ? escapeHTML(supervisor.name)
                        : ""}"
                    placeholder="Nick_Name"
                    required>

            </div>

            <div class="modern-form-group">

                <label>Должность</label>

                <select id="supervisor-position">

                    ${positions.map(position => `

                        <option
                            value="${escapeHTML(position)}"
                            ${
                                editing &&
                                supervisor.position === position
                                    ? "selected"
                                    : ""
                            }>

                            ${escapeHTML(position)}

                        </option>

                    `).join("")}

                </select>

            </div>

            ${
                level() >= 100
                ? `
                    <div class="modern-form-group">

                        <label>
                            Системная роль
                        </label>

                        <select id="supervisor-role">

                            ${Object.keys(ROLE_LEVEL)
                                .map(role => `

                                    <option
                                        value="${escapeHTML(role)}"
                                        ${
                                            editing &&
                                            supervisor.role === role
                                                ? "selected"
                                                : ""
                                        }>

                                        ${escapeHTML(role)}

                                    </option>

                                `)
                                .join("")}

                        </select>

                    </div>
                  `
                : ""
            }

            <button
                class="gold-btn supervisor-submit"
                type="submit">

                ${
                    editing
                        ? "Сохранить изменения"
                        : "Создать следящего"
                }

            </button>

        </form>
    `;

    $("modal").classList.add("show");

    $("supervisor-modern-form")
        .addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                const name =
                    $("supervisor-name")
                        .value
                        .trim();

                const position =
                    $("supervisor-position")
                        .value;

                if (!name) {

                    alert(
                        "Введите имя или ник"
                    );

                    return;
                }

                const body = {
                    name,
                    position
                };

                const roleElement =
                    $("supervisor-role");

                if (roleElement) {
                    body.role =
                        roleElement.value;
                }

                try {

                    await api(
                        editing
                            ? `/api/supervisors/${Number(supervisor.id)}`
                            : "/api/supervisors",
                        {
                            method:
                                editing
                                    ? "PATCH"
                                    : "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify(body)
                        }
                    );

                    closeModal();

                    await loadSupervisors();

                } catch (error) {

                    alert(
                        error.message ||
                        "Ошибка сохранения"
                    );
                }

            }
        );
}


/* =========================================================
   EDIT SUPERVISOR
   ========================================================= */

async function editSupervisor(id) {

    try {

        const list =
            await api("/api/supervisors");

        const supervisor =
            list.find(
                x =>
                    Number(x.id) ===
                    Number(id)
            );

        if (!supervisor) {

            alert(
                "Следящий не найден"
            );

            return;
        }

        openSupervisorModal(
            supervisor
        );

    } catch (error) {

        alert(
            error.message ||
            "Ошибка загрузки"
        );
    }
}


/* =========================================================
   DELETE SUPERVISOR
   ========================================================= */

async function deleteSupervisor(
    id,
    name
) {

    const confirmed =
        confirm(
            `Удалить следящего «${name}»?`
        );

    if (!confirmed) return;

    try {

        await api(
            `/api/supervisors/${Number(id)}`,
            {
                method: "DELETE"
            }
        );

        await loadSupervisors();

    } catch (error) {

        alert(
            error.message ||
            "Не удалось удалить следящего"
        );
    }
}


/* =========================================================
   INITIAL PAGE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        document
            .querySelectorAll(".page")
            .forEach((page, index) => {

                if (
                    page.id === "dashboard"
                ) {

                    page.classList.add(
                        "active-page"
                    );

                    page.style.display =
                        "";

                } else {

                    page.classList.remove(
                        "active-page"
                    );

                    page.style.display =
                        "none";
                }

            });

        const dashboard =
            document.querySelector(
                '[data-page="dashboard"]'
            );

        if (dashboard) {
            dashboard.classList.add(
                "active"
            );
        }

    }
);



/* =========================================================
   NAVIGATION FIX — MIAMI
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const navItems =
        document.querySelectorAll(".nav-item[data-page]");

    const pages =
        document.querySelectorAll(".page");

    navItems.forEach(button => {

        button.addEventListener("click", () => {

            const pageId =
                button.dataset.page;

            if (!pageId) return;

            pages.forEach(page => {

                page.classList.remove("active-page");

                page.style.display = "none";

            });

            navItems.forEach(item => {

                item.classList.remove("active");

            });

            const page =
                document.getElementById(pageId);

            if (!page) return;

            page.style.display = "";

            page.classList.add("active-page");

            button.classList.add("active");

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

        });

    });

});



/* ============================================================
   ARIZONA CIVIL — FINAL SUPERVISOR MODAL
============================================================ */

function openSupervisorModal(supervisor = null) {

    const editing = !!supervisor;

    const positions = [
        "Следящий за Гражд. структурой",
        "Следящий за Пра-во, Конгрессом, Партиями",
        "Следящий за судом и адвокатурой",
        "Следящий за СФФД и ГЦЛ",
        "Следящий за МЗ и СМИ",
        "Спец. следящий за ЦА"
    ];

    $("modal-content").innerHTML = `
        <div class="neon-modal-head">
            <span>УПРАВЛЕНИЕ</span>
            <h2>${editing ? "Редактирование следящего" : "Новый следящий"}</h2>
            <p>${editing ? "Изменение данных сотрудника" : "Добавление ответственного сотрудника"}</p>
        </div>

        <form id="final-supervisor-form">

            <div class="form-group">
                <label>Имя / Nick_Name</label>
                <input
                    id="final-supervisor-name"
                    value="${editing ? escapeHTML(supervisor.name || "") : ""}"
                    placeholder="Введите ник"
                    autocomplete="off"
                    required>
            </div>

            <div class="form-group">
                <label>Должность</label>

                <select id="final-supervisor-position">

                    ${positions.map(position => `
                        <option
                            value="${escapeHTML(position)}"
                            ${editing && supervisor.position === position ? "selected" : ""}>
                            ${escapeHTML(position)}
                        </option>
                    `).join("")}

                </select>
            </div>

            <div class="neon-form-actions">

                <button
                    type="button"
                    class="secondary-btn"
                    onclick="closeModal()">
                    Отмена
                </button>

                <button
                    type="submit"
                    class="gold-btn">
                    ${editing ? "Сохранить изменения" : "Добавить следящего"}
                </button>

            </div>

        </form>
    `;

    $("modal").classList.add("show");

    $("final-supervisor-form").addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const name =
                $("final-supervisor-name").value.trim();

            const position =
                $("final-supervisor-position").value;

            if (!name) {
                alert("Введите имя или ник");
                return;
            }

            try {

                await api(
                    editing
                        ? `/api/supervisors/${Number(supervisor.id)}`
                        : "/api/supervisors",
                    {
                        method: editing ? "PATCH" : "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            name,
                            position
                        })
                    }
                );

                closeModal();
                await loadSupervisors();

            } catch (error) {

                alert(
                    error.message ||
                    "Не удалось сохранить следящего"
                );
            }
        }
    );
}

/* ============================================================
   FINAL SUPERVISOR ACTIONS
============================================================ */

async function editSupervisor(id) {

    const list =
        await api("/api/supervisors");

    const supervisor =
        list.find(
            x => Number(x.id) === Number(id)
        );

    if (!supervisor) {
        alert("Следящий не найден");
        return;
    }

    openSupervisorModal(supervisor);
}

async function deleteSupervisor(id) {

    const list =
        await api("/api/supervisors");

    const supervisor =
        list.find(
            x => Number(x.id) === Number(id)
        );

    if (!supervisor) {
        alert("Следящий не найден");
        return;
    }

    if (
        !confirm(
            `Удалить следящего "${supervisor.name}"?`
        )
    ) {
        return;
    }

    try {

        await api(
            `/api/supervisors/${Number(id)}`,
            {
                method: "DELETE"
            }
        );

        await loadSupervisors();

    } catch (error) {

        alert(
            error.message ||
            "Не удалось удалить следящего"
        );
    }
}

/* ============================================================
   FINAL SUPERVISOR LIST
============================================================ */

async function loadSupervisors() {

    try {

        const list =
            await api("/api/supervisors");

        const container =
            $("supervisor-list");

        if (!container) return;

        container.innerHTML =
            list.length
                ? list.map(s => `
                    <div class="supervisor-row neon-supervisor-row">

                        <div class="supervisor-main">

                            <div class="supervisor-avatar">
                                ${escapeHTML(
                                    (s.name || "?")
                                        .charAt(0)
                                        .toUpperCase()
                                )}
                            </div>

                            <div>

                                <div class="supervisor-name">
                                    ${escapeHTML(s.name)}
                                </div>

                                <div class="supervisor-position">
                                    ${escapeHTML(s.position || "Следящий")}
                                </div>

                            </div>

                        </div>

                        <div class="supervisor-actions">

                            <button
                                class="secondary-btn"
                                onclick="editSupervisor(${Number(s.id)})">
                                Изменить
                            </button>

                            <button
                                class="danger-btn"
                                onclick="deleteSupervisor(${Number(s.id)})">
                                Удалить
                            </button>

                        </div>

                    </div>
                `).join("")
                : `
                    <div class="empty-state">
                        <div>★</div>
                        <h3>Следящих пока нет</h3>
                        <p>Добавьте первого ответственного сотрудника.</p>
                    </div>
                `;

    } catch (error) {

        console.error(error);
    }
}


/* ADD DEPUTY BUTTON */

document.addEventListener("DOMContentLoaded", () => {

    const button = $("add-deputy-btn");

    if (button) {
        button.addEventListener(
            "click",
            openDeputyModal
        );
    }

});


/* ARIZONA_LEADERS_BOOT */
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await loadData();

        console.log(
            "👑 Лидеры после загрузки:",
            Array.isArray(leaders) ? leaders.length : 0
        );

        if (typeof renderLeaders === "function") {
            renderLeaders();
        }

        if (typeof renderOrganizations === "function") {
            renderOrganizations();
        }

    } catch (error) {
        console.error(
            "❌ Ошибка загрузки PostgreSQL:",
            error
        );
    }
});


/* =========================================================
   ARIZONA CIVIL 2.0 — SUPERVISORS FINAL UI
   Старые должности и данные сохраняются.
========================================================= */

let supervisorAssistantsV2 = [];

async function loadSupervisorAssistantsV2() {
    try {
        const result =
            await api("/api/supervisor-assistants");

        supervisorAssistantsV2 =
            Array.isArray(result)
                ? result
                : [];

        return supervisorAssistantsV2;

    } catch (error) {
        console.error(
            "Ошибка загрузки помощников:",
            error
        );

        supervisorAssistantsV2 = [];

        return [];
    }
}

function supervisorAvatarV2(person) {

    const avatar =
        person?.avatar_url || "";

    if (avatar) {
        return `
            <img
                class="supervisor-v2-avatar-img"
                src="${escapeHTML(avatar)}"
                alt="${escapeHTML(person?.name || "")}"
                onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
            >
            <span class="supervisor-v2-avatar-fallback">
                ${escapeHTML(
                    (person?.name || "?")
                        .charAt(0)
                        .toUpperCase()
                )}
            </span>
        `;
    }

    return `
        <span class="supervisor-v2-avatar-fallback">
            ${escapeHTML(
                (person?.name || "?")
                    .charAt(0)
                    .toUpperCase()
            )}
        </span>
    `;
}

function supervisorV2Card(s) {

    const assistants =
        supervisorAssistantsV2.filter(
            a =>
                Number(a.supervisor_id) ===
                Number(s.id)
        );

    const canManage =
        typeof level === "function" &&
        level() >= 20;

    return `
        <article class="supervisor-v2-card">

            <div class="supervisor-v2-card-glow"></div>

            <div class="supervisor-v2-head">

                <div class="supervisor-v2-avatar">
                    ${supervisorAvatarV2(s)}
                </div>

                <div class="supervisor-v2-person">

                    <div class="supervisor-v2-label">
                        СЛЕДЯЩИЙ
                    </div>

                    <h3>
                        ${escapeHTML(s.name || "—")}
                    </h3>

                    <div class="supervisor-v2-position">
                        ${escapeHTML(
                            s.position || "Следящий"
                        )}
                    </div>

                </div>

                <div class="supervisor-v2-status">
                    <span></span>
                    ACTIVE
                </div>

            </div>

            ${
                s.vk
                    ? `
                        <div class="supervisor-v2-vk-wrap">
                            ${vkLink(s.vk)}
                        </div>
                      `
                    : ""
            }

            <div class="supervisor-v2-divider"></div>

            <div class="supervisor-v2-assistants">

                <div class="supervisor-v2-assistants-title">

                    <span>
                        ПОМОЩНИКИ
                    </span>

                    <b>
                        ${assistants.length}
                    </b>

                </div>

                ${
                    assistants.length
                        ? assistants.map(
                            assistant =>
                                supervisorAssistantV2(
                                    assistant,
                                    canManage
                                )
                          ).join("")
                        : `
                            <div class="supervisor-v2-no-assistants">
                                Помощники не назначены
                            </div>
                          `
                }

            </div>

            ${
                canManage
                    ? `
                        <div class="supervisor-v2-actions">

                            <button
                                class="supervisor-v2-btn"
                                onclick="openSupervisorV2Modal(${Number(s.id)})">
                                ✎ Изменить
                            </button>

                            <button
                                class="supervisor-v2-btn supervisor-v2-btn-assistant"
                                onclick="openAssistantV2Modal(${Number(s.id)})">
                                + Помощник
                            </button>

                        </div>
                      `
                    : ""
            }

        </article>
    `;
}

function supervisorAssistantV2(a, canManage) {

    return `
        <div class="supervisor-v2-assistant">

            <div class="supervisor-v2-assistant-avatar">
                ${supervisorAvatarV2(a)}
            </div>

            <div class="supervisor-v2-assistant-info">

                <strong>
                    ${escapeHTML(a.name || "—")}
                </strong>

                <span>
                    ${escapeHTML(
                        a.position ||
                        "Помощник следящего"
                    )}
                </span>

                ${
                    a.vk
                        ? `
                            <small>
                                ${vkLink(a.vk)}
                            </small>
                          `
                        : ""
                }

            </div>

            ${
                canManage
                    ? `
                        <div class="supervisor-v2-assistant-actions">

                            <button
                                onclick="openAssistantV2EditModal(${Number(a.id)})">
                                ✎
                            </button>

                            <button
                                onclick="deleteAssistantV2(${Number(a.id)}, '${escapeHTML(a.name || "")}')">
                                🗑
                            </button>

                        </div>
                      `
                    : ""
            }

        </div>
    `;
}

/*
 * Финальная версия загрузки страницы следящих.
 * Переопределяет старые функции UI, API остаётся совместимым.
 */
async function loadSupervisors() {

    const container =
        $("supervisor-list");

    if (!container) return;

    try {

        await loadSupervisorAssistantsV2();

        const list =
            await api("/api/supervisors");

        if (!Array.isArray(list) || !list.length) {

            container.innerHTML = `
                <div class="supervisors-v2-empty">

                    <div class="supervisor-v2-empty-icon">
                        ◈
                    </div>

                    <h3>
                        Следящих пока нет
                    </h3>

                    <p>
                        Добавьте первого ответственного
                        за гражданскую структуру.
                    </p>

                    ${
                        level() >= 20
                            ? `
                                <button
                                    class="gold-btn"
                                    onclick="openSupervisorV2Modal()">
                                    + Добавить следящего
                                </button>
                              `
                            : ""
                    }

                </div>
            `;

            return;
        }

        container.innerHTML = `
            <div class="supervisors-v2">

                <div class="supervisors-v2-title">

                    <div>
                        <span>ARIZONA CIVIL</span>
                        <h2>Следящие</h2>
                    </div>

                    <div class="supervisors-v2-count">
                        ${list.length}
                        <small>следящих</small>
                    </div>

                </div>

                <div class="supervisors-v2-grid">

                    ${list.map(supervisorV2Card).join("")}

                </div>

            </div>
        `;

    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="supervisors-v2-empty">

                <div class="supervisor-v2-empty-icon">
                    !
                </div>

                <h3>
                    Ошибка загрузки
                </h3>

                <p>
                    ${escapeHTML(
                        error.message ||
                        "Не удалось получить список следящих"
                    )}
                </p>

            </div>
        `;
    }
}

function supervisorOptionsV2(selected = null) {

    const list =
        typeof supervisorsData !== "undefined" &&
        Array.isArray(supervisorsData)
            ? supervisorsData
            : [];

    return list.map(s => `
        <option
            value="${Number(s.id)}"
            ${
                Number(selected) === Number(s.id)
                    ? "selected"
                    : ""
            }>
            ${escapeHTML(s.name || "Следящий")}
            — ${escapeHTML(
                s.position || "Следящий"
            )}
        </option>
    `).join("");
}

async function openSupervisorV2Modal(id = null) {

    let supervisor = null;

    if (id) {
        const list =
            await api("/api/supervisors");

        supervisor =
            list.find(
                s =>
                    Number(s.id) === Number(id)
            );
    }

    const editing =
        Boolean(supervisor);

    $("modal-content").innerHTML = `

        <div class="neon-modal-header">

            <span>
                ARIZONA CIVIL 2.0
            </span>

            <h2>
                ${
                    editing
                        ? "Изменение следящего"
                        : "Новый следящий"
                }
            </h2>

            <p>
                Управление ответственным
                гражданской структуры
            </p>

        </div>

        <form id="supervisor-v2-form">

            <div class="modern-form-group">

                <label>Имя / Nick_Name</label>

                <input
                    id="supervisor-v2-name"
                    value="${
                        editing
                            ? escapeHTML(
                                supervisor.name || ""
                              )
                            : ""
                    }"
                    placeholder="Nick_Name"
                    required>

            </div>

            <div class="modern-form-group">

                <label>Должность</label>

                <select id="supervisor-v2-position">

                    ${
                        [
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
                            "Следящий за Пожарным департаментом"
                        ].map(position => `
                            <option
                                value="${escapeHTML(position)}"
                                ${
                                    editing &&
                                    supervisor.position === position
                                        ? "selected"
                                        : ""
                                }>
                                ${escapeHTML(position)}
                            </option>
                        `).join("")
                    }

                </select>

            </div>

            <div class="modern-form-group">

                <label>VK</label>

                <input
                    id="supervisor-v2-vk"
                    value="${
                        editing
                            ? escapeHTML(
                                supervisor.vk || ""
                              )
                            : ""
                    }"
                    placeholder="id123456 / screen_name">

            </div>

            <div class="modern-form-group">

                <label>URL аватара</label>

                <input
                    id="supervisor-v2-avatar"
                    value="${
                        editing
                            ? escapeHTML(
                                supervisor.avatar_url || ""
                              )
                            : ""
                    }"
                    placeholder="https://...">

            </div>

            <button
                type="submit"
                class="gold-btn supervisor-submit">

                ${
                    editing
                        ? "Сохранить изменения"
                        : "Создать следящего"
                }

            </button>

        </form>
    `;

    $("modal").classList.add("show");

    $("supervisor-v2-form").onsubmit =
        async event => {

            event.preventDefault();

            const body = {
                name:
                    $("supervisor-v2-name")
                        .value.trim(),

                position:
                    $("supervisor-v2-position")
                        .value,

                vk:
                    $("supervisor-v2-vk")
                        .value.trim(),

                avatar_url:
                    $("supervisor-v2-avatar")
                        .value.trim()
            };

            try {

                await api(
                    editing
                        ? `/api/supervisors/${Number(supervisor.id)}`
                        : "/api/supervisors",
                    {
                        method:
                            editing
                                ? "PATCH"
                                : "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(body)
                    }
                );

                closeModal();

                await loadSupervisors();

            } catch (error) {

                alert(
                    error.message ||
                    "Ошибка сохранения"
                );
            }
        };
}

async function openAssistantV2Modal(supervisorId) {

    const supervisors =
        await api("/api/supervisors");

    const supervisor =
        supervisors.find(
            s =>
                Number(s.id) ===
                Number(supervisorId)
        );

    if (!supervisor) {
        alert("Следящий не найден");
        return;
    }

    $("modal-content").innerHTML = `

        <div class="neon-modal-header">

            <span>
                ARIZONA CIVIL 2.0
            </span>

            <h2>
                Новый помощник
            </h2>

            <p>
                Следящий:
                <strong>
                    ${escapeHTML(
                        supervisor.name
                    )}
                </strong>
            </p>

        </div>

        <form id="assistant-v2-form">

            <div class="modern-form-group">

                <label>Имя / Nick_Name</label>

                <input
                    id="assistant-v2-name"
                    placeholder="Nick_Name"
                    required>

            </div>

            <div class="modern-form-group">

                <label>Должность</label>

                <select id="assistant-v2-position">

                    <option>
                        Помощник следящего
                    </option>

                    <option>
                        Старший помощник следящего
                    </option>

                </select>

            </div>

            <div class="modern-form-group">

                <label>VK</label>

                <input
                    id="assistant-v2-vk"
                    placeholder="id123456 / screen_name">

            </div>

            <div class="modern-form-group">

                <label>URL аватара</label>

                <input
                    id="assistant-v2-avatar"
                    placeholder="https://...">

            </div>

            <button
                type="submit"
                class="gold-btn supervisor-submit">

                Создать помощника

            </button>

        </form>
    `;

    $("modal").classList.add("show");

    $("assistant-v2-form").onsubmit =
        async event => {

            event.preventDefault();

            try {

                await api(
                    "/api/supervisor-assistants",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                supervisor_id:
                                    Number(supervisorId),

                                name:
                                    $("assistant-v2-name")
                                        .value.trim(),

                                position:
                                    $("assistant-v2-position")
                                        .value,

                                vk:
                                    $("assistant-v2-vk")
                                        .value.trim(),

                                avatar_url:
                                    $("assistant-v2-avatar")
                                        .value.trim()
                            })
                    }
                );

                closeModal();

                await loadSupervisors();

            } catch (error) {

                alert(
                    error.message ||
                    "Ошибка создания помощника"
                );
            }
        };
}

async function openAssistantV2EditModal(id) {

    const list =
        await api(
            "/api/supervisor-assistants"
        );

    const assistant =
        list.find(
            a =>
                Number(a.id) === Number(id)
        );

    if (!assistant) {
        alert("Помощник не найден");
        return;
    }

    const supervisors =
        await api("/api/supervisors");

    $("modal-content").innerHTML = `

        <div class="neon-modal-header">

            <span>
                ARIZONA CIVIL 2.0
            </span>

            <h2>
                Изменить помощника
            </h2>

            <p>
                Управление полномочиями
            </p>

        </div>

        <form id="assistant-v2-edit-form">

            <div class="modern-form-group">

                <label>Имя / Nick_Name</label>

                <input
                    id="assistant-edit-name"
                    value="${escapeHTML(
                        assistant.name || ""
                    )}"
                    required>

            </div>

            <div class="modern-form-group">

                <label>Следящий</label>

                <select id="assistant-edit-supervisor">

                    ${
                        supervisors.map(
                            s => `
                                <option
                                    value="${Number(s.id)}"
                                    ${
                                        Number(
                                            assistant.supervisor_id
                                        ) ===
                                        Number(s.id)
                                            ? "selected"
                                            : ""
                                    }>
                                    ${escapeHTML(
                                        s.name
                                    )}
                                </option>
                            `
                        ).join("")
                    }

                </select>

            </div>

            <div class="modern-form-group">

                <label>Должность</label>

                <select id="assistant-edit-position">

                    <option
                        ${
                            assistant.position ===
                            "Помощник следящего"
                                ? "selected"
                                : ""
                        }>
                        Помощник следящего
                    </option>

                    <option
                        ${
                            assistant.position ===
                            "Старший помощник следящего"
                                ? "selected"
                                : ""
                        }>
                        Старший помощник следящего
                    </option>

                </select>

            </div>

            <div class="modern-form-group">

                <label>VK</label>

                <input
                    id="assistant-edit-vk"
                    value="${escapeHTML(
                        assistant.vk || ""
                    )}">

            </div>

            <div class="modern-form-group">

                <label>URL аватара</label>

                <input
                    id="assistant-edit-avatar"
                    value="${escapeHTML(
                        assistant.avatar_url || ""
                    )}">

            </div>

            <button
                type="submit"
                class="gold-btn supervisor-submit">

                Сохранить изменения

            </button>

        </form>
    `;

    $("modal").classList.add("show");

    $("assistant-v2-edit-form").onsubmit =
        async event => {

            event.preventDefault();

            try {

                await api(
                    `/api/supervisor-assistants/${Number(id)}`,
                    {
                        method: "PATCH",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                name:
                                    $("assistant-edit-name")
                                        .value.trim(),

                                supervisor_id:
                                    Number(
                                        $("assistant-edit-supervisor")
                                            .value
                                    ),

                                position:
                                    $("assistant-edit-position")
                                        .value,

                                vk:
                                    $("assistant-edit-vk")
                                        .value.trim(),

                                avatar_url:
                                    $("assistant-edit-avatar")
                                        .value.trim()
                            })
                    }
                );

                closeModal();

                await loadSupervisors();

            } catch (error) {

                alert(
                    error.message ||
                    "Ошибка сохранения"
                );
            }
        };
}

async function deleteAssistantV2(id, name) {

    if (
        !confirm(
            `Удалить помощника «${name}»?`
        )
    ) {
        return;
    }

    try {

        await api(
            `/api/supervisor-assistants/${Number(id)}`,
            {
                method: "DELETE"
            }
        );

        await loadSupervisors();

    } catch (error) {

        alert(
            error.message ||
            "Ошибка удаления"
        );
    }
}



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

        container.innerHTML = `
            <div class="supervisors-v201">

                ${supervisors
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
        `;

    } catch (error) {

        container.innerHTML = `
            <div class="supervisors-empty">

                <h3>
                    Не удалось загрузить следящих
                </h3>

                <p>
                    ${escapeHTML(
                        error.message || ""
                    )}
                </p>

            </div>
        `;
    }
}


function supervisorCardV201(
    supervisor,
    assistants
) {

    const avatar =
        supervisor.avatar_url
            ? `
                <img
                    src="${escapeHTML(
                        supervisor.avatar_url
                    )}">
              `
            : escapeHTML(
                (
                    supervisor.name ||
                    "?"
                )
                .charAt(0)
                .toUpperCase()
            );

    return `
        <article class="supervisor-v201-card">

            <div class="supervisor-v201-header">

                <div class="supervisor-v201-avatar">
                    ${avatar}
                </div>

                <div class="supervisor-v201-title">

                    <small>
                        СЛЕДЯЩИЙ
                    </small>

                    <h3>
                        ${escapeHTML(
                            supervisor.name ||
                            "—"
                        )}
                    </h3>

                    <span>
                        ${escapeHTML(
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
                        ${escapeHTML(
                            supervisor.vk ||
                            "Не указан"
                        )}
                    </span>
                </div>

                <div>
                    <small>ПОМОЩНИКОВ</small>
                    <span>
                        ${assistants.length}
                    </span>
                </div>

            </div>


            <section class="supervisor-v201-assistants">

                <div class="supervisor-v201-section-title">
                    ПОМОЩНИКИ
                </div>

                ${
                    assistants.length
                        ? assistants
                            .map(
                                assistant =>
                                    assistantCardV201(
                                        assistant
                                    )
                            )
                            .join("")
                        : `
                            <div class="supervisor-v201-empty">
                                Помощников нет
                            </div>
                          `
                }

            </section>


            <div class="supervisor-v201-actions">

                ${
                    Number(
                        typeof level === "function"
                            ? level()
                            : 0
                    ) >= 10
                        ? `
                            <button
                                onclick="openAssistantV201(
                                    ${Number(supervisor.id)}
                                )">
                                ＋ Помощник
                            </button>
                          `
                        : ""
                }

            </div>

        </article>
    `;
}


function assistantCardV201(
    assistant
) {

    const avatar =
        assistant.avatar_url
            ? `
                <img
                    src="${escapeHTML(
                        assistant.avatar_url
                    )}">
              `
            : escapeHTML(
                (
                    assistant.name ||
                    "?"
                )
                .charAt(0)
                .toUpperCase()
            );

    return `
        <div class="supervisor-v201-assistant">

            <div class="supervisor-v201-assistant-avatar">
                ${avatar}
            </div>

            <div class="supervisor-v201-assistant-data">

                <strong>
                    ${escapeHTML(
                        assistant.name
                    )}
                </strong>

                <span>
                    ${CIVIL_ASSISTANT_POSITION}
                </span>

                <small>
                    VK:
                    ${escapeHTML(
                        assistant.vk ||
                        "—"
                    )}
                </small>

            </div>

            ${
                Number(
                    typeof level === "function"
                        ? level()
                        : 0
                ) >= 10
                    ? `
                        <button
                            onclick="editAssistantV201(
                                ${Number(assistant.id)}
                            )">
                            ✎
                        </button>

                        <button
                            onclick="deleteAssistantV201(
                                ${Number(assistant.id)}
                            )">
                            🗑
                        </button>
                      `
                    : ""
            }

        </div>
    `;
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

    $("modal-content").innerHTML = `

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
                    value="${escapeHTML(
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
    `;

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

    $("modal-content").innerHTML = `

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
                    value="${escapeHTML(
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
                    value="${escapeHTML(
                        assistant.vk || ""
                    )}">

            </div>


            <div class="modern-form-group">

                <label>
                    Avatar URL
                </label>

                <input
                    id="assistant-v201-avatar"
                    value="${escapeHTML(
                        assistant.avatar_url || ""
                    )}">

            </div>


            <div class="modern-form-group">

                <label>
                    Следящий
                </label>

                <select
                    id="assistant-v201-owner">

                    ${supervisors
                        .map(
                            supervisor =>
                                `
                                    <option
                                        value="${Number(
                                            supervisor.id
                                        )}"
                                        ${
                                            Number(
                                                supervisor.id
                                            ) ===
                                            Number(
                                                assistant.supervisor_id
                                            )
                                                ? "selected"
                                                : ""
                                        }>

                                        ${escapeHTML(
                                            supervisor.name
                                        )}

                                    </option>
                                `
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
    `;

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

        $("modal-content").innerHTML = `

            <div class="neon-modal-header">

                <span>
                    ARIZONA CIVIL
                </span>

                <h2>
                    Управление ролью
                </h2>

                <p>
                    ${escapeHTML(
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

                        ${FINAL_ASSIGNABLE_ROLES
                            .map(
                                role =>
                                    `
                                    <option
                                        value="${escapeHTML(
                                            role
                                        )}"
                                        ${
                                            user.role === role
                                                ? "selected"
                                                : ""
                                        }>

                                        ${escapeHTML(
                                            role
                                        )}

                                    </option>
                                    `
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

        `;

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
                            `/api/users/${Number(
                                user.id
                            )}/role-assignment`,
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

        root.innerHTML = `
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
                            ${escapeHTML(
                                window.currentUser?.role ||
                                "Авторизован"
                            )}
                        </span>

                    </div>

                    <div class="v3-dashboard">

                        <div class="v3-stat">
                            <span>Всего пользователей</span>
                            <strong>
                                ${dashboard.users?.total || 0}
                            </strong>
                        </div>

                        <div class="v3-stat">
                            <span>Активных</span>
                            <strong>
                                ${dashboard.users?.active || 0}
                            </strong>
                        </div>

                        <div class="v3-stat">
                            <span>Назначений</span>
                            <strong>
                                ${dashboard.appointments?.count || 0}
                            </strong>
                        </div>

                        <div class="v3-stat">
                            <span>Организаций</span>
                            <strong>
                                ${dashboard.organizations?.length || 0}
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

                        ${personnel.map(v3PersonnelCard).join("")}

                    </div>

                </div>

            </div>
        `;

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

        root.innerHTML = `
            <div class="v3-empty">
                Не удалось загрузить Arizona Civil 3.0
                <br>
                ${escapeHTML(error.message || "")}
            </div>
        `;
    }
}


function v3PersonnelCard(user) {

    const avatar =
        user.avatar_url
            ? `
                <img
                    class="v3-avatar"
                    src="${escapeHTML(user.avatar_url)}"
                    alt="">
              `
            : `
                <div class="v3-avatar">
                    ${escapeHTML(
                        (user.username || "?")
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>
              `;

    return `
        <article class="v3-person-card">

            <div class="v3-person-top">

                ${avatar}

                <div>

                    <div class="v3-person-name">
                        ${escapeHTML(
                            user.name ||
                            user.username ||
                            "—"
                        )}
                    </div>

                    <div class="v3-person-role">
                        ${escapeHTML(
                            user.role || "Пользователь"
                        )}
                    </div>

                </div>

            </div>

            <div class="v3-person-meta">

                <div>
                    <span>Логин</span>
                    <strong>
                        ${escapeHTML(
                            user.username || "—"
                        )}
                    </strong>
                </div>

                <div>
                    <span>Организация</span>
                    <strong>
                        ${escapeHTML(
                            user.organization || "—"
                        )}
                    </strong>
                </div>

                <div>
                    <span>VK</span>
                    <strong>
                        ${escapeHTML(
                            user.vk || "—"
                        )}
                    </strong>
                </div>

                <div>
                    <span>Статус</span>
                    <strong>
                        ${user.active
                            ? "Активен"
                            : "Неактивен"}
                    </strong>
                </div>

            </div>

            <div class="v3-actions">

                <button
                    class="v3-btn"
                    onclick="openV3PersonnelProfile(
                        ${Number(user.id)}
                    )">
                    Профиль
                </button>

            </div>

        </article>
    `;
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
                `
                    <div class="v3-section">

                        <h2>
                            ${escapeHTML(
                                data.user.name ||
                                data.user.username
                            )}
                        </h2>

                        <p>
                            ${escapeHTML(
                                data.user.role
                            )}
                        </p>

                        <hr>

                        <h3>
                            История
                        </h3>

                        ${data.history.length
                            ? data.history.map(
                                item => `
                                    <div class="v3-person-meta">
                                        <strong>
                                            ${escapeHTML(
                                                item.action
                                            )}
                                        </strong>
                                        <span>
                                            ${escapeHTML(
                                                item.details || ""
                                            )}
                                        </span>
                                        <span>
                                            ${escapeHTML(
                                                item.actor || ""
                                            )}
                                        </span>
                                    </div>
                                `
                            ).join("")
                            : "<p>Истории пока нет</p>"
                        }

                    </div>
                `
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
