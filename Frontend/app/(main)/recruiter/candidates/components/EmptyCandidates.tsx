import { SearchX } from "lucide-react";

import { EmptyState } from "@/app/components/ui";

/** No results: say so, and offer the quickest fix. */
export default function EmptyCandidates({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <EmptyState
      icon={SearchX}
      title="No candidates match these filters"
      text="Try a broader skill, another city, or clear the filters to see everyone."
      action={
        <button type="button" className="btn-primary" onClick={onClearFilters}>
          Clear filters
        </button>
      }
    />
  );
}
