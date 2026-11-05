"use client";

/**
 * My own profile. This page loads it; ProfileView draws it.
 * Admins get their own design (AdminProfile): their work, not a CV.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";

import { errorText } from "../../api/client";
import { Notice, ui } from "../../components/ui";
import { ROUTES } from "../../config/routes";
import { useUiContent } from "../../hooks/useUiContent";
import { fetchMyProfileDetails, type ProfileDetails } from "../../services/profiles";
import AdminProfile from "./components/admin/AdminProfile";
import ProfileView from "./components/ProfileView";

export default function MyProfilePage() {
  const text = useUiContent();

  const [details, setDetails] = useState<ProfileDetails | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let pageIsOpen = true;

    fetchMyProfileDetails()
      .then((data) => {
        if (pageIsOpen) setDetails(data);
      })
      .catch((loadError: unknown) => {
        if (pageIsOpen) setError(errorText(loadError, "Your profile could not be loaded."));
      });

    return () => {
      pageIsOpen = false;
    };
  }, []);

  return (
    <main className={ui.page}>
      {error ? (
        <Notice tone="error">{error} Refresh the page to try again.</Notice>
      ) : !details ? (
        <p className="muted">{text("loading", "Loading...")}</p>
      ) : details.profile.role === "admin" ? (
        <AdminProfile profile={details.profile} />
      ) : (
        <ProfileView
          {...details}
          isMine
          actions={
            <>
              <Link href={ROUTES.PROFILE_EDIT} className="btn-primary">
                <PenLine size={16} aria-hidden="true" style={{ marginRight: 6 }} />
                {text("editProfile", "Edit profile")}
              </Link>
            </>
          }
        />
      )}
    </main>
  );
}
