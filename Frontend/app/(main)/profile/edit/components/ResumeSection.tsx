type Props = {
  content: Record<string, string | undefined>;
  currentCvUrl: string;
  cvFile: File | null;
  setCvFile: React.Dispatch<React.SetStateAction<File | null>>;
};

export default function ResumeSection({
  content,
  currentCvUrl,
  cvFile,
  setCvFile,
}: Props) {
  return (
    <section id="resume" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">Resume</p>
        <h2>{content.cvResume || "CV / Resume"}</h2>
        <p>Upload your latest resume so recruiters can review your profile.</p>
      </div>

      {currentCvUrl && (
        <a
          href={currentCvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="quick-link"
        >
          {content.viewCurrentCv || "View current CV"}
        </a>
      )}

      <div className="file-upload-box">
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={(event) => setCvFile(event.target.files?.[0] || null)}
        />

        <p className="file-upload-title">
          {content.cvReplaceTitle || "Replace your current CV"}
        </p>

        <p className="text-xs muted mt-1">
          {content.cvUploadHint || "PDF files only."}
        </p>

        {cvFile && (
          <p className="text-sm mt-1 success-text">
            {content.selectedFileLabel || "Selected file"}: {cvFile.name}
          </p>
        )}
      </div>
    </section>
  );
}