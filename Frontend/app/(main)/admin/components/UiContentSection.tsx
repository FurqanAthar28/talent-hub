"use client";

import type { Dispatch, SetStateAction } from "react";

import type { UiContent } from "../../../api/ui-content";
import type { AdminUiContentItem } from "../types";

type Props = {
  uiContent: UiContent;
  items: AdminUiContentItem[];
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  draftValues: Record<string, string>;
  setDraftValues: Dispatch<SetStateAction<Record<string, string>>>;
  savingKey: string | null;
  saveUiContent: (item: AdminUiContentItem) => Promise<void>;
};

export default function UiContentSection({
  uiContent,
  items,
  searchTerm,
  setSearchTerm,
  draftValues,
  setDraftValues,
  savingKey,
  saveUiContent,
}: Props) {
  return (
    <div className="card">
      <div className="card-header flex-between">
        <div>
          <h3>{uiContent.adminUiContent || "UI Content"}</h3>
          <p className="muted text-sm">
            {uiContent.adminUiContentIntro ||
              "Edit application text without changing code or running SQL."}
          </p>
        </div>

        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={
            uiContent.adminUiContentSearchPlaceholder ||
            "Search content keys or values"
          }
          className="admin-search-input"
        />
      </div>

      <div className="card-body">
        {items.length === 0 ? (
          <p className="text-center muted">
            {uiContent.adminNoUiContent || "No UI content found."}
          </p>
        ) : (
          <div className="admin-ui-content-list">
            {items.map((item) => {
              const draftValue = draftValues[item.key] ?? item.value;
              const hasChanges = draftValue !== item.value;

              return (
                <div key={item.key} className="admin-ui-content-row">
                  <div className="admin-ui-content-key">
                    <span>{item.key}</span>
                  </div>

                  <textarea
                    value={draftValue}
                    onChange={(event) =>
                      setDraftValues((previousValues) => ({
                        ...previousValues,
                        [item.key]: event.target.value,
                      }))
                    }
                    rows={2}
                  />

                  <button
                    type="button"
                    className="btn-outline btn-sm"
                    disabled={!hasChanges || savingKey === item.key}
                    onClick={() => saveUiContent(item)}
                  >
                    {savingKey === item.key
                      ? uiContent.adminSavingUiContent || "Saving..."
                      : uiContent.adminSaveUiContent || "Save"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
