"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const context = useContext(DropdownMenuContext);

  if (!context) {
    throw new Error("DropdownMenu components must be used inside DropdownMenu");
  }

  return context;
}

export function DropdownMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);

  return (
    <DropdownMenuContext.Provider value={value}>
      <div className="dropdown-menu-root">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

type DropdownMenuTriggerProps = {
  asChild?: boolean;
  children: ReactElement;
};

export function DropdownMenuTrigger({
  asChild = false,
  children,
}: DropdownMenuTriggerProps) {
  const { open, setOpen } = useDropdownMenuContext();

  if (asChild && isValidElement(children)) {
    return cloneElement(
      children as ReactElement<HTMLAttributes<HTMLElement>>,
      {
        onClick: () => setOpen(!open),
        "aria-expanded": open,
        "aria-haspopup": "menu",
      }
    );
  }

  return (
    <button
      type="button"
      className="btn-outline"
      aria-expanded={open}
      aria-haspopup="menu"
      onClick={() => setOpen(!open)}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({ children }: { children: ReactNode }) {
  const { open } = useDropdownMenuContext();

  if (!open) return null;

  return (
    <div className="dropdown-menu-content" role="menu">
      {children}
    </div>
  );
}

export function DropdownMenuGroup({ children }: { children: ReactNode }) {
  return <div className="dropdown-menu-group">{children}</div>;
}

export function DropdownMenuItem({ children }: { children: ReactNode }) {
  return (
    <div className="dropdown-menu-item" role="menuitem">
      {children}
    </div>
  );
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <div className="dropdown-menu-label">{children}</div>;
}

export function DropdownMenuSeparator() {
  return <div className="dropdown-menu-separator" />;
}
