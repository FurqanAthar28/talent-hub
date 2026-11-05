"use client";

/**
 * The "⋯" menu at the end of a row.
 *
 * Keyboard: Enter/Space opens it, ↑ ↓ move, Escape closes and returns focus
 * to the "⋯" button. A click outside, scrolling or resizing also closes it.
 *
 * It's drawn with position: fixed next to the button, so a card with
 * overflow: hidden can't cut it off, and it opens upwards near the bottom
 * of the screen.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { MoreHorizontal } from "lucide-react";

import { cx } from "@/app/components/ui";
import styles from "../users.module.css";

export type MenuItem =
  | { kind: "item"; id: string; label: string; danger?: boolean; onSelect: () => void }
  | { kind: "divider"; id: string };

const MENU_WIDTH = 220;
const GAP = 6;

export default function RowMenu({ label, items, disabled }: { label: string; items: MenuItem[]; disabled?: boolean }) {
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Where the "⋯" button was when the menu opened (to notice real scrolling).
  const anchorTop = useRef(0);
  const open = position !== null;

  function openMenu() {
    const box = buttonRef.current?.getBoundingClientRect();
    if (!box) return;
    anchorTop.current = box.top;
    const roughHeight = items.length * 40 + 16;
    const opensUp = box.bottom + roughHeight + GAP > window.innerHeight && box.top > roughHeight;
    setPosition({
      left: Math.max(8, Math.min(box.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
      ...(opensUp ? { bottom: window.innerHeight - box.top + GAP } : { top: box.bottom + GAP }),
    });
  }

  function close(returnFocus = true) {
    setPosition(null);
    if (returnFocus) buttonRef.current?.focus();
  }

  // While open: close on outside click, scroll or resize; focus the first item.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();

    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setPosition(null);
    }
    const shut = () => setPosition(null);
    // Scroll events arrive a moment late, so one from just BEFORE opening can
    // land here. Only close if the button really moved (the page scrolled).
    function onScroll() {
      const top = buttonRef.current?.getBoundingClientRect().top ?? 0;
      if (Math.abs(top - anchorTop.current) > 2) setPosition(null);
    }
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", shut);
    };
  }, [open]);

  function onMenuKey(event: React.KeyboardEvent) {
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    } else if (event.key === "Tab") {
      setPosition(null);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cx(styles.menuButton, open && styles.menuButtonOpen)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>

      {open && (
        <div ref={menuRef} role="menu" aria-label={label} className={styles.menu} style={{ ...position, width: MENU_WIDTH }} onKeyDown={onMenuKey}>
          {items.map((item) =>
            item.kind === "divider" ? (
              <hr key={item.id} className={styles.menuDivider} />
            ) : (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={cx(styles.menuItem, item.danger && styles.menuItemDanger)}
                onClick={() => {
                  close(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </>
  );
}
