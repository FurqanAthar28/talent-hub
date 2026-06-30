'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

type Experience = {
  id: number;
  title: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  current: boolean;
  description: string;
};

type FormState = {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
};

const emptyForm: FormState = {
  title: '',
  company: '',
  location: '',
  startDate: '',
  endDate: '',
  current: false,
  description: '',
};

function getExperienceDuration(experience: Experience) {
  const startDate = experience.start_date || 'Start date';
  const endDate = experience.current
    ? 'Present'
    : experience.end_date || 'End date';

  return `${startDate} — ${endDate}`;
}

export default function ExperienceSection({
  onProfileChange,
  onCountChange,
}: {
  onProfileChange?: () => void;
  onCountChange?: (count: number) => void;
}) {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Experience | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadExperiences = useCallback(async () => {
    try {
      const res = await apiFetch('/profiles/experiences');

      if (res.ok) {
        const data = await res.json();
        setExperiences(data);
        onCountChange?.(data.length);
      }
    } catch (err) {
      console.error('Failed to load experiences:', err);
    }
  }, [onCountChange]);

  useEffect(() => {
    loadExperiences();
  }, [loadExperiences]);

  function handleFormChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'current' && checked ? { endDate: '' } : {}),
    }));
  }

  function handleOpen(experience?: Experience) {
    if (experience) {
      setEditing(experience);
      setForm({
        title: experience.title,
        company: experience.company,
        location: experience.location,
        startDate: experience.start_date,
        endDate: experience.end_date,
        current: experience.current,
        description: experience.description,
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }

    setError('');
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
    setError('');
  }

  async function handleSave() {
    if (!form.title.trim() || !form.company.trim()) return;

    setSaving(true);
    setError('');

    try {
      const url = editing
        ? `/profiles/experiences/${editing.id}/update`
        : '/profiles/experiences/add';

      const res = await apiFetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          company: form.company.trim(),
          location: form.location.trim(),
          start_date: form.startDate.trim(),
          end_date: form.current ? '' : form.endDate.trim(),
          current: form.current,
          description: form.description.trim(),
        }),
      });

      if (!res.ok) {
        setError('Failed to save experience. Please try again.');
        return;
      }

      await loadExperiences();
      onProfileChange?.();
      handleClose();
    } catch (err) {
      console.error('Failed to save experience:', err);
      setError('Unable to connect to server.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await apiFetch(`/profiles/experiences/${id}/delete`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        console.error('Failed to delete experience');
        return;
      }

      await loadExperiences();
      onProfileChange?.();
    } catch (err) {
      console.error('Failed to delete experience:', err);
    }
  }

  return (
    <section id="experience" className="card form-section">
      <div className="card-header flex-between">
        <div>
          <p className="eyebrow">Experience</p>
          <h3>Work Experience</h3>
          <p className="muted text-sm">
            Showcase your professional journey, roles, and responsibilities.
          </p>
        </div>

        <button
          type="button"
          className="btn-outline btn-sm"
          onClick={() => handleOpen()}
        >
          + Add Experience
        </button>
      </div>

      <div className="card-body">
        {experiences.length === 0 ? (
          <div className="empty-state">
            <h3>No experience added yet</h3>
            <p>
              Add your first role to help recruiters understand your background
              and professional growth.
            </p>

            <button
              type="button"
              className="btn-primary"
              onClick={() => handleOpen()}
            >
              Add First Experience
            </button>
          </div>
        ) : (
          <div className="experience-list">
            {experiences.map((experience) => (
              <article key={experience.id} className="experience-card">
                <div className="experience-card-header">
                  <div>
                    <h4>{experience.title}</h4>
                    <p className="muted">{experience.company}</p>
                  </div>

                  {experience.current && (
                    <span className="status-pill">Current</span>
                  )}
                </div>

                <div className="experience-meta">
                  <span>{getExperienceDuration(experience)}</span>

                  {experience.location && <span>{experience.location}</span>}
                </div>

                {experience.description && (
                  <p className="experience-description">
                    {experience.description}
                  </p>
                )}

                <div className="experience-actions">
                  <button
                    type="button"
                    className="btn-outline btn-sm"
                    onClick={() => handleOpen(experience)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="btn-danger-outline btn-sm"
                    onClick={() => handleDelete(experience.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="modal-overlay" onClick={handleClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Experience Details</p>
                <h3>{editing ? 'Edit Experience' : 'Add Experience'}</h3>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={handleClose}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>
                    Title <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleFormChange}
                    placeholder="Enter your job title"
                  />
                </div>

                <div className="form-group">
                  <label>
                    Company <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={form.company}
                    onChange={handleFormChange}
                    placeholder="Enter company name"
                  />
                </div>

                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    name="location"
                    value={form.location}
                    onChange={handleFormChange}
                    placeholder="Enter work location"
                  />
                </div>

                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="text"
                    name="startDate"
                    value={form.startDate}
                    onChange={handleFormChange}
                    placeholder="MM/YYYY or Month YYYY"
                  />
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="current"
                      checked={form.current}
                      onChange={handleFormChange}
                    />
                    I currently work here
                  </label>
                </div>

                {!form.current && (
                  <div className="form-group">
                    <label>End Date</label>
                    <input
                      type="text"
                      name="endDate"
                      value={form.endDate}
                      onChange={handleFormChange}
                      placeholder="MM/YYYY or Month YYYY"
                    />
                  </div>
                )}

                <div className="form-group form-group-full">
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleFormChange}
                    rows={4}
                    placeholder="Briefly describe your responsibilities and achievements"
                  />
                </div>
              </div>

              {error && <p className="form-error text-sm">{error}</p>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={!form.title.trim() || !form.company.trim() || saving}
                >
                  {saving ? 'Saving...' : 'Save Experience'}
                </button>

                <button
                  type="button"
                  className="btn-outline"
                  onClick={handleClose}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}