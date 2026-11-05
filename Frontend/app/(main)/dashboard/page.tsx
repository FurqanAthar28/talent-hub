"use client";

/**
 * Dashboard: the first page after signing in.
 * It loads my profile and my recent activity, then shows the candidate or
 * the recruiter version. (Admins are sent to the admin page.)
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { errorText } from "@/app/api/client";
import { getDashboardData, getRecentActivity, type Activity } from "@/app/services/dashboard";
import type { Profile } from "@/app/services/profiles";
import { greetingForTime } from "@/app/utils/time";
import { ROUTES } from "../../config/routes";
import CandidateDashboard from "./components/candidate/CandidateDashboard";
import DashboardError from "./components/common/DashboardError";
import DashboardLoading from "./components/common/DashboardLoading";
import RecruiterDashboard from "./components/recruiter/RecruiterDashboardSection";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let pageIsOpen = true;

    async function loadDashboard() {
      try {
        // Both at the same time (faster than one after the other).
        const [myProfile, myActivity] = await Promise.all([getDashboardData(), getRecentActivity()]);

        // Admins have their own page.
        if (myProfile.role === "admin") {
          router.replace(ROUTES.ADMIN);
          return;
        }

        if (!pageIsOpen) return;
        setProfile(myProfile);
        setActivities(myActivity);
      } catch (loadError) {
        if (pageIsOpen) setError(errorText(loadError, "Unable to load your dashboard."));
      }
    }

    void loadDashboard();

    return () => {
      pageIsOpen = false;
    };
  }, [router]);

  if (error) return <DashboardError message={error} />;
  if (!profile) return <DashboardLoading />;

  const isRecruiter = profile.role === "recruiter";
  const firstName = profile.fullName.split(" ")[0] || profile.fullName;

  const subtitle = isRecruiter
    ? profile.companyName
      ? `Hiring for ${profile.companyName}.`
      : "Here's your hiring overview."
    : profile.headline || "Here's where your profile stands today.";

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>
            {greetingForTime()}, {firstName}
          </h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        <div className={styles.headerActions}>
          <Link href={ROUTES.PROFILE} className="btn-outline">
            View profile
          </Link>
          <Link href={ROUTES.PROFILE_EDIT} className="btn-primary">
            Edit profile
          </Link>
        </div>
      </header>

      {isRecruiter ? (
        <RecruiterDashboard profile={profile} activities={activities} />
      ) : (
        <CandidateDashboard profile={profile} activities={activities} />
      )}
    </main>
  );
}
