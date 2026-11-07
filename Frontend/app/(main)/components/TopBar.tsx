"use client";

/**
 * The top bar on every signed-in page, the same for everyone:
 *
 *   computer:  [logo]            [Home] [My network] [Messages] ... [Me ▾]
 *              (icon above the word; the open page has a line under it)
 *   phone:     [logo]                                         [Me ▾]
 *              + a bottom bar with the same links (thumb-friendly)
 *
 * "Me ▾" opens a small menu: your name, View profile, Edit profile, Log out.
 * Admins: no profile links (no Profile in their menu), and no phone bottom
 * bar, because the admin area has its own.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  BriefcaseBusiness,
  ChevronDown,
  Home,
  LogOut,
  MessageSquare,
  Pencil,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

import BrandLogo from "@/app/components/brand/BrandLogo";
import { Avatar, cx } from "@/app/components/ui";
import { ROUTES } from "@/app/config/routes";
import { isAdmin, type CurrentUser } from "../CurrentUserContext";
import styles from "./topbar.module.css";

type TextFn = (key: string, fallback: string) => string;

type Props = {
  user: CurrentUser;
  text: TextFn;
  loggingOut: boolean;
  onLogout: () => void;
};

export default function TopBar({ user, text, loggingOut, onLogout }: Props) {
  const pathname = usePathname();
  const admin = isAdmin(user);
  const name = user.fullName || user.email;

  // The menu, in order. `show` decides who sees each link.
  const links = [
    { href: ROUTES.DASHBOARD, label: text("home", "Home"), icon: Home, show: !admin },
    // `short`: the word under the icon in the phone's bottom bar (6 buttons fit only with short words).
    { href: ROUTES.CONNECTIONS, label: text("myNetwork", "My network"), short: "Network", icon: Users, show: !admin },
    { href: ROUTES.RECRUITER_CANDIDATES, label: "Candidates", icon: BriefcaseBusiness, show: user.role === "recruiter" },
    { href: ROUTES.JOBS, label: text("jobs", "Jobs"), icon: Briefcase, show: !admin },
    { href: ROUTES.MESSAGES, label: text("messages", "Messages"), icon: MessageSquare, show: !admin },
    { href: ROUTES.ADMIN, label: text("admin", "Admin"), icon: ShieldCheck, show: admin },
  ].filter((link) => link.show);

  /** "Profile" stays lit on /profile/edit too; someone else's /profile/5 isn't "mine". */
  function isActive(href: string) {
    if (href === ROUTES.PROFILE) return pathname === ROUTES.PROFILE || pathname.startsWith(ROUTES.PROFILE_EDIT);
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <header className={styles.bar}>
        <div className={styles.inner}>
          <BrandLogo href={admin ? ROUTES.ADMIN : ROUTES.DASHBOARD} />

          <nav className={styles.links} aria-label="Main menu">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cx(styles.link, isActive(href) && styles.linkActive)}
                aria-current={isActive(href) ? "page" : undefined}
              >
                <Icon size={21} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          <AccountMenu
            showProfileLinks={!admin}
            name={name}
            headline={user.role === "admin" ? "Super admin" : user.role === "recruiter" ? "Recruiter" : "Candidate"}
            active={isActive(ROUTES.PROFILE)}
            text={text}
            loggingOut={loggingOut}
            onLogout={onLogout}
          />
        </div>
      </header>

      {/* Phones: the same links at the bottom, plus Profile. */}
      {!admin && (
        <nav className={styles.tabBar} aria-label="Main menu">
          {[...links, { href: ROUTES.PROFILE, label: "Profile", icon: UserRound }].map((link) => {
            const { href, icon: Icon } = link;
            const label = "short" in link && link.short ? link.short : link.label;
            return (
            <Link
              key={href}
              href={href}
              className={cx(styles.tab, isActive(href) && styles.tabActive)}
              aria-current={isActive(href) ? "page" : undefined}
            >
              <span className={styles.tabIcon}>
                <Icon size={20} aria-hidden="true" />
              </span>
              {label}
            </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}

/** "Me ▾": your name and the account links. Closes on Escape or a click outside. */
function AccountMenu({
  showProfileLinks,
  name,
  headline,
  active,
  text,
  loggingOut,
  onLogout,
}: {
  showProfileLinks: boolean;
  name: string;
  headline: string;
  active: boolean;
  text: TextFn;
  loggingOut: boolean;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Close after moving to another page. (Set during render when the page changes,
  // instead of in an effect, so React doesn't draw the open menu twice.)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.account} ref={boxRef}>
      <button
        ref={buttonRef}
        type="button"
        className={cx(styles.me, active && styles.linkActive)}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={name} size={28} />
        <span className={styles.meLabel}>
          Me <ChevronDown size={14} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.who}>
            <Avatar name={name} size={44} />
            <div>
              <strong>{name}</strong>
              <span>{headline}</span>
            </div>
          </div>
          {showProfileLinks && (
            <>
              <Link href={ROUTES.PROFILE} className={styles.item}>
                <UserRound size={17} aria-hidden="true" /> View profile
              </Link>
              <Link href={ROUTES.PROFILE_EDIT} className={styles.item}>
                <Pencil size={17} aria-hidden="true" /> Edit profile
              </Link>
            </>
          )}
          <hr className={styles.divider} />
          <button type="button" className={styles.item} onClick={onLogout} disabled={loggingOut}>
            <LogOut size={17} aria-hidden="true" />
            {loggingOut ? text("loggingOut", "Logging out...") : text("logout", "Log out")}
          </button>
        </div>
      )}
    </div>
  );
}
