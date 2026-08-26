(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    const esc = value =>
        String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    async function apiFix(url, options = {}) {
        const response = await fetch(url, {
            credentials: "include",
            ...options,
            headers: {
                ...(options.headers || {})
            }
        });

        let data = {};

        try {
            data = await response.json();
        } catch (_) {}

        if (!response.ok) {
            throw new Error(
                data.error ||
                `Ошибка ${response.status}`
            );
        }

        return data;
    }

    /* =========================================
       NAVIGATION
    ========================================= */

    function showPage(pageName) {

        document.querySelectorAll(".page").forEach(page => {
            page.classList.remove("active-page");
            page.style.display = "none";
        });

        const page = document.getElementById(pageName);

        if (!page) {
            console.warn("Страница не найдена:", pageName);
            return;
        }

        page.classList.add("active-page");
        page.style.display = "";

        document.querySelectorAll(".nav-item").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.page === pageName
            );
        });

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        if (pageName === "supervisors") {
            loadSupervisorsFix();
        }

        if (pageName === "users" &&
            typeof window.loadUsers === "function") {
            window.loadUsers();
        }

        if (pageName === "journal" &&
            typeof window.loadJournal === "function") {
            window.loadJournal();
        }

        if (pageName === "leaders" &&
            typeof window.loadLeaders === "function") {
            window.loadLeaders();
        }

        if (pageName === "organizations" &&
            typeof window.renderOrganizations === "function") {
            window.renderOrganizations();
        }
    }

    document.addEventListener("click", event => {

        const button =
            event.target.closest(".nav-item[data-page]");

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        showPage(button.dataset.page);
    }, true);

    /* =========================================
       SUPERVISORS
    ========================================= */

    async function loadSupervisorsFix() {

        const container = $("supervisor-list");

        if (!container) return;

        try {

            const list =
                await apiFix("/api/supervisors");

            container.innerHTML = list.length
                ? list.map(supervisor => {

                    const id =
                        Number(supervisor.id);

                    return `
                        <div class="supervisor-row neon-supervisor">

                            <div class="supervisor-main">

                                <div class="supervisor-avatar">
                                    ${esc(
                                        supervisor.name
                                            .charAt(0)
                                            .toUpperCase()
                                    )}
                                </div>

                                <div>

                                    <div class="supervisor-name">
                                        ${esc(supervisor.name)}
                                    </div>

                                    <div class="supervisor-position">
                                        ${esc(
                                            supervisor.position ||
                                            "Следящий"
                                        )}
                                    </div>

                                    <div class="supervisor-role">
                                        ${esc(
                                            supervisor.role ||
                                            "Следящий"
                                        )}
                                    </div>

                                </div>

                            </div>

                            <div class="supervisor-actions">

                                <button
                                    class="gold-btn supervisor-edit"
                                    data-id="${id}">
                                    ✎ Изменить
                                </button>

                                <button
                                    class="danger-btn supervisor-delete"
                                    data-id="${id}"
                                    data-name="${esc(supervisor.name)}">
                                    ✕ Удалить
                                </button>

                            </div>

                        </div>
                    `;

                }).join("")
                : `
                    <div class="empty-state neon-empty">
                        <div>♟</div>
                        <h3>Следящих пока нет</h3>
                        <p>Добавьте первого следящего.</p>
                    </div>
                `;

        } catch (error) {

            console.error(error);

            container.innerHTML = `
                <div class="empty-state">
                    <h3>Не удалось загрузить следящих</h3>
                    <p>${esc(error.message)}</p>
                </div>
            `;
        }
    }

    function openSupervisorFix(id = null) {

        const modal = $("modal");
        const content = $("modal-content");

        if (!modal || !content) {
            alert("Окно модального окна не найдено в HTML");
            return;
        }

        apiFix("/api/supervisors")
            .then(list => {

                const item =
                    id === null
                        ? null
                        : list.find(
                            x => Number(x.id) === Number(id)
                        );

                if (id !== null && !item) {
                    throw new Error(
                        "Следящий не найден"
                    );
                }

                const name =
                    item?.name || "";

                const position =
                    item?.position ||
                    "Следящий за Правительством";

                const roles = [
                    "Следящий",
                    "ЗГС гражданских",
                    "ГС гражданских",
                    "ЗГС ГОС",
                    "ГС ГОС"
                ];

                content.innerHTML = `

                    <div class="neon-modal">

                        <div class="modal-kicker">
                            АДМИНИСТРИРОВАНИЕ
                        </div>

                        <h2>
                            ${id === null
                                ? "Добавить следящего"
                                : "Изменить следящего"}
                        </h2>

                        <p class="modal-subtitle">
                            Управление ответственным за гражданские структуры
                        </p>

                        <div class="form-group">

                            <label>Имя / ник</label>

                            <input
                                id="fix-supervisor-name"
                                value="${esc(name)}"
                                placeholder="Nick_Name"
                                autocomplete="off">

                        </div>

                        <div class="form-group">

                            <label>Должность</label>

                            <select id="fix-supervisor-position">

                                <option ${
                                    position ===
                                    "Следящий за Правительством"
                                    ? "selected" : ""
                                }>
                                    Следящий за Правительством
                                </option>

                                <option ${
                                    position ===
                                    "Следящий за ГЦЛ"
                                    ? "selected" : ""
                                }>
                                    Следящий за ГЦЛ
                                </option>

                                <option ${
                                    position ===
                                    "Следящий за СМИ"
                                    ? "selected" : ""
                                }>
                                    Следящий за СМИ
                                </option>

                                <option ${
                                    position ===
                                    "Следящий за Страховой компанией"
                                    ? "selected" : ""
                                }>
                                    Следящий за Страховой компанией
                                </option>

                                <option ${
                                    position ===
                                    "Следящий за больницами"
                                    ? "selected" : ""
                                }>
                                    Следящий за больницами
                                </option>

                                <option ${
                                    position ===
                                    "Следящий за Прокуратурой"
                                    ? "selected" : ""
                                }>
                                    Следящий за Прокуратурой
                                </option>

                                <option ${
                                    position ===
                                    "Следящий за Адвокатурой"
                                    ? "selected" : ""
                                }>
                                    Следящий за Адвокатурой
                                </option>

                                <option ${
                                    position ===
                                    "Следящий за Конгрессом"
                                    ? "selected" : ""
                                }>
                                    Следящий за Конгрессом
                                </option>

                                <option ${
                                    position ===
                                    "Следящий за Пожарным департаментом"
                                    ? "selected" : ""
                                }>
                                    Следящий за Пожарным департаментом
                                </option>

                            </select>

                        </div>

                        <div class="form-group">

                            <label>Роль</label>

                            <select id="fix-supervisor-role">

                                ${roles.map(role => `
                                    <option
                                        value="${esc(role)}"
                                        ${
                                            role ===
                                            (item?.role || "Следящий")
                                                ? "selected"
                                                : ""
                                        }>
                                        ${esc(role)}
                                    </option>
                                `).join("")}

                            </select>

                        </div>

                        <div class="modal-actions">

                            <button
                                class="gold-btn"
                                id="fix-supervisor-save">

                                ${id === null
                                    ? "Добавить"
                                    : "Сохранить"}

                            </button>

                            <button
                                class="ghost-btn"
                                id="fix-supervisor-cancel">

                                Отмена

                            </button>

                        </div>

                    </div>
                `;

                modal.classList.add("show");

                $("fix-supervisor-cancel")
                    ?.addEventListener(
                        "click",
                        () => modal.classList.remove("show")
                    );

                $("fix-supervisor-save")
                    ?.addEventListener(
                        "click",
                        async () => {

                            const newName =
                                $("fix-supervisor-name")
                                    .value
                                    .trim();

                            const newPosition =
                                $("fix-supervisor-position")
                                    .value;

                            const newRole =
                                $("fix-supervisor-role")
                                    .value;

                            if (!newName) {
                                alert(
                                    "Введите имя или ник"
                                );
                                return;
                            }

                            try {

                                if (id === null) {

                                    await apiFix(
                                        "/api/supervisors",
                                        {
                                            method: "POST",
                                            headers: {
                                                "Content-Type":
                                                    "application/json"
                                            },
                                            body:
                                                JSON.stringify({
                                                    name:
                                                        newName,
                                                    position:
                                                        newPosition,
                                                    role:
                                                        newRole
                                                })
                                        }
                                    );

                                } else {

                                    await apiFix(
                                        `/api/supervisors/${id}`,
                                        {
                                            method: "PATCH",
                                            headers: {
                                                "Content-Type":
                                                    "application/json"
                                            },
                                            body:
                                                JSON.stringify({
                                                    name:
                                                        newName,
                                                    position:
                                                        newPosition,
                                                    role:
                                                        newRole
                                                })
                                        }
                                    );

                                }

                                modal.classList.remove("show");

                                loadSupervisorsFix();

                            } catch (error) {

                                alert(
                                    error.message
                                );
                            }
                        }
                    );

            })
            .catch(error => {
                alert(error.message);
            });
    }

    /* =========================================
       ADD BUTTON
    ========================================= */

    document.addEventListener("click", event => {

        if (
            event.target.closest(
                "#add-supervisor-btn"
            )
        ) {

            event.preventDefault();
            event.stopPropagation();

            openSupervisorFix();

        }

    }, true);

    /* =========================================
       EDIT / DELETE
    ========================================= */

    document.addEventListener("click", event => {

        const edit =
            event.target.closest(
                ".supervisor-edit"
            );

        if (edit) {

            event.preventDefault();

            openSupervisorFix(
                Number(edit.dataset.id)
            );

            return;
        }

        const remove =
            event.target.closest(
                ".supervisor-delete"
            );

        if (remove) {

            event.preventDefault();

            const id =
                Number(remove.dataset.id);

            const name =
                remove.dataset.name;

            if (
                !confirm(
                    `Удалить следящего «${name}»?`
                )
            ) return;

            apiFix(
                `/api/supervisors/${id}`,
                {
                    method: "DELETE"
                }
            )
            .then(() => {
                loadSupervisorsFix();
            })
            .catch(error => {
                alert(error.message);
            });
        }

    });

    /* =========================================
       MODAL CLOSE
    ========================================= */

    document.addEventListener("click", event => {

        if (
            event.target.id === "modal-close" ||
            event.target.closest(".modal-close")
        ) {

            $("modal")?.classList.remove("show");

        }

    });

    /* =========================================
       CSS
    ========================================= */

    const style =
        document.createElement("style");

    style.textContent = `

        .page {
            display: none;
            animation: pageIn .25s ease;
        }

        .page.active-page {
            display: block;
        }

        @keyframes pageIn {
            from {
                opacity: 0;
                transform: translateY(8px);
            }

            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .nav-item {
            cursor: pointer;
        }

        .nav-item.active {
            transform: translateX(4px);
        }

        .neon-supervisor {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 20px;
            padding: 20px;
            margin-bottom: 14px;
            border-radius: 18px;
            background:
                linear-gradient(
                    135deg,
                    rgba(255,255,255,.055),
                    rgba(255,255,255,.018)
                );
            border: 1px solid rgba(255,255,255,.09);
            box-shadow:
                0 0 25px rgba(0,220,255,.06);
        }

        .supervisor-main {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .supervisor-avatar {
            width: 48px;
            height: 48px;
            display: grid;
            place-items: center;
            border-radius: 14px;
            font-weight: 800;
            font-size: 20px;
            background:
                linear-gradient(
                    135deg,
                    #00e5ff,
                    #ff2bd6
                );
            color: white;
            box-shadow:
                0 0 22px rgba(0,229,255,.25);
        }

        .supervisor-role {
            margin-top: 5px;
            font-size: 12px;
            opacity: .55;
        }

        .supervisor-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .danger-btn,
        .gold-btn,
        .ghost-btn {
            cursor: pointer;
        }

        .neon-modal {
            padding: 4px;
        }

        .modal-kicker {
            color: #00e5ff;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 2px;
            margin-bottom: 8px;
        }

        .modal-subtitle {
            opacity: .55;
            margin-top: -5px;
            margin-bottom: 22px;
        }

        .modal-actions {
            display: flex;
            gap: 10px;
            margin-top: 22px;
        }

        .modal-actions button {
            flex: 1;
        }

        @media (max-width: 700px) {

            .neon-supervisor {
                align-items: stretch;
                flex-direction: column;
            }

            .supervisor-actions {
                width: 100%;
            }

            .supervisor-actions button {
                flex: 1;
            }

            .modal-actions {
                flex-direction: column;
            }

        }

    `;

    document.head.appendChild(style);

    /* =========================================
       START
    ========================================= */

    window.addEventListener("load", () => {

        const current =
            document.querySelector(
                ".nav-item.active"
            );

        const firstPage =
            current?.dataset.page ||
            "dashboard";

        showPage(firstPage);

        loadSupervisorsFix();

    });

    window.loadSupervisorsFix =
        loadSupervisorsFix;

})();
