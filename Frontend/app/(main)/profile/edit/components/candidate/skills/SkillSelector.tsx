"use client";

import { useEffect, useRef, useState } from "react";
import { getSkillOptions } from "@/app/services/skills";

type Skill = {
  id: number;
  name: string;
};

type SkillSelectorProps = {
  skills: Skill[];
  onSelect: (skillName: string) => Promise<void>;
  saving: boolean;
};

export default function SkillSelector({
  skills,
  onSelect,
  saving,
}: SkillSelectorProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadSkillOptions() {
      try {
        const skillOptions = await getSkillOptions();
        setOptions(skillOptions);
      } catch {
        setOptions([]);
      }
    }

    void loadSkillOptions();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedSkillNames = (skills ?? []).map((skill) =>
    skill.name.toLowerCase()
  );

  const customSkillName = query.trim();
  const normalizedCustomSkillName = customSkillName.toLowerCase();

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options.filter((skill) => {
    const alreadySelected = selectedSkillNames.includes(skill.toLowerCase());
    const matchesSearch = skill.toLowerCase().includes(normalizedQuery);

    return !alreadySelected && matchesSearch;
  });

  const canAddCustomSkill =
    customSkillName.length > 0 &&
    !selectedSkillNames.includes(normalizedCustomSkillName) &&
    !options.some((skill) => skill.toLowerCase() === normalizedCustomSkillName);

  async function handleSelectSkill(skillName: string) {
    await onSelect(skillName);
    setQuery("");
    setIsOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || saving) return;

    event.preventDefault();

    if (filteredOptions.length > 0) {
      void handleSelectSkill(filteredOptions[0]);
      return;
    }

    if (canAddCustomSkill) {
      void handleSelectSkill(customSkillName);
    }
  }

  return (
    <div className="skill-selector" ref={wrapperRef}>
      <input
        type="text"
        value={query}
        placeholder="Search and add a skill..."
        className="skill-selector-input"
        disabled={saving}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {isOpen && (
        <div className="skill-selector-dropdown">
          {filteredOptions.length > 0 &&
            filteredOptions.map((skill) => (
              <button
                type="button"
                key={skill}
                className="skill-selector-option"
                disabled={saving}
                onClick={() => handleSelectSkill(skill)}
              >
                {skill}
              </button>
            ))}

          {canAddCustomSkill ? (
            <button
              type="button"
              className="skill-selector-option"
              disabled={saving}
              onClick={() => handleSelectSkill(customSkillName)}
            >
              Add &quot;{customSkillName}&quot;
            </button>
          ) : (
            filteredOptions.length === 0 && (
              <p className="skill-selector-empty">No matching skills found.</p>
            )
          )}
        </div>
      )}
    </div>
  );
}

