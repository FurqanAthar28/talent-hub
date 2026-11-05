// Every backend address in ONE place.
// The proxy adds "/api/backend" in front, so "/accounts/me/" becomes
// "/api/backend/accounts/me/" in the browser.
export const API_ROUTES = {
  ACCOUNTS: {
    SIGNUP: "/accounts/signup/",
    SIGNIN: "/accounts/signin/",
    REFRESH: "/accounts/refresh/",
    LOGOUT: "/accounts/logout/",
    ME: "/accounts/me/",
    CSRF: "/accounts/csrf/",
    EMAIL_VERIFICATION_REQUEST: "/accounts/email-verification/request/",
    EMAIL_VERIFICATION_CONFIRM: "/accounts/email-verification/confirm/",
    PASSWORD_RESET_REQUEST: "/accounts/password-reset/request/",
    PASSWORD_RESET_CONFIRM: "/accounts/password-reset/confirm/",
  },

  PROFILES: {
    ME: "/profiles/me/",
    UPDATE_ME: "/profiles/me/update/",
  },
};
