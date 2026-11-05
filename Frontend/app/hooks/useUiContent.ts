"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchUiContent,
  getUiContentErrorMessage,
  uiText,
  type UiContent,
} from "../api/ui-content";

/**
 * Load the page texts (the ones admins can edit) and give back `text()`.
 *
 * Use it like this:
 *   const text = useUiContent();
 *   <h1>{text("signinWelcome", "Welcome back")}</h1>
 *
 * Until the texts arrive (or if they fail to load) you see the English
 * fallback, so the page always works.
 */
export function useUiContent() {
  const content = useUiContentRecord();

  return useCallback(
    (key: string, fallback: string) => uiText(content, key, fallback),
    [content]
  );
}

/**
 * The same texts as one object, like { email: "Email", ... }.
 * For older components that read `content.email || "Email"` directly.
 * New code should use useUiContent() above.
 */
export function useUiContentRecord(): UiContent {
  const [content, setContent] = useState<UiContent>({});

  useEffect(() => {
    // If the user leaves the page before the texts arrive, don't update it.
    let pageIsOpen = true;

    fetchUiContent()
      .then((data) => {
        if (pageIsOpen) setContent(data);
      })
      .catch((error: unknown) => {
        // Not fatal: the fallbacks are shown instead.
        console.warn(getUiContentErrorMessage(error));
      });

    return () => {
      pageIsOpen = false;
    };
  }, []);

  return content;
}
