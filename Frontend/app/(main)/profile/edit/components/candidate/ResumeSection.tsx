"use client";

import { useState, type ChangeEvent } from "react";

import { CV_MIME_TYPE, MAX_CV_FILE_SIZE_MB } from "@/app/config/constants";
import { checkCvFile } from "@/app/utils/cvFile";
import type { UiTexts } from "../formTypes";

type Props = {
  content: UiTexts;
  currentCvUrl: string;
  cvFile: File | null;
  setCvFile: (file: File | null) => void;
};

export default function ResumeSection({ content, currentCvUrl, cvFile, setCvFile }: Props) {
  const [fileError, setFileError] = useState("");

  // Check the file the moment it's picked, not after pressing Save.
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const problem = checkCvFile(file);
    setFileError(problem);

    if (problem) {
      event.target.value = ""; // empty the file box again
      setCvFile(null);
    } else {
      setCvFile(file);
    }
  }

  return (
    <section id="resume" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">Resume</p>
        <h2>{content.cvResume || "CV / Resume"}</h2>
        <p>Upload your latest resume so recruiters can review your profile.</p>
      </div>

      {currentCvUrl && (
        <a href={currentCvUrl} target="_blank" rel="noopener noreferrer" className="quick-link">
          {content.viewCurrentCv || "View current CV"}
        </a>
      )}

      <div className="file-upload-box">
        <label htmlFor="edit-cvFile" className="file-upload-title">
          {currentCvUrl
            ? content.cvReplaceTitle || "Replace your current CV"
            : content.cvUploadTitle || "Upload your CV"}
        </label>
        <input id="edit-cvFile" type="file" accept={CV_MIME_TYPE} onChange={handleFileChange} />

        <p className="text-xs muted mt-1">
          {content.cvUploadHint || `PDF only, maximum ${MAX_CV_FILE_SIZE_MB}MB.`}
        </p>

        {fileError && (
          <p className="form-error text-sm mt-1" role="alert">
            {fileError}
          </p>
        )}

        {cvFile && (
          <p className="text-sm mt-1 success-text">
            {content.selectedFileLabel || "Selected file"}: {cvFile.name} (saved when you press
            &quot;Save changes&quot;)
          </p>
        )}
      </div>
    </section>
  );
}
