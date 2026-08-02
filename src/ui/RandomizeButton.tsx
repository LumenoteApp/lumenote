import type { ReactNode } from 'react';

type Props = {
  onClick: () => void;
  label?: string;
  title?: string;
  /** Slightly quieter style for secondary placement */
  subtle?: boolean;
};

export function RandomizeButton({
  onClick,
  label = 'Randomize',
  title,
  subtle = false,
}: Props) {
  return (
    <button
      type="button"
      className={`btn compact-btn randomize-btn ${subtle ? 'subtle' : 'primary'}`}
      onClick={onClick}
      title={title ?? `Randomize ${label.toLowerCase()} parameters`}
    >
      🎲 {label}
    </button>
  );
}

type HeaderProps = {
  title: string;
  onRandomize: () => void;
  randomizeLabel?: string;
  children?: ReactNode;
};

export function PanelHeader({
  title,
  onRandomize,
  randomizeLabel = 'Randomize',
  children,
}: HeaderProps) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      <div className="panel-header-actions">
        {children}
        <RandomizeButton onClick={onRandomize} label={randomizeLabel} />
      </div>
    </div>
  );
}
