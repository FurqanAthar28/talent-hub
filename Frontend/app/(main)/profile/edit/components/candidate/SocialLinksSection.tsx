import type { SectionProps } from "../formTypes";

// The 3 link boxes. Writing them as a list means one <input> pattern, not 3 copies.
const LINKS = [
  { name: "linkedinUrl", label: "LinkedIn URL", placeholder: "https://linkedin.com/in/..." },
  { name: "githubUrl", label: "GitHub URL", placeholder: "https://github.com/..." },

] as const;

export default function SocialLinksSection({ content, formData, handleChange }: SectionProps) {
  return (
    <section id="social" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">Online presence</p>
        <h2>Professional links</h2>
        <p>Add links that help recruiters verify your work.</p>
      </div>

      {LINKS.map((link) => (
        <div className="form-group" key={link.name}>
          <label htmlFor={`edit-${link.name}`}>{content[link.name] || link.label}</label>
          {/* type="text" (not "url") on purpose: Django also accepts
              "github.com/me" and adds the https:// itself. */}
          <input
            id={`edit-${link.name}`}
            type="text"
            inputMode="url"
            name={link.name}
            value={formData[link.name]}
            onChange={handleChange}
            placeholder={content[`${link.name}Placeholder`] || link.placeholder}
          />
        </div>
      ))}
    </section>
  );
}
