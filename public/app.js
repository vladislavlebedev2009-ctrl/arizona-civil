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

/* LOGIN */

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

    $("profile-avatar").textContent =
        currentUser.username.charAt(0).toUpperCase();

    applyPermissions();

    loadData();
    loadUsers();
    loadJournal();
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

/* ORGANIZATIONS */

function organizationCard(name) {

    return `
        <div class="org-card">

            <div class="org-top">

                <div class="org-icon">
                    ${escapeHTML(name.charAt(0))}
                </div>

                <div class="org-count">
                    Гражданская структура
                </div>

            </div>

            <h3>${escapeHTML(name)}</h3>

            <p>
                Лидер • Заместители • Срок • Наказания
            </p>

        </div>
    `;
}

function renderOrganizations() {

    $("organization-grid").innerHTML =
        organizations.map(organizationCard).join("");

    $("all-organizations").innerHTML =
        organizations.map(organizationCard).join("");
}

/* LEADERS */

function getDaysLeft(endDate) {

    const end =
        new Date(endDate + "T23:59:59");

    const diff =
        end - new Date();

    return Math.max(
        0,
        Math.ceil(diff / 86400000)
    );
}

function formatDate(date) {

    if (!date) return "—";

    const parts = date.split("-");

    if (parts.length !== 3) return date;

    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function statusHTML(status, endDate) {

    if (
        status !== "Активен" ||
        getDaysLeft(endDate) <= 0
    ) {
        return `<span class="status expired">Завершён</span>`;
    }

    return `<span class="status active">Активен</span>`;
}

function leaderRow(l) {

    return `
        <tr>

            <td>
                <b>${escapeHTML(l.structure)}</b>
            </td>

            <td>${escapeHTML(l.leader)}</td>

            <td>${escapeHTML(l.vk || "—")}</td>

            <td>${formatDate(l.start_date)}</td>

            <td>${formatDate(l.end_date)}</td>

            <td class="days">
                ${getDaysLeft(l.end_date)} дн.
            </td>

            <td>
                ${statusHTML(l.status, l.end_date)}
            </td>

        </tr>
    `;
}

function renderLeaders() {

    $("all-leaders-table").innerHTML =
        leaders.length
            ? leaders.map(leaderRow).join("")
            : emptyRow(7, "Лидеров пока нет");

    $("stat-leaders").textContent =
        leaders.filter(x =>
            x.status === "Активен"
        ).length;

    $("stat-active").textContent =
        leaders.filter(x =>
            x.status === "Активен" &&
            getDaysLeft(x.end_date) > 0
        ).length;

    $("stat-ending").textContent =
        leaders.filter(x => {

            const days =
                getDaysLeft(x.end_date);

            return days > 0 && days <= 7;

        }).length;
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

/* SUPERVISORS */

async function loadSupervisors() {

    try {

        const list =
            await api("/api/supervisors");

        $("supervisor-list").innerHTML =
            list.length
                ? list.map(s => `

                    <div class="supervisor-row">

                        <div>

                            <div class="supervisor-name">
                                ${escapeHTML(s.name)}
                            </div>

                            <div class="supervisor-position">
                                ${escapeHTML(s.position)}
                            </div>

                        </div>

                        <div class="supervisor-org">
                            Следящий
                        </div>

                    </div>

                `).join("")
                : `
                    <div class="empty-state">
                        <div>♟</div>
                        <h3>Следящих пока нет</h3>
                        <p>Добавьте первого следящего.</p>
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

        <div class="form-group">
            <label>Имя / ник</label>
            <input id="supervisor-name"
                   placeholder="Nick_Name">
        </div>

        <div class="form-group">
            <label>Должность</label>

            <select id="supervisor-position">

                <option>
                    Следящий за Правительством
                </option>

                <option>
                    Следящий за ГЦЛ
                </option>

                <option>
                    Следящий за СМИ
                </option>

                <option>
                    Следящий за Страховой компанией
                </option>

                <option>
                    Следящий за больницами
                </option>

                <option>
                    Следящий за Прокуратурой
                </option>

                <option>
                    Следящий за Адвокатурой
                </option>

                <option>
                    Следящий за Конгрессом
                </option>

                <option>
                    Следящий за Пожарным департаментом
                </option>

            </select>
        </div>

        <button
            class="gold-btn"
            style="width:100%"
            onclick="saveSupervisor()">

            Добавить

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

        loadSupervisors();

    } catch (error) {

        alert(error.message);
    }
}

/* USERS */

async function loadUsers() {

    if (level() < 100) return;

    try {

        const users =
            await api("/api/users");

        $("users-table").innerHTML =
            users.map(u => `

                <tr>

                    <td>
                        <b>${escapeHTML(u.username)}</b>
                    </td>

                    <td>
                        ${escapeHTML(u.role)}
                    </td>

                    <td>

                        <select
                            onchange="changeUserRole(${u.id}, this.value)">

                            ${Object.keys(ROLE_LEVEL)
                                .map(role => `
                                    <option
                                        ${role === u.role ? "selected" : ""}>
                                        ${escapeHTML(role)}
                                    </option>
                                `)
                                .join("")}

                        </select>

                    </td>

                </tr>

            `).join("");

    } catch (error) {

        console.error(error);
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

/* JOURNAL */

async function loadJournal() {

    try {

        const journal =
            await api("/api/journal");

        $("journal-table").innerHTML =
            journal.length
                ? journal.map(x => `

                    <tr>

                        <td>
                            ${new Date(x.date)
                                .toLocaleString("ru-RU")}
                        </td>

                        <td>
                            ${escapeHTML(x.actor)}
                        </td>

                        <td>
                            <b>
                                ${escapeHTML(x.action)}
                            </b>
                        </td>

                        <td>
                            ${escapeHTML(x.details)}
                        </td>

                    </tr>

                `).join("")
                : emptyRow(
                    4,
                    "Журнал пока пуст"
                );

    } catch (error) {

        console.error(error);
    }
}

/* ADD LEADER */

$("add-leader-btn").onclick =
    openLeaderModal;

function openLeaderModal() {

    $("modal-content").innerHTML = `

        <h2>Добавить лидера</h2>

        <form id="leader-form">

            <div class="form-group">

                <label>Организация</label>

                <select name="structure" required>

                    <option value="">
                        Выберите организацию
                    </option>

                    ${organizations.map(x =>
                        `<option value="${escapeHTML(x)}">
                            ${escapeHTML(x)}
                        </option>`
                    ).join("")}

                </select>

            </div>

            <div class="form-group">

                <label>Имя / ник лидера</label>

                <input
                    name="leader"
                    required
                    placeholder="Nick_Name">

            </div>

            <div class="form-group">

                <label>VK</label>

                <input
                    name="vk"
                    placeholder="@username">

            </div>

            <div class="form-group">

                <label>Дата начала</label>

                <input
                    type="date"
                    name="start_date"
                    required>

            </div>

            <div class="form-group">

                <label>Дата окончания</label>

                <input
                    type="date"
                    name="end_date"
                    required>

            </div>

            <button
                class="gold-btn"
                style="width:100%">

                Добавить лидера

            </button>

        </form>
    `;

    $("modal").classList.add("show");

    $("leader-form")
        .addEventListener("submit", addLeader);
}

async function addLeader(event) {

    event.preventDefault();

    const data =
        Object.fromEntries(
            new FormData(event.target).entries()
        );

    try {

        await api("/api/leaders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        closeModal();

        loadData();

    } catch (error) {

        alert(error.message);
    }
}

/* NAVIGATION */

document.querySelectorAll(".nav-item")
    .forEach(button => {

        button.addEventListener("click", () => {

            const page =
                button.dataset.page;

            document.querySelectorAll(".nav-item")
                .forEach(x =>
                    x.classList.remove("active")
                );

            button.classList.add("active");

            document.querySelectorAll(".page")
                .forEach(x =>
                    x.classList.remove("active-page")
                );

            $(page)?.classList.add("active-page");

            const descriptions = {

                dashboard:
                    "Панель гражданских структур",

                organizations:
                    "Список организаций",

                leaders:
                    "Контроль руководителей",

                penalties:
                    "Дисциплинарные взыскания",

                supervisors:
                    "ГС, ЗГС и следящие",

                journal:
                    "История действий",

                users:
                    "Управление пользователями"

            };

            $("page-description").textContent =
                descriptions[page] || "";

        });

    });

/* SEARCH */

$("leader-search")
    .addEventListener("input", event => {

        const query =
            event.target.value.toLowerCase();

        const filtered =
            leaders.filter(l =>
                String(l.leader)
                    .toLowerCase()
                    .includes(query) ||

                String(l.structure)
                    .toLowerCase()
                    .includes(query) ||

                String(l.vk)
                    .toLowerCase()
                    .includes(query)
            );

        $("all-leaders-table").innerHTML =
            filtered.length
                ? filtered.map(leaderRow).join("")
                : emptyRow(
                    7,
                    "Ничего не найдено"
                );
    });

/* DATA */

async function loadData() {

    try {

        const stats =
            await api("/api/stats");

        $("stat-leaders").textContent =
            stats.leaders ?? 0;

        $("stat-penalties").textContent =
            stats.penalties ?? 0;

        $("stat-active").textContent =
            stats.active ?? 0;

        $("stat-ending").textContent =
            stats.ending ?? 0;

        leaders =
            await api("/api/leaders");

        penalties =
            await api("/api/penalties");

        renderLeaders();
        renderPenalties();

        loadSupervisors();

    } catch (error) {

        console.error(
            "Ошибка загрузки:",
            error
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
