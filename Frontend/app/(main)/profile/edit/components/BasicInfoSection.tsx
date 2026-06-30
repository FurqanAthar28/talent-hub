import type { UiContent } from "../../../../api/ui-content";

type FormData = {
  fullName: string;
  headline: string;
  location: string;
};

type Props = {
  content: Record<string, string | undefined>;
  formData: FormData;
  handleChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
};

export default function BasicInfoSection({
  content,
  formData,
  handleChange,
}: Props) {
  return (
    <section id="information" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">Basic Details</p>
        <h2>Professional Information</h2>
        <p>Your name, headline, and location appear on your public profile.</p>
      </div>

      <div className="form-group">
        <label>{content.fullName || "Full Name"}</label>
        <input
          type="text"
          name="fullName"
          value={formData.fullName}
          onChange={handleChange}
          placeholder={content.fullNamePlaceholder || "Enter your full name"}
        />
      </div>

      <div className="form-group">
        <label>{content.headline || "Professional Headline"}</label>
        <p className="form-help">
          Example: Backend Developer | Django | PostgreSQL
        </p>
        <input
          type="text"
          name="headline"
          value={formData.headline}
          onChange={handleChange}
          placeholder={content.headlinePlaceholder || "Write your headline"}
        />
      </div>

      <div className="form-group">
        <label>{content.location || "Location"}</label>
        <input
          type="text"
          name="location"
          value={formData.location}
          onChange={handleChange}
          placeholder={content.locationPlaceholder || "City, Country"}
        />
      </div>
    </section>
  );
}