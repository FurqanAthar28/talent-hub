type CompanyInformationSectionProps = {
  content: Record<string, string | undefined>;
  formData: {
    companyName: string;
    companyWebsite: string;
    companyLocation: string;
    hiringTitle: string;
  };
  handleChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
};

export default function CompanyInformationSection({
  content,
  formData,
  handleChange,
}: CompanyInformationSectionProps) {
  return (
    <section id="company" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">Recruiter Profile</p>
        <h2>Company Information</h2>
        <p>Help candidates understand your company and hiring needs.</p>
      </div>

      <div className="form-group">
        <label>{content.companyName || "Company Name"}</label>
        <input
          type="text"
          name="companyName"
          value={formData.companyName}
          onChange={handleChange}
          placeholder={content.companyNamePlaceholder || "Company name"}
        />
      </div>

      <div className="form-group">
        <label>{content.companyWebsite || "Company Website"}</label>
        <input
          type="url"
          name="companyWebsite"
          value={formData.companyWebsite}
          onChange={handleChange}
          placeholder={content.companyWebsitePlaceholder || "https://company.com"}
        />
      </div>

      <div className="form-group">
        <label>{content.companyLocation || "Company Location"}</label>
        <input
          type="text"
          name="companyLocation"
          value={formData.companyLocation}
          onChange={handleChange}
          placeholder={content.companyLocationPlaceholder || "City, Country"}
        />
      </div>

      <div className="form-group">
        <label>{content.hiringTitle || "Hiring Title"}</label>
        <input
          type="text"
          name="hiringTitle"
          value={formData.hiringTitle}
          onChange={handleChange}
          placeholder={content.hiringTitlePlaceholder || "Your hiring title"}
        />
      </div>
    </section>
  );
}
