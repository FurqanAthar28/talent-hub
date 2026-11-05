/**
 * UI texts: every word on the screen that admins can change
 * (buttons, titles, messages...), loaded from Django.
 *
 * HOW TO USE IN A PAGE
 *   const texts = await fetchUiContent();
 *   <h1>{texts.signinWelcome || "Welcome back"}</h1>
 *   Always keep a fallback (the part after ||), so the page still reads
 *   well if a text is missing or an admin cleared it.
 *
 * Page and backend ADDRESSES are NOT texts: they live in
 * config/routes.ts and config/apiRoutes.ts.
 */

import { API_ROUTES } from "../config/apiRoutes";
import { apiFetch } from "./client";

export type UiContent = Record<string, string>;

export class UiContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UiContentError";
  }
}

/**
 * Texts the pages expect. A missing one is NOT an error any more (every
 * page has a fallback). Before, ONE empty text broke the whole app.
 * While developing, missing ones are listed in the browser console.
 */
const EXPECTED_UI_CONTENT_KEYS = [
  "appName",
  "avatarFallbackInitial",
  "contact",
  "connections",
  "cv",
  "editProfile",
  "endDateFallback",
  "experience",
  "forgotPassword",
  "github",
  "home",
  "linkedin",
  "loading",
  "loggingOut",
  "logout",
  "logoutSuccess",
  "myNetwork",
  "portfolio",
  "present",
  "professionalFallback",
  "profile",
  "projects",
  "skills",
  "startDateFallback",
  "viewCv",
  "resetPassword",
  "resetPasswordIntro",
  "email",
  "emailPlaceholder",
  "sendOtp",
  "sendingOtp",
  "otp",
  "otpPlaceholder",
  "newPassword",
  "newPasswordPlaceholder",
  "updatePassword",
  "updatingPassword",
  "backToSignin",
  "otpSentNextStep",
  "passwordResetSuccessRedirect",
  "passwordResetEmailSubject",
  "passwordResetEmailBody",
  "passwordResetEmailSent",
  "passwordResetInvalidOtp",
  "passwordResetUpdated",
  "passwordResetEmailUnavailable",
  "passwordResetCooldown",
  "passwordResetTooManyAttempts",
  "admin",
  "adminDashboard",
  "candidateDashboard",
  "recruiterDashboard",
  "candidateDashboardIntro",
  "recruiterDashboardIntro",
  "adminDashboardIntro",
  "dashboardActions",
  "dashboardLoading",
  "dashboardUnableToLoad",
  "dashboardOpenToWorkUpdateFailed",
  "addProfessionalHeadline",
  "addYourProfessionalHeadline",
  "profileViewers",
  "notAdded",
  "notLooking",
  "openToWork",
  "setOpenToWork",
  "contactInfo",
  "companyContact",
  "adminInfo",
  "profileCompletion",
  "moderation",
  "access",
  "staffControls",
  "adminWorkspace",
  "openAdminDashboard",
  "activity",
  "emptyActivity",
  "professionalProfiles",
  "addLinkedin",
  "addGithub",
  "addPortfolio",
  "uploadCv",
  "complete",
  "completeTheseNext",
  "completeProfile",
  "location",
  "adminIntro",
  "adminUsers",
  "adminActiveUsers",
  "adminInactiveUsers",
  "adminStaffUsers",
  "adminSkills",
  "adminProjects",
  "adminExperiences",
  "adminPendingRequests",
  "adminSearchPlaceholder",
  "adminName",
  "adminJoined",
  "adminLastLogin",
  "adminProfileCompletion",
  "adminContent",
  "adminRole",
  "adminStatus",
  "adminActions",
  "adminStaff",
  "adminMember",
  "adminActive",
  "adminInactive",
  "adminDeactivate",
  "adminActivate",
  "adminUpdating",
  "adminNoUsers",
  "adminAccessDenied",
  "adminUnableToLoad",
  "adminUserNotFound",
  "adminUserRoleUpdated",
  "adminUserStatusUpdated",
  "adminCannotDeactivateSelf",
  "adminInvalidUserStatus",
  "adminNoChangeRequired",
  "adminUiContent",
  "adminUiContentIntro",
  "adminUiContentSearchPlaceholder",
  "adminNoUiContent",
  "adminSaveUiContent",
  "adminSavingUiContent",
  "adminUiContentUpdated",
  "signinWelcome",
  "signinIntro",
  "password",
  "passwordPlaceholder",
  "signin",
  "signingIn",
  "signinMissingFields",
  "signinFailed",
  "serverConnectionError",
  "newToApp",
  "createAccount",
  "role",
  "candidate",
  "recruiter",
  "adminRole",
  "selectRole",
  "adminInvalidUserRole",
  "adminCannotChangeOwnRole",
  "candidateProfile",
  "recruiterProfile",
  "adminProfile",
  "companyInformation",
  "companyName",
  "companyWebsite",
  "companyLocation",
  "hiringTitle",
  "adminTitle",
  "hiringFocus",
  "candidatePortfolio",
  "recruiterContact",
  "adminContact",
  "companyNamePlaceholder",
  "companyWebsitePlaceholder",
  "companyLocationPlaceholder",
  "hiringTitlePlaceholder",
  "adminTitlePlaceholder",
  "recruiterProfileHint",
  "adminProfileHint",
  "adminConnections",
  "adminConnectionManagement",
  "adminConnectionManagementIntro",
  "adminFirstUser",
  "adminSecondUser",
  "adminSelectUser",
  "adminCreateConnection",
  "adminCreatingConnection",
  "adminDisconnect",
  "adminDisconnecting",
  "adminNoConnections",
  "adminConnectionCreated",
  "adminConnectionRemoved",
  "adminInvalidConnectionUsers",
  "adminAuditLogs",
  "adminAuditLogsIntro",
  "adminAuditAction",
  "adminAuditActor",
  "adminAuditTarget",
  "adminAuditTime",
  "adminNoAuditLogs",
  "emailVerificationSubject",
  "emailVerificationBody",
  "emailVerificationSent",
  "emailVerificationRequired",
  "emailVerificationInvalidOtp",
  "emailVerificationTooManyAttempts",
  "emailVerificationCooldown",
  "emailVerificationSuccess",
  "emailAlreadyVerified",
  "verifyEmail",
  "verifyEmailIntro",
  "verifyOtp",
  "verifyingOtp",
  "resendOtp",
  "resendingOtp",
  "adminPendingRecruiters",
  "adminRecruiterVerification",
  "adminRecruiterPending",
  "adminRecruiterApproved",
  "adminRecruiterRejected",
  "adminApproveRecruiter",
  "adminRejectRecruiter",
  "adminVerifyingRecruiter",
  "adminRecruiterVerificationInvalidRole",
  "adminRecruiterVerificationUpdated",
  "recruiterVerificationPendingNotice",
  "recruiterVerificationRejectedNotice",
  "connectionAccept",
  "connectionAccepted",
  "connectionAccepting",
  "connectionConnect",
  "connectionDiscover",
  "connectionIgnoring",
  "connectionIgnore",
  "connectionIntro",
  "connectionLoading",
  "connectionNoConnections",
  "connectionNoReceivedRequests",
  "connectionNoSearchResults",
  "connectionNoSentRequests",
  "connectionReceived",
  "connectionRequestAccepted",
  "connectionRequestFailed",
  "connectionRequestIgnored",
  "connectionRequestSent",
  "connectionSearchPlaceholder",
  "connectionSending",
  "connectionSent",
  "connectionStatusAccepted",
  "connectionStatusAwaitingResponse",
  "connectionStatusConnected",
  "connectionStatusDeclined",
  "connectionStatusIgnored",
  "connectionStatusNotConnected",
  "connectionStatusPending",
  "connectionStatusRequestSent",
  "connectionUnableToLoad",
  "connectionUnableToSend",
  "connectionUnableToUpdate",
  "viewProfile",
  "message",
  "messages",
  "messageInbox",
  "messageIntro",
  "messageNoConversations",
  "messageSelectConversation",
  "messagePlaceholder",
  "messageSend",
  "messageSending",
  "messageUnableToLoad",
  "messageUnableToSend",
  "messageConversationNotFound",
  "messageStartFailed",
  "messageOnlyConnections",
  "messageEmptyThread",
  "messageUnread",
  "messageNewNotification",
  "createAccountTitle",
  "createAccountDescription",
  "fullName",
  "fullNamePlaceholder",
  "headline",
  "headlinePlaceholder",
  "bio",
  "bioPlaceholder",
  "locationPlaceholder",
  "confirmPassword",
  "confirmPasswordPlaceholder",
  "linkedinUrl",
  "linkedinUrlPlaceholder",
  "linkedinProfile",
  "linkedinProfilePlaceholder",
  "githubUrl",
  "githubUrlPlaceholder",
  "portfolioUrl",
  "portfolioUrlPlaceholder",
  "editProfileTitle",
  "editProfileDescription",
  "genericError",
  "cvResume",
  "viewCurrentCv",
  "cvReplaceTitle",
  "cvUploadTitle",
  "cvUploadHint",
  "selectedFileLabel",
  "createAccountButton",
  "creatingAccountButton",
  "alreadyHaveAccount",
  "signIn",
  "cancel",
  "saving",
  "saveChanges",
];

function warnAboutMissingTexts(data: UiContent) {
  if (process.env.NODE_ENV === "production") return;

  const missingKeys = EXPECTED_UI_CONTENT_KEYS.filter((key) => !data[key]);
  if (missingKeys.length > 0) {
    console.warn(
      `[ui-content] ${missingKeys.length} text(s) are missing or empty, so pages show their fallback text:`,
      missingKeys
    );
  }
}

export function getUiContentErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load UI content from backend.";
}

/**
 * The texts are loaded ONCE per browser tab and then reused.
 * Before, the layout AND each page asked for the same ~300 texts on every
 * page change. `loadingTexts` remembers the request, so even two calls at
 * the same moment share one trip to the server.
 */
let loadingTexts: Promise<UiContent> | null = null;

async function downloadUiContent(): Promise<UiContent> {
  const res = await apiFetch(API_ROUTES.APP_CONFIG.UI_CONTENT, undefined, {
    redirectOnUnauthorized: false,
  });

  if (!res.ok) {
    throw new UiContentError(
      `Unable to load UI content from backend. Request failed with status ${res.status}.`
    );
  }

  const data = (await res.json()) as UiContent;
  warnAboutMissingTexts(data);
  return data;
}

export async function fetchUiContent(): Promise<UiContent> {
  if (!loadingTexts) {
    loadingTexts = downloadUiContent().catch((error: unknown) => {
      // Don't remember a FAILED download: try again next time.
      loadingTexts = null;

      if (error instanceof UiContentError) throw error;
      throw new UiContentError(
        `Unable to load UI content from backend. ${
          error instanceof Error ? error.message : "Unknown error."
        }`
      );
    });
  }

  return loadingTexts;
}

/** Forget the saved texts (the admin page calls this after editing one). */
export function clearUiContentCache() {
  loadingTexts = null;
}

/**
 * Pick one text, with an English fallback.
 * The fallback is used while the texts are still loading, if loading
 * failed, or if an admin hasn't filled that text in yet.
 */
export function uiText(content: UiContent, key: string, fallback: string) {
  const value = content[key];

  // A missing text sometimes comes back as its own key ("email"); skip that.
  if (!value || value === key) return fallback;

  return value;
}
