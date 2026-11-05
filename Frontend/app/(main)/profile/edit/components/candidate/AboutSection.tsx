import type { SectionProps } from "../formTypes";
import { AiLabelRow, AiOptionList, type AiWriter } from "./ai/AiWriter";

type Props = SectionProps & {
  ai?: AiWriter; // only candidates have "Write with AI"
};

export default function AboutSection({ content, formData, handleChange, ai }: Props) {
  return (
    <section id="about" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">About</p>
        <h2>Professional bio</h2>
        <p>Write a short summary that explains your skills and goals.</p>
      </div>

      <div className="form-group">
        <AiLabelRow ai={ai} field="bio">
          <label htmlFor="edit-bio">{content.bio || "Bio"}</label>
        </AiLabelRow>
        <textarea
          id="edit-bio"
          name="bio"
          value={formData.bio}
          onChange={handleChange}
          placeholder={content.bioPlaceholder || "Tell people about yourself"}
          rows={6}
        />
        <p className="character-count">{formData.bio.length} characters</p>
        <AiOptionList ai={ai} field="bio" currentValue={formData.bio} />
      </div>
    </section>
  );
}
