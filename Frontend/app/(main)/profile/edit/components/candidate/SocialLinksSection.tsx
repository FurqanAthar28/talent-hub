type FormData = {
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
};

type Props = {
  content: Record<string, string | undefined>;
  formData: FormData;
  handleChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
};

export default function SocialLinksSection({
  content,
  formData,
  handleChange,
}: Props) {
  return (
    <section id="social" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">Online Presence</p>
        <h2>Professional Links</h2>
        <p>Add links that help recruiters verify your work.</p>
      </div>

      <div className="form-group">
        <label>{content.linkedinUrl || "LinkedIn URL"}</label>
        <input
          type="text"
          name="linkedinUrl"
          value={formData.linkedinUrl}
          onChange={handleChange}
          placeholder={
            content.linkedinUrlPlaceholder ||
            "https://linkedin.com/in/..."
          }
        />
      </div>

      <div className="form-group">
        <label>{content.githubUrl || "GitHub URL"}</label>
        <input
          type="text"
          name="githubUrl"
          value={formData.githubUrl}
          onChange={handleChange}
          placeholder={
            content.githubUrlPlaceholder ||
            "https://github.com/..."
          }
        />
      </div>

      <div className="form-group">
        <label>{content.portfolioUrl || "Portfolio URL"}</label>
        <input
          type="text"
          name="portfolioUrl"
          value={formData.portfolioUrl}
          onChange={handleChange}
          placeholder={
            content.portfolioUrlPlaceholder ||
            "https://yourportfolio.com"
          }
        />
      </div>
    </section>
  );
}