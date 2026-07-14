import type { Skill } from "./skillTypes";

type SkillChipProps = {
  skill: Skill;
  onEdit: (skill: Skill) => void;
  onDelete: (skillId: number) => void;
};

export default function SkillChip({ skill, onEdit, onDelete }: SkillChipProps) {
  return (
    <div className="skill-chip">
      <button
        type="button"
        className="skill-chip-name"
        onClick={() => onEdit(skill)}
        title="Edit skill"
      >
        {skill.name}
      </button>

      <button
        type="button"
        className="skill-chip-remove"
        onClick={() => onDelete(skill.id)}
        aria-label={`Remove ${skill.name}`}
        title="Remove skill"
      >
        ×
      </button>
    </div>
  );
}