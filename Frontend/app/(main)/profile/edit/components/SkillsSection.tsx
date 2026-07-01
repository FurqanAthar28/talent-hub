"use client";

type SkillsSectionProps = {
  content: Record<string, string | undefined>;
};

export default function SkillsSection({ content }: SkillsSectionProps) {
  return (
    <section id="skills" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">Skills</p>
        <h2>{content.skillsTitle || "Skills"}</h2>
        <p>
          {content.skillsDescription ||
            "Manage the skills shown on your professional profile."}
        </p>
      </div>

      <p className="muted-text">
        Skills management will be connected here next.
      </p>
    </section>
  );
}