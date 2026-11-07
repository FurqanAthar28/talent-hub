"use client";

/**
 * "Post a job" / "Edit job": a pop-up form (reuses FormModal from Edit Profile,
 * and the chip box from the recruiter profile for skills).
 */

import { useEffect, useState } from "react";

import {
  HIRING_LEVELS,
  JOB_DESCRIPTION_MAX_LENGTH,
  JOB_MAX_SKILLS,
  JOB_SALARY_MAX_LENGTH,
  JOB_TITLE_MAX_LENGTH,
  JOB_TYPES,
  LIST_ITEM_MAX_LENGTH,
  WORK_STYLES,
} from "@/app/config/constants";
import { errorText } from "@/app/api/client";
import { createJob, updateJob, type Job, type JobInput } from "@/app/services/jobs";
import { getSkillOptions } from "@/app/services/skills";
import FormModal from "../../profile/edit/components/candidate/FormModal";
import TagInput from "../../profile/edit/components/recruiter/TagInput";
import styles from "../jobs.module.css";

const EMPTY: JobInput = {
  title: "",
  employmentType: "full_time",
  workStyle: "onsite",
  experienceLevel: "mid",
  location: "",
  salary: "",
  description: "",
  skills: [],
};

type Props = {
  job: Job | null; // null = a new job
  onSaved: (job: Job) => void;
  onClose: () => void;
};

export default function JobFormModal({ job, onSaved, onClose }: Props) {
  const [form, setForm] = useState<JobInput>(() =>
    job
      ? {
          title: job.title,
          employmentType: job.employmentType,
          workStyle: job.workStyle,
          experienceLevel: job.experienceLevel,
          location: job.location,
          salary: job.salary,
          description: job.description,
          skills: job.skills,
        }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [skillOptions, setSkillOptions] = useState<string[]>([]);

  useEffect(() => {
    getSkillOptions()
      .then(setSkillOptions)
      .catch(() => undefined);
  }, []);

  const set = <Key extends keyof JobInput>(key: Key, value: JobInput[Key]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const needsLocation = form.workStyle !== "remote";
  const canSave =
    form.title.trim().length >= 3 &&
    form.description.trim().length >= 30 &&
    (!needsLocation || form.location.trim() !== "");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const saved = job ? await updateJob(job.id, form) : await createJob(form);
      onSaved(saved);
    } catch (problem) {
      setError(errorText(problem, "Couldn't save the job."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      eyebrow={job ? "Edit job" : "New job"}
      title={job ? job.title : "Post a job"}
      error={error}
      saving={saving}
      saveLabel={job ? "Save job" : "Post job"}
      canSave={canSave}
      onSave={handleSave}
      onClose={onClose}
    >
      <div className="form-group">
        <label htmlFor="job-title">
          Job title <span className="required-star">*</span>
        </label>
        <input
          id="job-title"
          value={form.title}
          onChange={(event) => set("title", event.target.value)}
          placeholder="e.g. Backend Engineer (Django)"
          maxLength={JOB_TITLE_MAX_LENGTH}
          autoFocus
        />
      </div>

      <div className={styles.formGrid}>
        <div className="form-group">
          <label htmlFor="job-type">Job type</label>
          <select id="job-type" value={form.employmentType} onChange={(event) => set("employmentType", event.target.value)}>
            {JOB_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="job-level">Experience level</label>
          <select id="job-level" value={form.experienceLevel} onChange={(event) => set("experienceLevel", event.target.value)}>
            {HIRING_LEVELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="job-style">Work style</label>
          <select id="job-style" value={form.workStyle} onChange={(event) => set("workStyle", event.target.value)}>
            {WORK_STYLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="job-location">
            Location {needsLocation && <span className="required-star">*</span>}
          </label>
          <input
            id="job-location"
            value={form.location}
            onChange={(event) => set("location", event.target.value)}
            placeholder={needsLocation ? "e.g. Lahore" : "Optional, e.g. Pakistan only"}
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="job-salary">Salary (optional)</label>
        <input
          id="job-salary"
          value={form.salary}
          onChange={(event) => set("salary", event.target.value)}
          placeholder="e.g. PKR 250k-350k / month"
          maxLength={JOB_SALARY_MAX_LENGTH}
        />
      </div>

      <TagInput
        id="job-skills"
        label="Skills"
        values={form.skills}
        onChange={(values) => set("skills", values)}
        max={JOB_MAX_SKILLS}
        maxLength={LIST_ITEM_MAX_LENGTH}
        placeholder="e.g. Django"
        suggestions={skillOptions}
      />

      <div className="form-group">
        <label htmlFor="job-description">
          Description <span className="required-star">*</span>
        </label>
        <textarea
          id="job-description"
          value={form.description}
          onChange={(event) => set("description", event.target.value)}
          placeholder="What they'll do, what you need, and what you offer."
          rows={8}
          maxLength={JOB_DESCRIPTION_MAX_LENGTH}
        />
        <p className="character-count">
          {form.description.length}/{JOB_DESCRIPTION_MAX_LENGTH}
          {form.description.trim().length < 30 ? " (at least 30)" : ""}
        </p>
      </div>
    </FormModal>
  );
}
