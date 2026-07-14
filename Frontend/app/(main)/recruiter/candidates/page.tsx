"use client";

import { useEffect, useMemo, useState } from "react";

import RecruiterPageHeader from "../components/RecruiterPageHeader";
import {
  getRecruiterCandidates,
  type RecruiterCandidate,
} from "@/app/services/recruiter/candidates";

import CandidateFilters from "./components/CandidateFilters";
import CandidateGrid from "./components/CandidateGrid";
import CandidateSearchBar from "./components/CandidateSearchBar";
import EmptyCandidates from "./components/EmptyCandidates";

export default function RecruiterCandidatesPage() {
  const [candidates, setCandidates] = useState<RecruiterCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [openToWorkOnly, setOpenToWorkOnly] = useState(false);

  useEffect(() => {
    async function loadCandidates() {
      setLoading(true);

      try {
        const data = await getRecruiterCandidates({
          search: searchQuery,
          skill: skillFilter,
          location: locationFilter,
          openToWork: openToWorkOnly ? true : undefined,
        });

        setCandidates(data);
      } finally {
        setLoading(false);
      }
    }

    void loadCandidates();
  }, [searchQuery, skillFilter, locationFilter, openToWorkOnly]);

  const activeFiltersCount = useMemo(() => {
    return [
      searchQuery,
      skillFilter,
      locationFilter,
      openToWorkOnly ? "openToWork" : "",
    ].filter(Boolean).length;
  }, [searchQuery, skillFilter, locationFilter, openToWorkOnly]);

  function clearFilters() {
    setSearchQuery("");
    setSkillFilter("");
    setLocationFilter("");
    setOpenToWorkOnly(false);
  }

  return (
    <main className="page-shell recruiter-ats-page">
      <RecruiterPageHeader
        eyebrow="Recruiter ATS"
        title="Find Candidates"
        description="Search, filter, and review talent using backend-powered recruiter tools."
        total={candidates.length}
        totalLabel="Candidates Found"
        activeFilters={activeFiltersCount}
        onClearFilters={clearFilters}
      />

      <section className="ats-control-panel">
        <CandidateSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <CandidateFilters
          skillFilter={skillFilter}
          locationFilter={locationFilter}
          openToWorkOnly={openToWorkOnly}
          onSkillChange={setSkillFilter}
          onLocationChange={setLocationFilter}
          onOpenToWorkChange={setOpenToWorkOnly}
          onClearFilters={clearFilters}
        />
      </section>

      {loading ? (
        <section className="ats-empty-state">
          <h2>Loading candidates...</h2>
          <p>Fetching the latest recruiter candidate data.</p>
        </section>
      ) : candidates.length > 0 ? (
        <CandidateGrid candidates={candidates} />
      ) : (
        <EmptyCandidates onClearFilters={clearFilters} />
      )}
    </main>
  );
}