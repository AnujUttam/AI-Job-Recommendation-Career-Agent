import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, Save } from 'lucide-react';
import { useCareer } from '../context/CareerContext';
import { COMMON_LOCATIONS, EXPERIENCE_LEVEL_OPTIONS } from '../data/mockData';
import SectionCard from '../components/common/SectionCard';
import SkillBadge from '../components/common/SkillBadge';

export default function ProfilePage() {
  const { profile, updateProfile } = useCareer();

  const [form, setForm] = useState(profile);

  useEffect(() => {
    setForm(profile);
  }, [profile]);
  const [newSkill, setNewSkill] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newRole, setNewRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSavedBanner(false);
  };

  const addItem = (field, value, clearFn) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setForm((prev) => {
      const exists = prev[field].some((item) => item.toLowerCase() === trimmed.toLowerCase());
      if (exists) return prev;
      return { ...prev, [field]: [...prev[field], trimmed] };
    });
    clearFn('');
    setSavedBanner(false);
  };

  const removeItem = (field, valueToRemove) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((item) => item !== valueToRemove),
    }));
    setSavedBanner(false);
  };

  const togglePreferredLocation = (loc) => {
    const exists = form.preferredLocations.includes(loc);
    if (exists) {
      removeItem('preferredLocations', loc);
    } else {
      addItem('preferredLocations', loc, () => {});
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    setSavedBanner(false);
    try {
      const updated = await updateProfile(form);
      setForm(updated);
      setSavedBanner(true);
    } catch (err) {
      setSaveError(err.message || 'Failed to save profile preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {saveError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {savedBanner && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Profile and preferences saved. Job match scores across Dashboard and Job Explorer have
            been updated.
          </span>
        </div>
      )}

      {/* Candidate Information */}
      <SectionCard
        title="Candidate Information"
        subtitle="Core profile details used by semantic matching and the Career Assistant"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label="Full Name"
            value={form.fullName}
            onChange={(v) => handleField('fullName', v)}
            required
          />
          <InputField
            label="Email Address"
            type="email"
            value={form.email}
            onChange={(v) => handleField('email', v)}
            required
          />
          <InputField
            label="Professional Headline"
            value={form.headline}
            onChange={(v) => handleField('headline', v)}
          />
          <InputField
            label="Current Location"
            value={form.currentLocation}
            onChange={(v) => handleField('currentLocation', v)}
          />
          <InputField
            label="GitHub URL"
            value={form.githubUrl}
            onChange={(v) => handleField('githubUrl', v)}
          />
          <InputField
            label="LinkedIn URL"
            value={form.linkedinUrl}
            onChange={(v) => handleField('linkedinUrl', v)}
          />
        </div>

        <div className="mt-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Candidate Summary / Bio
            </span>
            <textarea
              rows={3}
              value={form.bio}
              onChange={(e) => handleField('bio', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>
        </div>
      </SectionCard>

      {/* Experience Level & Work Preferences */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Experience Level"
          subtitle="Adjusts seniority weighting in job recommendations"
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {EXPERIENCE_LEVEL_OPTIONS.map((level) => {
              const active = form.experienceLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleField('experienceLevel', level)}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    active
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">
                Work Mode Preference
              </span>
              <select
                value={form.remotePreference}
                onChange={(e) => handleField('remotePreference', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="Remote Only">Remote Only</option>
                <option value="Hybrid or Remote">Hybrid or Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Onsite">Onsite</option>
                <option value="Any">Any</option>
              </select>
            </label>
          </div>
        </SectionCard>

        {/* Preferred Locations */}
        <SectionCard
          title="Preferred Locations"
          subtitle="Select target cities or remote availability"
        >
          <div className="flex flex-wrap gap-2">
            {COMMON_LOCATIONS.map((loc) => {
              const selected = form.preferredLocations.includes(loc);
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => togglePreferredLocation(loc)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {loc}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem('preferredLocations', newLocation, setNewLocation);
                }
              }}
              placeholder="Add custom city..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => addItem('preferredLocations', newLocation, setNewLocation)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {form.preferredLocations.map((loc) => (
              <SkillBadge
                key={loc}
                label={loc}
                variant="accent"
                onRemove={() => removeItem('preferredLocations', loc)}
              />
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Skills & Desired Roles */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Skills"
          subtitle="Add or remove skills to update job match percentages"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem('skills', newSkill, setNewSkill);
                }
              }}
              placeholder="Add a skill (e.g., TypeScript, Kubernetes)..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => addItem('skills', newSkill, setNewSkill)}
              className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-navy-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Skill
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {form.skills.map((skill) => (
              <SkillBadge
                key={skill}
                label={skill}
                variant="neutral"
                onRemove={() => removeItem('skills', skill)}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Desired Roles" subtitle="Target job titles for career recommendations">
          <div className="flex gap-2">
            <input
              type="text"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem('desiredRoles', newRole, setNewRole);
                }
              }}
              placeholder="Add desired role (e.g., ML Engineer)..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => addItem('desiredRoles', newRole, setNewRole)}
              className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-navy-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Role
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {form.desiredRoles.map((role) => (
              <SkillBadge
                key={role}
                label={role}
                variant="violet"
                onRemove={() => removeItem('desiredRoles', role)}
              />
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Save Action */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving Preferences...' : 'Save Profile & Preferences'}
        </button>
      </div>
    </form>
  );
}

function InputField({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
    </label>
  );
}
