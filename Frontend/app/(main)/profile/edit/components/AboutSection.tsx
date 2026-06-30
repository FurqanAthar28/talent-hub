type FormData = {
  bio: string;
};

type Props = {
  content: Record<string, string | undefined>;
  formData: FormData;
  handleChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
};

export default function AboutSection({
  content,
  formData,
  handleChange,
}: Props) {
  return (
    <section id="about" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">About</p>
        <h2>Professional Bio</h2>
        <p>Write a short summary that explains your skills and goals.</p>
      </div>

      <div className="form-group">
        <label>{content.bio || "Bio"}</label>
        <textarea
          name="bio"
          value={formData.bio}
          onChange={handleChange}
          placeholder={content.bioPlaceholder || "Tell people about yourself"}
          rows={6}
        />

        <div className="ai-assist-row">
          <p className="character-count">{formData.bio.length} characters</p>

          <button type="button" className="btn-secondary btn-sm" disabled>
            AI Assist Coming Soon
          </button>
        </div>
      </div>
    </section>
  );
}