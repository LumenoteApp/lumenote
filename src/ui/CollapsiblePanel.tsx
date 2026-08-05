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
  /** Optional section power switch (visible even when collapsed) */
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
};

/** Compact On/Off control for a whole sidebar section. */
export function SectionEnableToggle({
  enabled,
  onChange,
  labelOn = 'On',
  labelOff = 'Off',
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  labelOn?: string;
  labelOff?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      className={`section-enable ${enabled ? 'is-on' : 'is-off'}`}
      title={enabled ? 'Turn section off' : 'Turn section on'}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onChange(!enabled);
      }}
    >
      <span className="section-enable-track" aria-hidden>
        <span className="section-enable-knob" />
      </span>
      <span className="section-enable-text">{enabled ? labelOn : labelOff}</span>
    </button>
  );
}

export function CollapsibleHeader({
  id,
  title,
  open,
  onToggle,
  actions,
  enabled,
  onEnabledChange,
}: HeaderProps) {
  const showEnable = typeof enabled === 'boolean' && typeof onEnabledChange === 'function';

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
        {showEnable && !enabled ? (
          <span className="section-off-badge" aria-hidden>
            Off
          </span>
        ) : null}
      </button>
      <div
        className="panel-header-actions"
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {showEnable ? (
          <SectionEnableToggle enabled={enabled} onChange={onEnabledChange} />
        ) : null}
        {actions}
      </div>
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
  /**
   * When provided with onEnabledChange, shows an On/Off switch in the
   * header so the whole section can be disabled without opening it.
   */
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  children: ReactNode;
};

/**
 * Sidebar panel with click-to-collapse header.
 * Open state is remembered per id across reloads.
 * Optional enable switch turns the visual feature on/off.
 */
export function CollapsiblePanel({
  id,
  title,
  defaultOpen = true,
  className = '',
  actions,
  enabled,
  onEnabledChange,
  children,
}: PanelProps) {
  const [open, toggle] = usePanelOpen(id, defaultOpen);
  const sectionOff = typeof enabled === 'boolean' && !enabled;

  return (
    <section
      className={`panel collapsible-panel ${open ? 'is-open' : 'is-collapsed'}${
        sectionOff ? ' is-section-off' : ''
      } ${className}`.trim()}
    >
      <CollapsibleHeader
        id={id}
        title={title}
        open={open}
        onToggle={toggle}
        actions={actions}
        enabled={enabled}
        onEnabledChange={onEnabledChange}
      />
      {open ? (
        <div
          className={`collapsible-body${sectionOff ? ' is-section-dimmed' : ''}`}
          id={`panel-body-${id}`}
          role="region"
          aria-labelledby={`panel-toggle-${id}`}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
