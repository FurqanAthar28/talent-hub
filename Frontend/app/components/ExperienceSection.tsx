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
  async function loadInitialExperiences() {
    await loadExperiences();
  }

  loadInitialExperiences();
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
    <div className="card">
      <div className="card-header flex-between">
        <h3>Experience</h3>

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
          <p className="muted text-center">
            No experience added yet. Add your first experience.
          </p>
        ) : (
          <div className="project-list">
            {experiences.map((experience) => (
              <div key={experience.id} className="project-item">
                <div className="flex-between mb-2 project-item-header">
                  <div>
                    <h4 className="font-semibold">{experience.title}</h4>
                    <p className="muted">{experience.company}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={() => handleOpen(experience)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={() => handleDelete(experience.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <p className="text-sm muted mb-2">
                  {experience.start_date || 'Start date'} —{' '}
                  {experience.current
                    ? 'Present'
                    : experience.end_date || 'End date'}
                </p>

                {experience.location && (
                  <p className="text-sm muted mb-2">{experience.location}</p>
                )}

                {experience.description && (
                  <p className="muted mb-2">{experience.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="modal-overlay" onClick={handleClose}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{editing ? 'Edit Experience' : 'Add Experience'}</h3>

              <button
                type="button"
                className="modal-close"
                onClick={handleClose}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>
                  Title <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleFormChange}
                  placeholder="Job Title"
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
                  placeholder="Your Company"
                />
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleFormChange}
                  placeholder="City, Country"
                />
              </div>

              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="text"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleFormChange}
                  placeholder="June 2024"
                />
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    name="current"
                    checked={form.current}
                    onChange={handleFormChange}
                  />{' '}
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
                    placeholder="August 2024"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="Describe your responsibilities..."
                />
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
    </div>
  );
}