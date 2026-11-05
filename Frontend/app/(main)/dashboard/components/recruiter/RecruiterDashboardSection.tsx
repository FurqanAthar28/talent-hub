"use client";

/**
 * A recruiter's home page.
 * Top: search candidates (the recruiter's main job), with popular skills
 * as one-click shortcuts. If an admin hasn't approved the account yet,
 * a clear status message is shown instead.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Hourglass, Inbox, MessageSquare, Search, ShieldCheck, UserPen, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { ROUTES } from "@/app/config/routes";
import { getRecruiterSummary, type Activity, type RecruiterSummary } from "@/app/services/dashboard";
import type { Profile } from "@/app/services/profiles";
import { getSkillOptions } from "@/app/services/skills";
import styles from "../../dashboard.module.css";
import ActivityTimeline from "../common/ActivityTimeline";
import FactStrip from "../common/FactStrip";
import ProfileReadiness from "../common/ProfileReadiness";
import ShortcutList from "../common/ShortcutList";

// How many popular skills to show under the search box.
const SKILL_SHORTCUT_COUNT = 6;

type RecruiterDashboardProps = {
  profile: Profile;
  activities: Activity[];
};

/** "Your account is being reviewed" / "wasn't approved". */
function VerificationStatus({ profile }: { profile: Profile }) {
  const rejected = profile.recruiterVerificationStatus === "rejected";

  return (
    <section className={`${styles.panel} ${styles.status}`} role="status">
      <span className={`${styles.statusIcon} ${rejected ? styles.statusIconBad : ""}`}>
        {rejected ? <ShieldCheck size={22} aria-hidden="true" /> : <Hourglass size={22} aria-hidden="true" />}
      </span>
      <div>
        <h2 className={styles.searchTitle}>
          {rejected ? "Your recruiter account wasn't approved" : "Your recruiter account is being reviewed"}
        </h2>
        <p className={styles.readinessMeta}>
          {rejected
            ? "Check your company details below, update them, and contact the admin team to be reviewed again."
            : "An admin checks every new recruiter. Candidate search and messaging open as soon as you're approved. Meanwhile, complete your company details."}
        </p>
        {profile.recruiterVerificationNote && (
          <p className={styles.statusNote}>
            <strong>Note from the admin:</strong> {profile.recruiterVerificationNote}
          </p>
        )}
      </div>
    </section>
  );
}

/** The big search box. Sends you to the candidates page with your search filled in. */
function CandidateSearch({ candidatesCount }: { candidatesCount?: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [skills, setSkills] = useState<string[]>([]);

  // Popular skills for the one-click shortcuts.
  useEffect(() => {
    let pageIsOpen = true;
    getSkillOptions()
      .then((list) => {
        if (pageIsOpen) setSkills(list.slice(0, SKILL_SHORTCUT_COUNT));
      })
      .catch(() => {
        // Not important: the search box still works without shortcuts.
      });
    return () => {
      pageIsOpen = false;
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = query.trim();
    router.push(
      search
        ? `${ROUTES.RECRUITER_CANDIDATES}?search=${encodeURIComponent(search)}`
        : ROUTES.RECRUITER_CANDIDATES
    );
  }

  return (
    <section className={`${styles.panel} ${styles.search}`} aria-labelledby="search-title">
      <h2 id="search-title" className={styles.searchTitle}>
        Find your next hire
      </h2>
      <p className={styles.readinessMeta}>
        {candidatesCount === undefined
          ? "Search candidates by skill, name or city."
          : `Search ${candidatesCount} candidates by skill, name or city.`}
      </p>

      <form className={styles.searchForm} onSubmit={handleSubmit} role="search">
        <input
          type="search"
          className={styles.searchInput}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="For example: Django developer in Lahore"
          aria-label="Search candidates"
        />
        <button type="submit" className={styles.searchButton}>
          Search
        </button>
      </form>

      {skills.length > 0 && (
        <div className={styles.chips}>
          <span className={styles.missingLabel}>Popular skills:</span>
          {skills.map((skill) => (
            <Link
              key={skill}
              href={`${ROUTES.RECRUITER_CANDIDATES}?skill=${encodeURIComponent(skill)}`}
              className={styles.chip}
            >
              {skill}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default function RecruiterDashboard({ profile, activities }: RecruiterDashboardProps) {
  const isApproved = profile.recruiterVerificationStatus === "approved";
  const [summary, setSummary] = useState<RecruiterSummary | null>(null);

  // The numbers only exist for approved recruiters (Django says "no" otherwise).
  useEffect(() => {
    if (!isApproved) return;

    let pageIsOpen = true;
    getRecruiterSummary()
      .then((data) => {
        if (pageIsOpen) setSummary(data);
      })
      .catch((error: unknown) => console.warn("Recruiter numbers unavailable:", error));
    return () => {
      pageIsOpen = false;
    };
  }, [isApproved]);

  // "-" while loading, instead of a fake 0.
  const show = (value: number | undefined) => (value === undefined ? "-" : value);

  return (
    <>
      {isApproved ? <CandidateSearch candidatesCount={summary?.candidatesCount} /> : <VerificationStatus profile={profile} />}

      <div className={styles.columns}>
        <div className={styles.stack}>
          {isApproved && (
            <FactStrip
              facts={[
                {
                  icon: Search,
                  value: show(summary?.candidatesCount),
                  label: "candidates you can search",
                  href: ROUTES.RECRUITER_CANDIDATES,
                },
                {
                  icon: Users,
                  value: show(summary?.connectionsCount),
                  label: "connections",
                  href: ROUTES.CONNECTIONS,
                },
                {
                  icon: Inbox,
                  value: show(summary?.pendingRequestsCount),
                  label: "requests waiting for you",
                  href: ROUTES.CONNECTIONS,
                },
              ]}
            />
          )}

          {profile.profileCompletion < 100 && (
            <ProfileReadiness
              percent={profile.profileCompletion}
              checklist={profile.completionChecklist}
              audience="candidates"
            />
          )}

          <ShortcutList
            title="Hiring tools"
            shortcuts={[
              {
                icon: Search,
                title: "Search candidates",
                text: "Filter by skill, location and who is open to work.",
                href: ROUTES.RECRUITER_CANDIDATES,
              },
              {
                icon: Users,
                title: "Your network",
                text: "Answer invitations and connect with candidates.",
                href: ROUTES.CONNECTIONS,
              },
              {
                icon: MessageSquare,
                title: "Messages",
                text: "Continue your hiring conversations.",
                href: ROUTES.MESSAGES,
              },
              {
                icon: UserPen,
                title: "Company details",
                text: "Keep your company and job title accurate.",
                href: `${ROUTES.PROFILE_EDIT}#company`,
              },
            ]}
          />
        </div>

        <ActivityTimeline activities={activities} />
      </div>
    </>
  );
}
