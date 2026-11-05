import { ui } from "@/app/components/ui";

type RecruiterPageHeaderProps = {
  title: string;
  description: string;
};

/** The title at the top of recruiter pages (same style as every other page). */
export default function RecruiterPageHeader({ title, description }: RecruiterPageHeaderProps) {
  return (
    <header className={ui.pageHeader}>
      <div>
        <h1 className={ui.pageTitle}>{title}</h1>
        <p className={ui.pageSubtitle}>{description}</p>
      </div>
    </header>
  );
}
