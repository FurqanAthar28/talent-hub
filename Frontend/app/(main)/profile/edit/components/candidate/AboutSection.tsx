import type { SectionProps } from "../formTypes";
import { AiLabelRow, AiOptionList, type AiWriter } from "./ai/AiWriter";

type Props = SectionProps & {
  ai?: AiWriter; // only candidates have "Write with AI"
  forRecruiter?: boolean; // recruiters write about themselves as a recruiter
};

export default function AboutSection({ content, formData, handleChange, ai, forRecruiter = false }: Props) {
  return (
    <section id="about" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">About</p>
        <h2>{forRecruiter ? "About you" : "Professional bio"}</h2>
        <p>
          {forRecruiter
            ? "A few lines on who you are and how you hire. The company itself has its own box below."
            : "Write a short summary that explains your skills and goals."}
        </p>
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
          placeholder={
            forRecruiter
              ? "e.g. I hire engineers for our Lahore team. I reply to every message within 2 days."
              : content.bioPlaceholder || "Tell people about yourself"
          }
          rows={6}
        />
        <p className="character-count">{formData.bio.length} characters</p>
        <AiOptionList ai={ai} field="bio" currentValue={formData.bio} />
      </div>
    </section>
  );
}
