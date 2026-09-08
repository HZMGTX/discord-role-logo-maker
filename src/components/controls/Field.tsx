import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  htmlFor?: string;
  value?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, value, children, className }: FieldProps) {
  const labelContent = (
    <>
      <span>{label}</span>
      {value !== undefined && <span className="field__value">{value}</span>}
    </>
  );
  return (
    <div className={className ? `field ${className}` : 'field'}>
      {htmlFor ? (
        <label className="field__label" htmlFor={htmlFor}>
          {labelContent}
        </label>
      ) : (
        <span className="field__label">{labelContent}</span>
      )}
      {children}
    </div>
  );
}
