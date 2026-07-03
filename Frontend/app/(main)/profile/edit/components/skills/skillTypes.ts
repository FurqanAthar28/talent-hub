export type Skill = {
  id: number;
  name: string;
};

export type SkillFormState = {
  name: string;
};

export const emptySkillForm: SkillFormState = {
  name: "",
};