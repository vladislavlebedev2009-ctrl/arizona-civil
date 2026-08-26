/*
=========================================================
 ARIZONA CIVIL 2.2 — PERMISSIONS
=========================================================
*/

const CIVIL_MANAGEMENT_ROLES = [
    "Разработчик",
    "ГС ГОС",
    "ЗГС ГОС",
    "ГС гражданских",
    "ЗГС гражданских"
];

const SUPERVISOR_ROLES = [
    "Разработчик",
    "ГС ГОС",
    "ЗГС ГОС",
    "ГС гражданских",
    "ЗГС гражданских",
    "Следящий"
];

const ASSISTANT_ROLE = "Помощник следящего за гражданской структурой";
const LEADER_ROLE = "Лидер";
const DEPUTY_ROLE = "Заместитель";

function canManagePersonnel(role) {
    return CIVIL_MANAGEMENT_ROLES.includes(role);
}

function canManageSupervisors(role) {
    return SUPERVISOR_ROLES.includes(role);
}

function canAssignLeader(role) {
    return canManagePersonnel(role);
}

function canAssignDeputy(role) {
    return canManagePersonnel(role);
}

function canManageAssistant(role) {
    return [
        "Разработчик",
        "ГС гражданских",
        "ЗГС гражданских",
        "Следящий"
    ].includes(role);
}

function canManageOwnStructure(role) {
    return [
        "Разработчик",
        "ГС ГОС",
        "ЗГС ГОС",
        "ГС гражданских",
        "ЗГС гражданских",
        "Следящий",
        ASSISTANT_ROLE
    ].includes(role);
}


const ROLE_PERMISSIONS_V30 = {

    "Разработчик": [
        "*"
    ],

    "ГС ГОС": [
        "users.view",
        "users.edit",
        "users.assign_leader",
        "users.assign_deputy",
        "leaders.manage",
        "deputies.manage",
        "supervisors.view",
        "organizations.view",
        "history.view"
    ],

    "ЗГС ГОС": [
        "users.view",
        "users.edit",
        "users.assign_leader",
        "users.assign_deputy",
        "leaders.manage",
        "deputies.manage",
        "supervisors.view",
        "organizations.view",
        "history.view"
    ],

    "ГС гражданских": [
        "users.view",
        "users.edit",
        "users.assign_leader",
        "users.assign_deputy",
        "leaders.manage",
        "deputies.manage",
        "supervisors.manage",
        "organizations.view",
        "history.view"
    ],

    "ЗГС гражданских": [
        "users.view",
        "users.edit",
        "users.assign_leader",
        "users.assign_deputy",
        "leaders.manage",
        "deputies.manage",
        "supervisors.manage",
        "organizations.view",
        "history.view"
    ],

    "Следящий": [
        "users.view",
        "organizations.view",
        "history.view"
    ],

    "Помощник следящего за гражданской структурой": [
        "users.view",
        "organizations.view"
    ],

    "Лидер": [
        "users.view",
        "organizations.view"
    ],

    "Заместитель": [
        "users.view",
        "organizations.view"
    ],

    "Пользователь": []
};

function hasPermissionV30(role, permission) {
    const permissions = ROLE_PERMISSIONS_V30[role] || [];

    return (
        permissions.includes("*") ||
        permissions.includes(permission)
    );
}

module.exports = {
    ...module.exports,
    ROLE_PERMISSIONS_V30,
    hasPermissionV30
};
