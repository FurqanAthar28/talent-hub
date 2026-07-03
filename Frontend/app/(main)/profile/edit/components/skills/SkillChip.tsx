import type { Skill } from "./skillTypes";

type SkillChipProps = {
  skill: Skill;
  onEdit: (skill: Skill) => void;
  onDelete: (skillId: number) => void;
};

export default function SkillChip({ skill, onEdit, onDelete }: SkillChipProps) {
  return (
    <div className="skill-chip">
      <span>{skill.name}</span>

      <div className="skill-chip-actions">
        <button type="button" onClick={() => onEdit(skill)}>
          Edit
        </button>

        <button type="button" onClick={() => onDelete(skill.id)}>
          ×
        </button>
      </div>
    </div>
  );
}