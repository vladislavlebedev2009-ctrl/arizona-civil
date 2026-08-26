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

    async function apiOrg(url, options = {}) {

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
                data.error || `Ошибка ${response.status}`
            );
        }

        return data;
    }

    let orgs = [];
    let leaders = [];
    let deputies = [];
    let penalties = [];

    /* =========================================
       LOAD
    ========================================= */

    async function loadOrganizationsFix() {

        try {

            const data =
                await apiOrg("/api/data");

            orgs =
                data.organizations ||
                data.organizations_list ||
                [];

            leaders =
                data.leaders ||
                [];

            deputies =
                data.deputies ||
                [];

            penalties =
                data.penalties ||
                [];

        } catch (error) {

            console.warn(
                "Не удалось получить общий data:",
                error.message
            );

            try {
                leaders =
                    await apiOrg("/api/leaders");
            } catch (_) {
                leaders = [];
            }

            try {
                deputies =
                    await apiOrg("/api/deputies");
            } catch (_) {
                deputies = [];
            }

            try {
                penalties =
                    await apiOrg("/api/penalties");
            } catch (_) {
                penalties = [];
            }

            if (
                typeof window.organizations !== "undefined" &&
                Array.isArray(window.organizations)
            ) {
                orgs = window.organizations;
            }
        }

        if (!orgs.length) {

            orgs = [
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
        }

        renderOrganizationsFix();
    }

    /* =========================================
       CARD
    ========================================= */

    function getLeader(org) {

        return leaders.find(
            x =>
                x.structure === org ||
                x.organization === org
        );
    }

    function getDeputies(org) {

        return deputies.filter(
            x =>
                x.structure === org ||
                x.organization === org
        );
    }

    function getPenalties(org) {

        return penalties.filter(
            x =>
                x.structure === org ||
                x.organization === org
        );
    }

    function renderOrganizationsFix(filter = "") {

        const container =
            $("all-organizations") ||
            $("organizations-list");

        if (!container) return;

        const search =
            filter.trim().toLowerCase();

        const filtered =
            orgs.filter(org =>
                String(org)
                    .toLowerCase()
                    .includes(search)
            );

        container.innerHTML =
            filtered.length
                ? filtered.map((org, index) => {

                    const leader =
                        getLeader(org);

                    const deputyList =
                        getDeputies(org);

                    const penaltyList =
                        getPenalties(org);

                    const letter =
                        String(org)
                            .trim()
                            .charAt(0)
                            .toUpperCase();

                    const leaderName =
                        leader?.leader ||
                        leader?.name ||
                        "Не назначен";

                    const endDate =
                        leader?.end_date ||
                        "—";

                    return `
                        <article
                            class="miami-org-card"
                            data-organization="${esc(org)}"
                            onclick="openOrganization('${esc(org)}')">

                            <div class="miami-org-glow"></div>

                            <div class="miami-org-header">

                                <div class="miami-org-icon">
                                    ${esc(letter)}
                                </div>

                                <div class="miami-org-title">

                                    <div class="miami-org-label">
                                        CIVIL STRUCTURE
                                    </div>

                                    <h3>
                                        ${esc(org)}
                                    </h3>

                                </div>

                                <div class="miami-org-arrow">
                                    →
                                </div>

                            </div>

                            <div class="miami-org-line"></div>

                            <div class="miami-org-stats">

                                <div>
                                    <span>ЛИДЕР</span>
                                    <strong>
                                        ${esc(leaderName)}
                                    </strong>
                                </div>

                                <div>
                                    <span>ЗАМЕСТИТЕЛИ</span>
                                    <strong>
                                        ${deputyList.length}
                                    </strong>
                                </div>

                                <div>
                                    <span>НАКАЗАНИЯ</span>
                                    <strong>
                                        ${penaltyList.length}
                                    </strong>
                                </div>

                            </div>

                            <div class="miami-org-footer">

                                <span>
                                    Срок до:
                                    ${esc(endDate)}
                                </span>

                                <b>
                                    ОТКРЫТЬ
                                </b>

                            </div>

                        </article>
                    `;

                }).join("")
                : `
                    <div class="miami-empty">
                        <div>⌕</div>
                        <h3>Организация не найдена</h3>
                        <p>Попробуйте изменить поисковый запрос.</p>
                    </div>
                `;
    }

    /* =========================================
       ORGANIZATION MODAL
    ========================================= */

    window.openOrganization = function(org) {

        const leader =
            getLeader(org);

        const deputyList =
            getDeputies(org);

        const penaltyList =
            getPenalties(org);

        const modal =
            $("modal");

        const content =
            $("modal-content");

        if (!modal || !content) {

            alert(
                "Модальное окно не найдено"
            );

            return;
        }

        content.innerHTML = `

            <div class="organization-modal">

                <div class="organization-modal-top">

                    <div class="organization-modal-icon">
                        ${esc(
                            String(org)
                                .charAt(0)
                                .toUpperCase()
                        )}
                    </div>

                    <div>

                        <div class="miami-org-label">
                            CIVIL STRUCTURE
                        </div>

                        <h2>
                            ${esc(org)}
                        </h2>

                    </div>

                </div>

                <div class="org-modal-section">

                    <div class="org-section-title">
                        👑 ЛИДЕР
                    </div>

                    ${
                        leader
                            ? `
                                <div class="org-person">

                                    <div>
                                        <strong>
                                            ${esc(
                                                leader.leader ||
                                                leader.name ||
                                                "—"
                                            )}
                                        </strong>

                                        <span>
                                            ${esc(
                                                leader.vk ||
                                                "VK не указан"
                                            )}
                                        </span>
                                    </div>

                                    <div class="org-date">
                                        ${esc(
                                            leader.start_date ||
                                            "—"
                                        )}
                                        →
                                        ${esc(
                                            leader.end_date ||
                                            "—"
                                        )}
                                    </div>

                                </div>
                            `
                            : `
                                <div class="org-empty">
                                    Лидер не назначен
                                </div>
                            `
                    }

                </div>

                <div class="org-modal-section">

                    <div class="org-section-title">
                        👥 ЗАМЕСТИТЕЛИ
                    </div>

                    ${
                        deputyList.length
                            ? deputyList.map(d => `

                                <div class="org-person">

                                    <div>
                                        <strong>
                                            ${esc(
                                                d.name ||
                                                d.deputy ||
                                                "—"
                                            )}
                                        </strong>

                                        <span>
                                            ${esc(
                                                d.vk ||
                                                "VK не указан"
                                            )}
                                        </span>
                                    </div>

                                    <button
                                        class="danger-btn"
                                        onclick="deleteDeputyOrg(${Number(d.id)}, '${esc(org)}')">
                                        Удалить
                                    </button>

                                </div>

                            `).join("")
                            : `
                                <div class="org-empty">
                                    Заместителей пока нет
                                </div>
                            `
                    }

                </div>

                <div class="org-modal-section">

                    <div class="org-section-title">
                        ⚠️ НАКАЗАНИЯ
                    </div>

                    <div class="org-penalty-number">
                        ${penaltyList.length}
                    </div>

                </div>

                <div class="org-modal-actions">

                    <button
                        class="gold-btn"
                        onclick="addDeputyOrg('${esc(org)}')">
                        + Добавить заместителя
                    </button>

                    ${
                        leader
                            ? `
                                <button
                                    class="ghost-btn"
                                    onclick="openLeaderDaysOrg(${Number(leader.id)}, '${esc(org)}')">
                                    📅 Изменить срок
                                </button>
                            `
                            : ""
                    }

                </div>

            </div>
        `;

        modal.classList.add("show");
    };

    /* =========================================
       ADD DEPUTY
    ========================================= */

    window.addDeputyOrg = function(org) {

        const modal =
            $("modal");

        const content =
            $("modal-content");

        content.innerHTML = `

            <div class="organization-modal">

                <div class="miami-org-label">
                    ${esc(org)}
                </div>

                <h2>
                    Добавить заместителя
                </h2>

                <div class="form-group">

                    <label>Имя / ник</label>

                    <input
                        id="org-deputy-name"
                        placeholder="Nick_Name">

                </div>

                <div class="form-group">

                    <label>VK</label>

                    <input
                        id="org-deputy-vk"
                        placeholder="@id">

                </div>

                <div class="org-modal-actions">

                    <button
                        class="gold-btn"
                        onclick="saveDeputyOrg('${esc(org)}')">
                        Добавить
                    </button>

                    <button
                        class="ghost-btn"
                        onclick="openOrganization('${esc(org)}')">
                        Отмена
                    </button>

                </div>

            </div>
        `;

        modal.classList.add("show");
    };

    window.saveDeputyOrg = async function(org) {

        const name =
            $("org-deputy-name")
                .value
                .trim();

        const vk =
            $("org-deputy-vk")
                .value
                .trim();

        if (!name) {

            alert(
                "Введите имя или ник"
            );

            return;
        }

        try {

            await apiOrg(
                "/api/deputies",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify({
                            structure: org,
                            name,
                            vk
                        })
                }
            );

            await loadOrganizationsFix();

            openOrganization(org);

        } catch (error) {

            alert(error.message);
        }
    };

    /* =========================================
       DELETE DEPUTY
    ========================================= */

    window.deleteDeputyOrg =
        async function(id, org) {

            if (
                !confirm(
                    "Удалить этого заместителя?"
                )
            ) return;

            try {

                await apiOrg(
                    `/api/deputies/${id}`,
                    {
                        method: "DELETE"
                    }
                );

                await loadOrganizationsFix();

                openOrganization(org);

            } catch (error) {

                alert(error.message);
            }
        };

    /* =========================================
       LEADER DAYS
    ========================================= */

    window.openLeaderDaysOrg =
        function(id, org) {

            const modal =
                $("modal");

            const content =
                $("modal-content");

            content.innerHTML = `

                <div class="organization-modal">

                    <div class="miami-org-label">
                        ${esc(org)}
                    </div>

                    <h2>
                        Изменить срок лидера
                    </h2>

                    <div class="form-group">

                        <label>
                            Количество дней
                        </label>

                        <input
                            id="org-leader-days"
                            type="number"
                            placeholder="Например: 7">

                    </div>

                    <div class="org-modal-actions">

                        <button
                            class="gold-btn"
                            onclick="saveLeaderDaysOrg(${id}, '${esc(org)}')">
                            Сохранить
                        </button>

                        <button
                            class="ghost-btn"
                            onclick="openOrganization('${esc(org)}')">
                            Отмена
                        </button>

                    </div>

                </div>
            `;

            modal.classList.add("show");
        };

    window.saveLeaderDaysOrg =
        async function(id, org) {

            const days =
                Number(
                    $("org-leader-days").value
                );

            if (!Number.isInteger(days)) {

                alert(
                    "Введите целое число"
                );

                return;
            }

            try {

                await apiOrg(
                    `/api/leaders/${id}/days`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body:
                            JSON.stringify({
                                days
                            })
                    }
                );

                await loadOrganizationsFix();

                openOrganization(org);

            } catch (error) {

                alert(error.message);
            }
        };

    /* =========================================
       SEARCH
    ========================================= */

    function addSearch() {

        const section =
            $("organizations");

        if (!section) return;

        if (
            section.querySelector(
                "#organization-search"
            )
        ) return;

        const title =
            section.querySelector(
                ".page-title"
            );

        if (!title) return;

        const search =
            document.createElement("div");

        search.className =
            "organization-search-wrap";

        search.innerHTML = `

            <input
                id="organization-search"
                class="organization-search"
                placeholder="⌕  Поиск организации..."
                autocomplete="off">

        `;

        title.appendChild(search);

        $("organization-search")
            .addEventListener(
                "input",
                event =>
                    renderOrganizationsFix(
                        event.target.value
                    )
            );
    }

    /* =========================================
       CSS
    ========================================= */

    const style =
        document.createElement("style");

    style.textContent = `

        .organization-search-wrap {
            min-width: 260px;
        }

        .organization-search {
            width: 100%;
            box-sizing: border-box;
            padding: 14px 18px;
            border-radius: 14px;
            border: 1px solid rgba(255,255,255,.10);
            outline: none;
            background: rgba(255,255,255,.045);
            color: inherit;
            font-size: 14px;
            transition: .2s;
        }

        .organization-search:focus {
            border-color: #00e5ff;
            box-shadow:
                0 0 20px rgba(0,229,255,.12);
        }

        #all-organizations,
        #organizations-list {
            display: grid;
            grid-template-columns:
                repeat(auto-fill, minmax(300px, 1fr));
            gap: 18px;
        }

        .miami-org-card {
            position: relative;
            overflow: hidden;
            padding: 22px;
            min-height: 220px;
            border-radius: 22px;
            cursor: pointer;
            background:
                linear-gradient(
                    145deg,
                    rgba(255,255,255,.065),
                    rgba(255,255,255,.018)
                );
            border: 1px solid rgba(255,255,255,.09);
            transition:
                transform .22s ease,
                border-color .22s ease,
                box-shadow .22s ease;
        }

        .miami-org-card:hover {
            transform: translateY(-5px);
            border-color:
                rgba(0,229,255,.45);
            box-shadow:
                0 12px 45px
                rgba(0,229,255,.10);
        }

        .miami-org-glow {
            position: absolute;
            width: 130px;
            height: 130px;
            right: -50px;
            top: -50px;
            border-radius: 50%;
            background:
                radial-gradient(
                    circle,
                    rgba(255,43,214,.20),
                    transparent 70%
                );
            pointer-events: none;
        }

        .miami-org-header {
            position: relative;
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .miami-org-icon {
            width: 50px;
            height: 50px;
            flex: 0 0 50px;
            display: grid;
            place-items: center;
            border-radius: 15px;
            font-size: 21px;
            font-weight: 900;
            background:
                linear-gradient(
                    135deg,
                    #00e5ff,
                    #ff2bd6
                );
            box-shadow:
                0 0 25px
                rgba(0,229,255,.20);
        }

        .miami-org-title {
            min-width: 0;
            flex: 1;
        }

        .miami-org-label {
            font-size: 10px;
            letter-spacing: 1.8px;
            font-weight: 800;
            color: #00e5ff;
            opacity: .9;
        }

        .miami-org-title h3 {
            margin: 4px 0 0;
            font-size: 17px;
            line-height: 1.25;
        }

        .miami-org-arrow {
            font-size: 25px;
            opacity: .45;
        }

        .miami-org-line {
            height: 1px;
            margin: 20px 0;
            background:
                linear-gradient(
                    90deg,
                    rgba(0,229,255,.25),
                    rgba(255,43,214,.12),
                    transparent
                );
        }

        .miami-org-stats {
            display: grid;
            grid-template-columns:
                1.4fr .8fr .8fr;
            gap: 10px;
        }

        .miami-org-stats div {
            min-width: 0;
        }

        .miami-org-stats span {
            display: block;
            font-size: 9px;
            letter-spacing: 1.2px;
            opacity: .45;
            margin-bottom: 5px;
        }

        .miami-org-stats strong {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 13px;
        }

        .miami-org-footer {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-top: 20px;
            font-size: 11px;
            opacity: .65;
        }

        .miami-org-footer b {
            color: #00e5ff;
            letter-spacing: 1px;
        }

        .miami-empty {
            grid-column: 1 / -1;
            padding: 60px 20px;
            text-align: center;
            opacity: .65;
        }

        .miami-empty div {
            font-size: 42px;
            color: #00e5ff;
        }

        .organization-modal {
            max-width: 650px;
        }

        .organization-modal-top {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 28px;
        }

        .organization-modal-icon {
            width: 58px;
            height: 58px;
            display: grid;
            place-items: center;
            border-radius: 17px;
            font-size: 24px;
            font-weight: 900;
            background:
                linear-gradient(
                    135deg,
                    #00e5ff,
                    #ff2bd6
                );
        }

        .organization-modal h2 {
            margin: 4px 0 0;
        }

        .org-modal-section {
            padding: 18px 0;
            border-top:
                1px solid
                rgba(255,255,255,.08);
        }

        .org-section-title {
            margin-bottom: 13px;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1.4px;
            color: #00e5ff;
        }

        .org-person {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 14px;
            border-radius: 13px;
            background:
                rgba(255,255,255,.035);
        }

        .org-person + .org-person {
            margin-top: 8px;
        }

        .org-person strong {
            display: block;
        }

        .org-person span {
            display: block;
            margin-top: 4px;
            font-size: 12px;
            opacity: .5;
        }

        .org-date {
            font-size: 12px;
            opacity: .55;
        }

        .org-empty {
            padding: 15px;
            border-radius: 13px;
            background:
                rgba(255,255,255,.025);
            opacity: .55;
        }

        .org-penalty-number {
            font-size: 34px;
            font-weight: 900;
        }

        .org-modal-actions {
            display: flex;
            gap: 10px;
            margin-top: 22px;
        }

        .org-modal-actions button {
            flex: 1;
        }

        @media(max-width:700px) {

            .organization-search-wrap {
                min-width: 100%;
            }

            #all-organizations,
            #organizations-list {
                grid-template-columns: 1fr;
            }

            .miami-org-stats {
                grid-template-columns: 1fr 1fr;
            }

            .org-person {
                align-items: flex-start;
                flex-direction: column;
            }

            .org-modal-actions {
                flex-direction: column;
            }

        }

    `;

    document.head.appendChild(style);

    /* =========================================
       START
    ========================================= */

    window.addEventListener(
        "load",
        () => {

            addSearch();

            setTimeout(
                loadOrganizationsFix,
                300
            );

        }
    );

    window.renderOrganizationsFix =
        renderOrganizationsFix;

    window.loadOrganizationsFix =
        loadOrganizationsFix;

})();
