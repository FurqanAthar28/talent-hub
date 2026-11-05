import type { SectionProps } from "../formTypes";

type Props = SectionProps & {
  showOpenToWork: boolean; // only candidates have "open to work"
};

export default function BasicInfoSection({ content, formData, handleChange, showOpenToWork }: Props) {
  return (
    <section id="information" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">Basic details</p>
        <h2>Professional information</h2>
        <p>Your name, headline, and location appear on your public profile.</p>
      </div>

      <div className="form-group">
        {/* htmlFor + id link the label to its box (clicking the label focuses it). */}
        <label htmlFor="edit-fullName">
          {content.fullName || "Full name"} <span className="required-star">*</span>
        </label>
        <input
          id="edit-fullName"
          type="text"
          name="fullName"
          value={formData.fullName}
          onChange={handleChange}
          placeholder={content.fullNamePlaceholder || "Enter your full name"}
          autoComplete="name"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="edit-headline">{content.headline || "Professional headline"}</label>
        <input
          id="edit-headline"
          type="text"
          name="headline"
          value={formData.headline}
          onChange={handleChange}
          placeholder={content.headlinePlaceholder || "For example: Python developer"}
        />
      </div>

      <div className="form-group">
        <label htmlFor="edit-location">{content.location || "Location"}</label>
        <input
          id="edit-location"
          type="text"
          name="location"
          value={formData.location}
          onChange={handleChange}
          placeholder={content.locationPlaceholder || "City, Country"}
        />
      </div>

      {showOpenToWork && (
        <div className="form-group">
          {/* Recruiters can filter by this. Before, there was no way to switch it on. */}
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="openToWork"
              checked={formData.openToWork}
              onChange={handleChange}
            />
            {content.openToWork || "I'm open to work (recruiters can find me with this filter)"}
          </label>
        </div>
      )}
    </section>
  );
}
