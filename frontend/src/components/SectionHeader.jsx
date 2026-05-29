const SectionHeader = ({ eyebrow, title, subtitle, align = "left", className = "" }) => {
  const alignment = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  return (
    <div className={`${alignment} ${className}`}>
      {eyebrow && <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{eyebrow}</p>}
      {title && <h2 className="mt-2 text-3xl font-bold text-white md:text-4xl">{title}</h2>}
      {subtitle && <p className="mt-2 text-sm text-slate-300 md:text-base">{subtitle}</p>}
    </div>
  );
};

export default SectionHeader;
