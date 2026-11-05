"use client";

/**
 * Recruiter "Find candidates" page: a search box, filters, and the results.
 *
 * HOW SEARCHING WORKS
 * 1. Every key press updates the boxes straight away (so typing feels fast).
 * 2. useDebouncedValue waits until you STOP typing for a moment.
 * 3. Only then do we ask Django, once.
 * 4. If a new search starts before the old one answers, the old one is
 *    cancelled, so an old answer can never replace newer results.
 */

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { SEARCH_DEBOUNCE_MS } from "@/app/config/constants";
import { useDebouncedValue } from "@/app/hooks/useDebouncedValue";
import {
  getRecruiterCandidates,
  type RecruiterCandidate,
} from "@/app/services/recruiter/candidates";
import { Notice, ui } from "@/app/components/ui";
import RecruiterPageHeader from "../components/RecruiterPageHeader";
import styles from "./candidates.module.css";
import CandidateFilters from "./components/CandidateFilters";
import CandidateGrid from "./components/CandidateGrid";
import CandidateSearchBar from "./components/CandidateSearchBar";
import EmptyCandidates from "./components/EmptyCandidates";

const NO_FILTERS = { search: "", skill: "", location: "", openToWorkOnly: false };

// useSearchParams() needs a <Suspense> around it in Next.js.
export default function RecruiterCandidatesPage() {
  return (
    <Suspense fallback={null}>
      <CandidatesSearch />
    </Suspense>
  );
}

function CandidatesSearch() {
  // The dashboard can send us here with "?search=django" or "?skill=Python".
  const searchParams = useSearchParams();

  const [candidates, setCandidates] = useState<RecruiterCandidate[]>([]);
  const [firstLoad, setFirstLoad] = useState(true); // nothing to show yet
  const [searching, setSearching] = useState(false); // a search is running
  const [error, setError] = useState("");

  // What is in the boxes right now (starting with anything from the address).
  const [filters, setFilters] = useState(() => ({
    ...NO_FILTERS,
    search: searchParams.get("search") ?? "",
    skill: searchParams.get("skill") ?? "",
  }));

  // The same filters, but only after typing has paused.
  const debouncedFilters = useDebouncedValue(filters, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    // An AbortController can cancel a request that is still on its way.
    const controller = new AbortController();

    async function search() {
      setSearching(true);

      try {
        const results = await getRecruiterCandidates(
          {
            search: debouncedFilters.search,
            skill: debouncedFilters.skill,
            location: debouncedFilters.location,
            openToWork: debouncedFilters.openToWorkOnly ? true : undefined,
          },
          controller.signal
        );

        setCandidates(results);
        setError("");
      } catch (searchError) {
        // We cancelled it on purpose (a newer search started): not an error.
        if (controller.signal.aborted) return;

        setCandidates([]);
        setError(
          searchError instanceof Error ? searchError.message : "Unable to load candidates."
        );
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
          setFirstLoad(false);
        }
      }
    }

    void search();

    // Runs when the filters change again (or the page closes): cancel this search.
    return () => controller.abort();
  }, [debouncedFilters]);

  // Change ONE filter, keep the others.
  function updateFilter<Key extends keyof typeof NO_FILTERS>(
    key: Key,
    value: (typeof NO_FILTERS)[Key]
  ) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function clearFilters() {
    setFilters(NO_FILTERS);
  }

  // How many filters are switched on (shown as a number in the header).
  const activeFiltersCount = [
    filters.search.trim(),
    filters.skill.trim(),
    filters.location.trim(),
    filters.openToWorkOnly,
  ].filter(Boolean).length;

  return (
    <main className={ui.page}>
      <RecruiterPageHeader
        title="Find candidates"
        description="Search by skill, city or job title, then open a profile to see projects and CV."
      />

      <div className={ui.stack}>
        {/* ---------- Search and filters ---------- */}
        <section className={ui.panel} aria-label="Search and filters">
          <div className={styles.filters}>
            <CandidateSearchBar
              searchQuery={filters.search}
              onSearchChange={(value) => updateFilter("search", value)}
            />
            <CandidateFilters
              skillFilter={filters.skill}
              locationFilter={filters.location}
              onSkillChange={(value) => updateFilter("skill", value)}
              onLocationChange={(value) => updateFilter("location", value)}
            />
          </div>

          <div className={styles.filterFooter}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={filters.openToWorkOnly}
                onChange={(event) => updateFilter("openToWorkOnly", event.target.checked)}
              />
              Only people open to work
            </label>
            {activeFiltersCount > 0 && (
              <button type="button" className={styles.clearButton} onClick={clearFilters}>
                Clear filters ({activeFiltersCount})
              </button>
            )}
          </div>
        </section>

        {/* ---------- Results ---------- */}
        <section className={`${ui.panel} ${ui.panelFlush}`} aria-label="Results">
          <div className={styles.resultsHeader} aria-live="polite">
            <span>
              {firstLoad ? (
                "Loading candidates..."
              ) : (
                <>
                  <span className={styles.resultsCount}>{candidates.length}</span>{" "}
                  {candidates.length === 1 ? "candidate" : "candidates"}
                </>
              )}
            </span>
            {/* The old results stay on screen while a new search runs. */}
            {searching && !firstLoad && <span>Searching...</span>}
          </div>

          {firstLoad ? null : error ? (
            <div style={{ padding: 24 }}>
              <Notice tone="error">{error}</Notice>
            </div>
          ) : candidates.length > 0 ? (
            <CandidateGrid candidates={candidates} />
          ) : (
            <EmptyCandidates onClearFilters={clearFilters} />
          )}
        </section>
      </div>
    </main>
  );
}
