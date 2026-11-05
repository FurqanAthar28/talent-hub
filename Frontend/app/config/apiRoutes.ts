/**
 * Every BACKEND address in ONE place.
 *
 * The browser calls them through our Next.js proxy, which adds
 * "/api/backend" in front: "/accounts/me/" -> "/api/backend/accounts/me/".
 *
 * Addresses that need an id are small functions:
 *   API_ROUTES.PROFILES.USER(5) -> "/profiles/5/"
 *
 * Why here and not in the database (UiContent)? An admin can edit
 * database texts at any time. One typo there would break whole pages.
 * Addresses belong to the code.
 */
type Id = number | string;

export const API_ROUTES = {
  ACCOUNTS: {
    SIGNUP: "/accounts/signup/",
    SIGNIN: "/accounts/signin/",
    REFRESH: "/accounts/refresh/",
    LOGOUT: "/accounts/logout/",
    ME: "/accounts/me/",
    CSRF: "/accounts/csrf/",
    DELETE_ACCOUNT: "/accounts/delete-account/",
    EMAIL_VERIFICATION_REQUEST: "/accounts/email-verification/request/",
    EMAIL_VERIFICATION_CONFIRM: "/accounts/email-verification/confirm/",
    PASSWORD_RESET_REQUEST: "/accounts/password-reset/request/",
    PASSWORD_RESET_CONFIRM: "/accounts/password-reset/confirm/",
  },

  APP_CONFIG: {
    UI_CONTENT: "/app-config/ui-content/",
  },

  PROFILES: {
    // --- My own profile ---
    ME: "/profiles/me/",
    UPDATE_ME: "/profiles/me/update/",
    ACTIVITIES: "/profiles/activities/",
    SKILLS: "/profiles/skills/",
    SKILL_OPTIONS: "/profiles/skills/options/",
    SKILL_ADD: "/profiles/skills/add/",
    SKILL_DELETE: (skillId: Id) => `/profiles/skills/${skillId}/delete/`,
    PROJECTS: "/profiles/projects/",
    PROJECT_ADD: "/profiles/projects/add/",
    PROJECT_UPDATE: (projectId: Id) => `/profiles/projects/${projectId}/update/`,
    PROJECT_DELETE: (projectId: Id) => `/profiles/projects/${projectId}/delete/`,
    EXPERIENCES: "/profiles/experiences/",
    EXPERIENCE_ADD: "/profiles/experiences/add/",
    EXPERIENCE_UPDATE: (experienceId: Id) =>
      `/profiles/experiences/${experienceId}/update/`,
    EXPERIENCE_DELETE: (experienceId: Id) =>
      `/profiles/experiences/${experienceId}/delete/`,

    // --- Someone else's profile (by their USER id) ---
    USER: (userId: Id) => `/profiles/${userId}/`,
    USER_SKILLS: (userId: Id) => `/profiles/${userId}/skills/`,
    USER_PROJECTS: (userId: Id) => `/profiles/${userId}/projects/`,
    USER_EXPERIENCES: (userId: Id) => `/profiles/${userId}/experiences/`,
    TRACK_VIEW: (userId: Id) => `/profiles/${userId}/view/`,
  },

  CONNECTIONS: {
    USERS: "/connections/users/",
    MY_CONNECTIONS: "/connections/my-connections/",
    PENDING: "/connections/pending/",
    SENT: "/connections/sent/",
    SEND: "/connections/send/",
    ACCEPT: "/connections/accept/",
    REJECT: "/connections/reject/",
    CONVERSATIONS: "/connections/conversations/",
    START_CONVERSATION: "/connections/conversations/start/",
    CONVERSATION_MESSAGES: (conversationId: Id) =>
      `/connections/conversations/${conversationId}/messages/`,
  },

  RECRUITER: {
    SUMMARY: "/recruiter/summary/",
    CANDIDATES: "/recruiter/candidates/",
    CANDIDATE: (userId: Id) => `/recruiter/candidates/${userId}/`,
  },

  ADMIN: {
    STATS: "/admin/stats/",
    ME: "/admin/me/", // the signed-in admin's own numbers (profile page)
    USERS: "/admin/users/",
    USER_STATUS: (userId: Id) => `/admin/users/${userId}/status/`,
    USER_ROLE: (userId: Id) => `/admin/users/${userId}/role/`,
    RECRUITER_VERIFICATION: (userId: Id) =>
      `/admin/users/${userId}/recruiter-verification/`,
    CONNECTIONS: "/admin/connections/",
    CONNECT_USERS: "/admin/connect-users/",
    DISCONNECT_USERS: "/admin/disconnect-users/",
    AUDIT_LOGS: "/admin/audit-logs/",
    UI_CONTENT: "/admin/ui-content/",
    UI_CONTENT_ITEM: (key: string) =>
      `/admin/ui-content/${encodeURIComponent(key)}/`,
  },
};
