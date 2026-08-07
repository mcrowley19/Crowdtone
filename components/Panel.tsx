import type { ReactNode } from "react";

/**
 * One report section. The head is a title plus, optionally, a short
 * provenance chip — where the numbers came from, in two or three words
 * instead of a paragraph.
 */
export function Panel({
  title,
  chip,
  id,
  actions,
  children,
}: {
  title: string;
  chip?: string | null;
  id?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="report" id={id}>
      <div className="panelhead">
        <h2>{title}</h2>
        {chip && <span className="prov">{chip}</span>}
        {actions && <span className="panelacts">{actions}</span>}
      </div>
      {children}
    </section>
  );
}
