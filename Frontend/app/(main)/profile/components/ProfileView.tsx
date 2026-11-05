"use client";

/**
 * How a profile LOOKS. Used by both profile pages:
 *   /profile       -> my own profile    (isMine = true,  "Edit profile" button)
 *   /profile/[id]  -> someone else's    (isMine = false, Connect/Message buttons)
 *
 * The page passes its buttons in as `actions`.
 * Layout: a header (who + numbers), then the details in two columns.
 */

import type { CSSProperties, ReactNode } from "react";
import {
  Briefcase,
  Building2,
  Code2,
  ExternalLink,
  FileText,
  FolderGit2,
  Link2,
  Mail,
  MapPin,
} from "lucide-react";

import Link from "next/link";

import { backendUrl } from "@/app/api/client";
import { Avatar, Badge, Panel, ui } from "@/app/components/ui";
import { ROUTES } from "@/app/config/routes";
import { useUiContent } from "@/app/hooks/useUiContent";
import type { ProfileDetails } from "@/app/services/profiles";
import { getExperienceDuration } from "../edit/components/candidate/experience/experienceTypes";
import styles from "./profile.module.css";

type ProfileViewProps = ProfileDetails & {
  isMine: boolean;
  actions?: ReactNode;
};

/** One contact line with an icon. Not shown when there is no value. */
function ContactRow({ icon: Icon, href, label }: { icon: typeof Mail; href: string; label: string }) {
  if (!href) return null;

  const isEmail = href.startsWith("mailto:");
  return (
    <li>
      <a
        href={href}
        className={styles.contactRow}
        // Websites open in a new tab. noopener noreferrer: they can't control this tab.
        {...(isEmail ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      >
        <Icon size={18} aria-hidden="true" />
        <span className={styles.contactText}>{label}</span>
      </a>
    </li>
  );
}

/** "https://github.com/ali/" -> "github.com/ali" (shorter and easier to read). */
function shortUrl(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

export default function ProfileView({
  profile,
  skills,
  projects,
  experiences,
  isMine,
  actions,
}: ProfileViewProps) {
  const text = useUiContent();

  const isCandidate = profile.role === "candidate";
  const isRecruiter = profile.role === "recruiter";
  const isAdmin = profile.role === "admin";

  const roleLabel = isAdmin ? "Admin" : isRecruiter ? "Recruiter" : "Candidate";

  // The numbers under the header depend on the role. Each appears once.
  // Admins have no numbers, so they get no strip (their title is in "Admin role").
  const stats: { value: ReactNode; label: string }[] = isCandidate
    ? [
        { value: profile.connectionsCount, label: profile.connectionsCount === 1 ? "connection" : "connections" },
        { value: profile.projectsCount, label: profile.projectsCount === 1 ? "project" : "projects" },
        { value: profile.skillsCount, label: profile.skillsCount === 1 ? "skill" : "skills" },
      ]
    : isRecruiter
      ? [
          { value: profile.companyName || "-", label: "company" },
          { value: profile.hiringTitle || "-", label: "job title" },
          { value: profile.connectionsCount, label: "connections" },
        ]
      : [];

  const hasContact = Boolean(
    profile.email || profile.linkedinUrl || profile.githubUrl || profile.companyWebsite
  );

  return (
    <div className={ui.stack}>
      {/* ---------- Header: who they are + their numbers ---------- */}
      <section className={`${ui.panel} ${styles.header}`} aria-label="Profile summary">
        <div className={styles.identity}>
          <Avatar name={profile.fullName || "?"} size={76} />

          <div className={styles.identityMain}>
            <h1 className={styles.name}>{profile.fullName}</h1>
            <p className={styles.headline}>
              {profile.headline || text("professionalFallback", "Professional")}
            </p>
            <div className={styles.meta}>
              {profile.location && (
                <span className={styles.metaItem}>
                  <MapPin size={15} aria-hidden="true" />
                  {profile.location}
                </span>
              )}
              <Badge tone="neutral">{roleLabel}</Badge>
              {isCandidate && profile.openToWork && <Badge tone="success">Open to work</Badge>}
            </div>
          </div>

          {actions && <div className={styles.actions}>{actions}</div>}
        </div>

        {stats.length > 0 && (
          <div className={styles.stats} style={{ "--count": stats.length } as CSSProperties}>
            {stats.map((stat) => (
              <div key={stat.label} className={styles.stat}>
                <span className={styles.statValue}>{stat.value}</span>
                <span className={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className={ui.columns}>
        {/* ---------- Main column ---------- */}
        <div className={ui.stack}>
          <Panel title="About">
            {profile.bio ? (
              <p className={styles.bio}>{profile.bio}</p>
            ) : (
              <p className={styles.muted}>
                {isMine ? "Add a short bio so people know what you do." : "No bio added yet."}
              </p>
            )}
          </Panel>

          {isAdmin && (
            <Panel title="Admin role">
              <div className={styles.facts}>
                <div className={styles.fact}>
                  <span className={styles.factLabel}>Title</span>
                  <span>{profile.adminTitle || "Administrator"}</span>
                </div>
              </div>
              {isMine && (
                <p className={styles.adminHint}>
                  {text("adminProfileHint", "You manage accounts and recruiter approvals from the admin page.")}{" "}
                  <Link href={ROUTES.ADMIN}>Open admin page</Link>
                </p>
              )}
            </Panel>
          )}

          {isCandidate && (
            <Panel title={text("experience", "Experience")}>
              {experiences.length === 0 ? (
                <p className={styles.muted}>
                  {isMine ? "Add your jobs and internships from the edit page." : "No experience added yet."}
                </p>
              ) : (
                <ul className={styles.entries}>
                  {experiences.map((experience) => (
                    <li key={experience.id} className={styles.entry}>
                      <span className={styles.entryIcon}>
                        <Briefcase size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <p className={styles.entryTitle}>{experience.title}</p>
                        <p className={styles.entrySub}>{experience.company}</p>
                        <p className={styles.entryMeta}>
                          {getExperienceDuration(experience)}
                          {experience.location ? `, ${experience.location}` : ""}
                        </p>
                        {experience.description && <p className={styles.entryText}>{experience.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {isCandidate && (
            <Panel title={text("projects", "Projects")}>
              {projects.length === 0 ? (
                <p className={styles.muted}>
                  {isMine ? "Add a project to show what you've built." : "No projects added yet."}
                </p>
              ) : (
                <ul className={styles.entries}>
                  {projects.map((project) => (
                    <li key={project.id} className={styles.entry}>
                      <span className={styles.entryIcon}>
                        <FolderGit2 size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <p className={styles.entryTitle}>{project.title}</p>
                        {project.description && <p className={styles.entryText}>{project.description}</p>}
                        {project.tech_stack.length > 0 && (
                          <div className={styles.tags}>
                            {project.tech_stack.map((tech) => (
                              <span key={tech} className={styles.tag}>
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}
                        {project.github_url && (
                          <a
                            href={project.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.inlineLink}
                          >
                            <ExternalLink size={14} aria-hidden="true" />
                            View code
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {isRecruiter && (
            <Panel title={text("companyInformation", "Company")}>
              <div className={styles.facts}>
                {[
                  ["Company", profile.companyName],
                  ["Job title", profile.hiringTitle],
                  ["Company location", profile.companyLocation],
                ].map(([label, value]) => (
                  <div key={label} className={styles.fact}>
                    <span className={styles.factLabel}>{label}</span>
                    <span>{value || "Not added yet"}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* ---------- Side column ---------- */}
        <div className={ui.stack}>
          {isCandidate && (
            <Panel title={text("skills", "Skills")}>
              {skills.length === 0 ? (
                <p className={styles.muted}>No skills added yet.</p>
              ) : (
                <div className={styles.tags}>
                  {skills.map((skill) => (
                    <span key={skill.id} className={styles.tag}>
                      {skill.name}
                    </span>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {/* Django sends cvUrl only to people allowed to see the CV. */}
          {isCandidate && profile.cvUrl && (
            <Panel title={text("cv", "CV")} hint="PDF, opens in a new tab">
              <a
                href={backendUrl(profile.cvUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className={`btn-outline ${styles.cvButton}`}
              >
                <FileText size={16} aria-hidden="true" />
                {text("viewCv", "View CV")}
              </a>
            </Panel>
          )}

          {hasContact && (
            <Panel title={text("contact", "Contact")}>
              <ul className={styles.contactList}>
                {/* Django only sends the email to the owner (and staff). */}
                <ContactRow icon={Mail} href={profile.email ? `mailto:${profile.email}` : ""} label={profile.email} />
                {isCandidate && (
                  <>
                    <ContactRow icon={Link2} href={profile.linkedinUrl} label={shortUrl(profile.linkedinUrl)} />
                    <ContactRow icon={Code2} href={profile.githubUrl} label={shortUrl(profile.githubUrl)} />
                  </>
                )}
                {isRecruiter && (
                  <ContactRow icon={Building2} href={profile.companyWebsite} label={shortUrl(profile.companyWebsite)} />
                )}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
