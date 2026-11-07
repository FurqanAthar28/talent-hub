import { COMPANY_ABOUT_MAX_LENGTH, COMPANY_SIZES, WORK_STYLES } from "@/app/config/constants";
import type { SectionProps, SetListField } from "../formTypes";
import styles from "./recruiter.module.css";
import { ChoiceChips } from "./TagInput";

type Props = SectionProps & { setListField: SetListField };

/**
 * The recruiter's company: who they work for, and what the company is like.
 * Only the company name is required (an admin checks it before approving).
 * Websites are type "text" (not "url"): Django also accepts "company.com"
 * and adds the https:// itself.
 */
export default function CompanyInformationSection({ content, formData, handleChange, setListField }: Props) {
  return (
    <section id="company" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">Recruiter profile</p>
        <h2>Your company</h2>
        <p>Candidates check this before they reply. A real website and LinkedIn page build trust.</p>
      </div>

      <div className={styles.grid}>
        <div className="form-group">
          <label htmlFor="edit-companyName">
            {content.companyName || "Company name"} <span className="required-star">*</span>
          </label>
          <input
            id="edit-companyName"
            name="companyName"
            value={formData.companyName}
            onChange={handleChange}
            placeholder={content.companyNamePlaceholder || "Company name"}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="edit-hiringTitle">{content.hiringTitle || "Your job title"}</label>
          <input
            id="edit-hiringTitle"
            name="hiringTitle"
            value={formData.hiringTitle}
            onChange={handleChange}
            placeholder={content.hiringTitlePlaceholder || "e.g. Talent Partner"}
          />
        </div>

        <div className="form-group">
          <label htmlFor="edit-companyWebsite">{content.companyWebsite || "Company website"}</label>
          <input
            id="edit-companyWebsite"
            name="companyWebsite"
            value={formData.companyWebsite}
            onChange={handleChange}
            placeholder="https://company.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="edit-companyLinkedinUrl">Company LinkedIn page</label>
          <input
            id="edit-companyLinkedinUrl"
            name="companyLinkedinUrl"
            value={formData.companyLinkedinUrl}
            onChange={handleChange}
            placeholder="linkedin.com/company/your-company"
          />
        </div>

        <div className="form-group">
          <label htmlFor="edit-companyIndustry">Industry</label>
          <input
            id="edit-companyIndustry"
            name="companyIndustry"
            value={formData.companyIndustry}
            onChange={handleChange}
            placeholder="e.g. Fintech, E-commerce, Software services"
            maxLength={100}
          />
        </div>

        <div className="form-group">
          <label htmlFor="edit-companySize">Company size</label>
          <select id="edit-companySize" name="companySize" value={formData.companySize} onChange={handleChange}>
            <option value="">Choose a size</option>
            {COMPANY_SIZES.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="edit-companyLocation">{content.companyLocation || "Company location"}</label>
          <input
            id="edit-companyLocation"
            name="companyLocation"
            value={formData.companyLocation}
            onChange={handleChange}
            placeholder={content.companyLocationPlaceholder || "City, Country"}
          />
        </div>
      </div>

      <ChoiceChips
        legend="How the team works"
        options={WORK_STYLES}
        values={formData.workStyles}
        onChange={(values) => setListField("workStyles", values)}
      />

      <div className="form-group">
        <label htmlFor="edit-companyAbout">About the company</label>
        <textarea
          id="edit-companyAbout"
          name="companyAbout"
          value={formData.companyAbout}
          onChange={handleChange}
          placeholder="What the company builds, the team, and why people like working there."
          rows={5}
          maxLength={COMPANY_ABOUT_MAX_LENGTH}
        />
        <p className="character-count">
          {formData.companyAbout.length}/{COMPANY_ABOUT_MAX_LENGTH}
        </p>
      </div>
    </section>
  );
}
