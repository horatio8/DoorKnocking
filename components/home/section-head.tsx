// Shared centered section header used by How it works, Pricing, Final CTA,
// FAQ. Includes the thin star separator the comp uses on the first-up
// section.

export function SectionHead({
  eyebrow,
  heading,
  body,
  starSep,
}: {
  eyebrow: string;
  heading: string;
  body?: string;
  starSep?: boolean;
}) {
  return (
    <div className="mx-auto mb-12 max-w-[680px] text-center">
      {starSep ? (
        <div className="mb-3.5 flex items-center justify-center gap-3.5 text-[9px] tracking-[0.3em] text-oxblood before:block before:h-px before:max-w-20 before:flex-1 before:border-t before:border-rule before:content-[''] after:block after:h-px after:max-w-20 after:flex-1 after:border-t after:border-rule after:content-['']">
          ★&nbsp;★&nbsp;★
        </div>
      ) : null}
      <div className="mb-3.5 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-oxblood">
        {eyebrow}
      </div>
      <h2 className="mb-3.5 font-serif text-[38px] font-semibold leading-[1.08] tracking-[-0.01em] text-civic-navy">
        {heading}
      </h2>
      {body ? (
        <p className="text-[16.5px] leading-[1.55] text-ink-2">{body}</p>
      ) : null}
    </div>
  );
}
