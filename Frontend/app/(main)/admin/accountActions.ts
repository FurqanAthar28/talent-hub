/**
 * The words for each account action, in ONE place: the Users list uses
 * `label`, the "are you sure?" box uses the rest.
 *
 * `reason: true` = the box asks for a reason. The person sees it when they
 * try to sign in, so write it for them ("Fake company details"), not for us.
 */

import type { AccountAction, AccountState } from "@/app/services/admin";

// Must match max_length of `reason` in AccountActionSerializer (Django).
export const REASON_MAX_LENGTH = 255;

type ActionText = {
  label: string;
  title: (name: string) => string;
  text: (graceDays: number) => string;
  confirmLabel: string;
  tone: "danger" | "primary";
  reason: boolean;
};

export const ACCOUNT_ACTION_TEXT: Record<AccountAction, ActionText> = {
  suspend: {
    label: "Suspend",
    title: (name) => `Suspend ${name}?`,
    text: () => "They can't sign in and are hidden from search and the network until you lift it. Nothing is deleted.",
    confirmLabel: "Suspend",
    tone: "danger",
    reason: true,
  },
  unsuspend: {
    label: "Lift suspension",
    title: (name) => `Lift ${name}'s suspension?`,
    text: () => "They can sign in again and show up in the network as before.",
    confirmLabel: "Lift suspension",
    tone: "primary",
    reason: false,
  },
  ban: {
    label: "Ban",
    title: (name) => `Ban ${name}?`,
    text: () => "For serious problems (spam, fraud, abuse). They can't sign in, and their email can't create a new account.",
    confirmLabel: "Ban",
    tone: "danger",
    reason: true,
  },
  unban: {
    label: "Lift ban",
    title: (name) => `Lift ${name}'s ban?`,
    text: () => "They can sign in again, and their email can be used to sign up.",
    confirmLabel: "Lift ban",
    tone: "primary",
    reason: false,
  },
  delete: {
    label: "Delete",
    title: (name) => `Delete ${name}'s account?`,
    text: (days) =>
      `Hidden everywhere right away. Only an admin can restore it, for ${days} days. After that it's deleted for good (profile, CV, messages).`,
    confirmLabel: "Delete",
    tone: "danger",
    reason: true,
  },
  restore: {
    label: "Restore",
    title: (name) => `Restore ${name}'s account?`,
    text: () => "Everything comes back as it was before it was deleted.",
    confirmLabel: "Restore",
    tone: "primary",
    reason: false,
  },
};

/** The status filters above the Users list. */
export const USER_FILTERS = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Waiting for approval" },
  { value: "active", label: "Active" },
  { value: "unverified", label: "Email not confirmed" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
  { value: "deleted", label: "Deleted" },
] as const satisfies readonly { value: "all" | "waiting" | AccountState; label: string }[];

export type UserFilter = (typeof USER_FILTERS)[number]["value"];
