import type { SectionProps } from "../formTypes";

// The 4 company boxes, as a list (one <input> pattern instead of 4 copies).
// The website is type "text" (not "url"): Django also accepts "company.com"
// and adds the https:// itself.
const FIELDS = [
  { name: "companyName", label: "Company name", placeholder: "Company name", type: "text", required: true },
  { name: "companyWebsite", label: "Company website", placeholder: "https://company.com", type: "text", required: false },
  { name: "companyLocation", label: "Company location", placeholder: "City, Country", type: "text", required: false },
  { name: "hiringTitle", label: "Hiring title", placeholder: "Your job title", type: "text", required: false },
] as const;

export default function CompanyInformationSection({ content, formData, handleChange }: SectionProps) {
  return (
    <section id="company" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">Recruiter profile</p>
        <h2>Company information</h2>
        <p>Help candidates understand your company and hiring needs.</p>
      </div>

      {FIELDS.map((field) => (
        <div className="form-group" key={field.name}>
          <label htmlFor={`edit-${field.name}`}>
            {content[field.name] || field.label}{" "}
            {field.required && <span className="required-star">*</span>}
          </label>
          <input
            id={`edit-${field.name}`}
            type={field.type}
            name={field.name}
            value={formData[field.name]}
            onChange={handleChange}
            placeholder={content[`${field.name}Placeholder`] || field.placeholder}
            required={field.required}
          />
        </div>
      ))}
    </section>
  );
}
