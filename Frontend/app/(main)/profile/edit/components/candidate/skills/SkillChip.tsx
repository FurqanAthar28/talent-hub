import type { Skill } from "@/app/services/skills";

type SkillChipProps = {
  skill: Skill;
  busy: boolean; // true while something is saving: the × is switched off
  onDelete: (skillId: number) => void;
};

/** One skill "pill" with a × button to remove it. */
export default function SkillChip({ skill, busy, onDelete }: SkillChipProps) {
  return (
    <div className="skill-chip">
      <span className="skill-chip-name">{skill.name}</span>

      <button
        type="button"
        className="skill-chip-remove"
        onClick={() => onDelete(skill.id)}
        disabled={busy}
        aria-label={`Remove ${skill.name}`}
        title="Remove skill"
      >
        ×
      </button>
    </div>
  );
}
