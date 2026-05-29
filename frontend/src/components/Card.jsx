const Card = ({ title, subtitle, children, className = "" }) => {
  return (
    <div className={`card fade-in-up shadow-panel active:translate-y-0 ${className}`}>
      {title ? <h3 className="font-heading text-lg text-white">{title}</h3> : null}
      {subtitle ? <p className="mt-1 text-sm text-slate-300">{subtitle}</p> : null}
      <div className={title || subtitle ? "mt-4" : ""}>{children}</div>
    </div>
  );
};

export default Card;
