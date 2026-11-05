import type { SectionProps } from "../formTypes";

export default function AboutSection({ content, formData, handleChange }: SectionProps) {
  return (
    <section id="about" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">About</p>
        <h2>Professional bio</h2>
        <p>Write a short summary that explains your skills and goals.</p>
      </div>

      <div className="form-group">
        <label htmlFor="edit-bio">{content.bio || "Bio"}</label>
        <textarea
          id="edit-bio"
          name="bio"
          value={formData.bio}
          onChange={handleChange}
          placeholder={content.bioPlaceholder || "Tell people about yourself"}
          rows={6}
        />
        <p className="character-count">{formData.bio.length} characters</p>
      </div>
    </section>
  );
}
