"use client";

/**
 * The "Search and add a skill..." box.
 *
 * Type to filter the suggested skills, then click one (or press Enter to
 * add the first match). If your skill isn't in the list, you can add it
 * as typed with the "Add ..." button.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { getSkillOptions, type Skill } from "@/app/services/skills";

type SkillSelectorProps = {
  skills: Skill[]; // skills I already have (we hide these from the list)
  saving: boolean;
  // Returns true when the skill was added, so we can empty the box.
  onSelect: (skillName: string) => Promise<boolean>;
};

export default function SkillSelector({ skills, saving, onSelect }: SkillSelectorProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Load the suggested skills once.
  useEffect(() => {
    let pageIsOpen = true;

    getSkillOptions()
      .then((list) => {
        if (pageIsOpen) setOptions(list);
      })
      .catch((err: unknown) => {
        // Not fatal: you can still type your own skill.
        console.warn("Skill suggestions unavailable:", err);
      });

    return () => {
      pageIsOpen = false;
    };
  }, []);

  // Close the list when you click somewhere else on the page.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compare in lower case, so "python" and "Python" count as the same skill.
  const typed = query.trim();
  const typedLower = typed.toLowerCase();
  const mySkillNames = skills.map((skill) => skill.name.toLowerCase());

  const matchingOptions = options.filter((option) => {
    const optionLower = option.toLowerCase();
    return !mySkillNames.includes(optionLower) && optionLower.includes(typedLower);
  });

  const canAddTyped =
    typed.length > 0 &&
    !mySkillNames.includes(typedLower) &&
    !options.some((option) => option.toLowerCase() === typedLower);

  async function addSkill(skillName: string) {
    const added = await onSelect(skillName);

    // Only empty the box when it worked, so a typo can be fixed and retried.
    if (added) {
      setQuery("");
      setIsOpen(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key !== "Enter" || saving) return;

    event.preventDefault(); // Enter must not submit the big profile form

    if (matchingOptions.length > 0) {
      void addSkill(matchingOptions[0]);
    } else if (canAddTyped) {
      void addSkill(typed);
    }
  }

  return (
    <div className="skill-selector" ref={wrapperRef}>
      <input
        type="text"
        value={query}
        placeholder="Search and add a skill..."
        aria-label="Search and add a skill"
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
          {matchingOptions.map((option) => (
            <button
              type="button"
              key={option}
              className="skill-selector-option"
              disabled={saving}
              onClick={() => void addSkill(option)}
            >
              {option}
            </button>
          ))}

          {canAddTyped && (
            <button
              type="button"
              className="skill-selector-option"
              disabled={saving}
              onClick={() => void addSkill(typed)}
            >
              Add &quot;{typed}&quot;
            </button>
          )}

          {matchingOptions.length === 0 && !canAddTyped && (
            <p className="skill-selector-empty">No matching skills found.</p>
          )}
        </div>
      )}
    </div>
  );
}
