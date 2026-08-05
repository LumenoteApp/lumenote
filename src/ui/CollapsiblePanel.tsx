import {
  useCallback,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'lumenote-sidebar-collapse-v1';

function readMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Persist open/closed per panel id (sidebar collapses). */
export function usePanelOpen(id: string, defaultOpen = true): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    const map = readMap();
    return id in map ? !!map[id] : defaultOpen;
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      const map = readMap();
      map[id] = next;
      writeMap(map);
      return next;
    });
  }, [id]);

  return [open, toggle];
}

type HeaderProps = {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Randomize / other controls - clicks do not toggle collapse */
  actions?: ReactNode;
};

export function CollapsibleHeader({ id, title, open, onToggle, actions }: HeaderProps) {
  return (
    <div className="panel-header collapsible-header">
      <button
        type="button"
        className="collapsible-toggle"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`panel-body-${id}`}
        id={`panel-toggle-${id}`}
      >
        <span className="collapsible-chevron" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
        <h2>{title}</h2>
      </button>
      {actions ? (
        <div
          className="panel-header-actions"
          onClick={(e: MouseEvent) => e.stopPropagation()}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

type PanelProps = {
  /** Stable id for localStorage (e.g. scene-presets) */
  id: string;
  title: string;
  defaultOpen?: boolean;
  className?: string;
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * Sidebar panel with click-to-collapse header.
 * Open state is remembered per id across reloads.
 */
export function CollapsiblePanel({
  id,
  title,
  defaultOpen = true,
  className = '',
  actions,
  children,
}: PanelProps) {
  const [open, toggle] = usePanelOpen(id, defaultOpen);

  return (
    <section
      className={`panel collapsible-panel ${open ? 'is-open' : 'is-collapsed'} ${className}`.trim()}
    >
      <CollapsibleHeader
        id={id}
        title={title}
        open={open}
        onToggle={toggle}
        actions={actions}
      />
      {open ? (
        <div className="collapsible-body" id={`panel-body-${id}`} role="region" aria-labelledby={`panel-toggle-${id}`}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
