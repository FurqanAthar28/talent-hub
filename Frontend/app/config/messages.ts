/**
 * Fixed messages the app shows (not editable by admins).
 * Keeping them here means each message is written only once.
 * Numbers come from constants.ts, so a message can never disagree with the rule.
 */
import { MAX_CV_FILE_SIZE_MB, MIN_PASSWORD_LENGTH } from "./constants";

export const MESSAGES = {
  AUTH: {
    PASSWORDS_DO_NOT_MATCH: "Passwords do not match.",
    PASSWORD_TOO_SHORT: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    CV_REQUIRED: "Please upload your CV (PDF).",
    PDF_ONLY: "Only PDF files are accepted.",
    CV_SIZE_LIMIT: `CV file must be smaller than ${MAX_CV_FILE_SIZE_MB}MB.`,
    SIGNUP_FAILED: "Sign up failed. Please check your details.",
    SIGNIN_FAILED: "Sign in failed. Please try again.",
    MISSING_EMAIL: "Please enter your email.",
    MISSING_NAME_OR_EMAIL: "Please enter your full name and email.",
    LINKEDIN_REQUIRED: "Please add your LinkedIn profile link.",
    COMPANY_REQUIRED: "Please enter your company name.",
    MISSING_EMAIL_AND_PASSWORD: "Please enter your email and password.",
    MISSING_EMAIL_AND_CODE: "Please enter your email and the 6-digit code.",
    INVALID_CODE: "Invalid or expired code.",
  },

  PROFILE: {
    PROJECT_TITLE_REQUIRED: "Project title is required.",
    EXPERIENCE_REQUIRED: "Job title and company are required.",
    SKILL_ALREADY_ADDED: "This skill is already added.",
    LOAD_ERROR: "Something went wrong while loading profile",
    UPDATE_ERROR: "Something went wrong while updating profile",
    NAME_REQUIRED: "Full name is required",
    SIGNIN_REQUIRED: "User data not found. Please sign in again.",
  },

  MESSAGES: {
    LOAD_FAILED: "Couldn't load your messages. Please refresh the page.",
    SEND_FAILED: "Couldn't send your message. Please try again.",
    START_FAILED: "Couldn't start the conversation. Please try again.",
  },

  NETWORK: {
    LOAD_FAILED: "Couldn't load your network. Please refresh the page.",
    REQUEST_SENT: "Connection request sent.",
    REQUEST_FAILED: "Couldn't send the request. Please try again.",
    ACCEPTED: "Request accepted. You're now connected.",
    IGNORED: "Request ignored.",
    UPDATE_FAILED: "Couldn't update the request. Please try again.",
  },

  COMMON: {
    SOMETHING_WENT_WRONG: "Something went wrong. Please try again.",
    SERVER_UNREACHABLE: "Unable to connect to the server. Please try again.",
    LOAD_FAILED: "Couldn't load this list. Please refresh the page.",
    SAVE_FAILED: "Couldn't save. Please check the details and try again.",
    DELETE_FAILED: "Couldn't delete. Please try again.",
    CONFIRM_DELETE: "Delete this item? This can't be undone.",
  },
};
