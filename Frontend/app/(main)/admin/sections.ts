/**
 * The admin sections, in ONE list: the sidebar, the phone's bottom bar and
 * the page header all read from here. To add a section, add it here.
 *
 *   group   -> which heading it sits under in the sidebar
 *   onPhone -> true: its own button in the bottom bar; false: under "More"
 */

import { Activity, Flag, LayoutDashboard, Link2, type LucideIcon, Type, UserCheck, Users } from "lucide-react";

export const SECTION_IDS = ["overview", "approvals", "reports", "users", "connections", "activity", "texts"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export type Section = {
  id: SectionId;
  label: string;
  /** One line under the title: what you do here. */
  intro: string;
  icon: LucideIcon;
  group: "Manage" | "Records" | "Settings";
  onPhone: boolean;
};

export const SECTIONS: Section[] = [
  {
    id: "overview",
    label: "Overview",
    intro: "What needs you today, and how the network is growing.",
    icon: LayoutDashboard,
    group: "Manage",
    onPhone: true,
  },
  {
    id: "approvals",
    label: "Approvals",
    intro: "New candidates and recruiters stay hidden until you approve them.",
    icon: UserCheck,
    group: "Manage",
    onPhone: true,
  },
  {
    id: "reports",
    label: "Reports",
    intro: "Profiles and messages people reported. Dismiss, suspend or ban.",
    icon: Flag,
    group: "Manage",
    onPhone: true,
  },
  {
    id: "users",
    label: "Users",
    intro: "Every account. Change roles, suspend, ban, delete or restore.",
    icon: Users,
    group: "Manage",
    onPhone: true,
  },
  {
    id: "connections",
    label: "Connections",
    intro: "Connect two people by hand, or remove a connection.",
    icon: Link2,
    group: "Manage",
    onPhone: false, // under "More" on phones, so the bottom bar keeps 4 buttons + More
  },
  {
    id: "activity",
    label: "Activity log",
    intro: "Everything admins changed, newest first. Entries can't be edited.",
    icon: Activity,
    group: "Records",
    onPhone: false,
  },
  {
    id: "texts",
    label: "Page texts",
    intro: "Change the wording of buttons, messages and emails without code.",
    icon: Type,
    group: "Settings",
    onPhone: false,
  },
];

export const SECTION_GROUPS = ["Manage", "Records", "Settings"] as const;

export const sectionById = (id: SectionId) => SECTIONS.find((section) => section.id === id) ?? SECTIONS[0];

/** The section named in the address (/admin?tab=users), so links and refreshes land in the right place. */
export function sectionFromAddress(): SectionId | null {
  const wanted = new URLSearchParams(window.location.search).get("tab");
  return SECTION_IDS.find((id) => id === wanted) ?? null;
}

/** Put the section in the address without reloading (so Refresh and Back keep your place). */
export function showSectionInAddress(id: SectionId) {
  const url = new URL(window.location.href);
  if (id === "overview") url.searchParams.delete("tab");
  else url.searchParams.set("tab", id);
  window.history.replaceState(null, "", url);
}
