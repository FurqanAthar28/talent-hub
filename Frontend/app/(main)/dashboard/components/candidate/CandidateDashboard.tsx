import { Briefcase, Eye, FileText, MessageSquare, UserPlus, Users } from "lucide-react";

import { ROUTES } from "@/app/config/routes";
import type { Activity } from "@/app/services/dashboard";
import type { Profile } from "@/app/services/profiles";
import styles from "../../dashboard.module.css";
import ActivityTimeline from "../common/ActivityTimeline";
import FactStrip from "../common/FactStrip";
import ProfileReadiness from "../common/ProfileReadiness";
import ShortcutList from "../common/ShortcutList";

type CandidateDashboardProps = {
  profile: Profile;
  activities: Activity[];
};

/**
 * A candidate's home page.
 * Top: how ready the profile is (the thing that matters most for getting found).
 * Then: 3 facts, where to go next, and recent activity.
 */
export default function CandidateDashboard({ profile, activities }: CandidateDashboardProps) {
  return (
    <>
      <ProfileReadiness
        percent={profile.profileCompletion}
        checklist={profile.completionChecklist}
        audience="recruiters"
      />

      <div className={styles.columns}>
        <div className={styles.stack}>
          <FactStrip
            facts={[
              {
                icon: Eye,
                value: profile.profileViewers,
                label: profile.profileViewers === 1 ? "person viewed your profile" : "people viewed your profile",
              },
              {
                icon: Users,
                value: profile.connectionsCount,
                label: profile.connectionsCount === 1 ? "connection" : "connections",
                href: ROUTES.CONNECTIONS,
              },
              profile.openToWork
                ? {
                    icon: Briefcase,
                    value: "Open to work",
                    label: "Recruiters can filter for you",
                    positive: true,
                  }
                : {
                    icon: Briefcase,
                    value: "Not looking",
                    label: "Turn on “open to work”",
                    href: `${ROUTES.PROFILE_EDIT}#information`,
                  },
            ]}
          />

          <ShortcutList
            title="Next steps"
            shortcuts={[
              {
                icon: UserPlus,
                title: "Grow your network",
                text: "Connect with people and recruiters in your field.",
                href: ROUTES.CONNECTIONS,
              },
              {
                icon: MessageSquare,
                title: "Messages",
                text: "Pick up your conversations where you left off.",
                href: ROUTES.MESSAGES,
              },
              {
                icon: FileText,
                title: profile.cvUrl ? "Update your CV" : "Upload your CV",
                text: "Recruiters you connect with can open it from your profile.",
                href: `${ROUTES.PROFILE_EDIT}#resume`,
              },
              {
                icon: Eye,
                title: "See your public profile",
                text: "Check what other people see.",
                href: ROUTES.PROFILE,
              },
            ]}
          />
        </div>

        <ActivityTimeline activities={activities} />
      </div>
    </>
  );
}
