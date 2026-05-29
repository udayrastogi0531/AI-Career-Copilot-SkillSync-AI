import { motion } from "framer-motion";

const EmptyState = ({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCta,
  href,
  className = ""
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`premium-card text-center ${className}`}
    >
      {Icon && (
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <Icon className="h-7 w-7 text-cyan-200" />
        </div>
      )}
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      {description && <p className="mt-2 text-sm text-slate-300">{description}</p>}
      {ctaLabel && href && (
        <motion.a
          href={href}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-glow mt-5 inline-flex items-center justify-center"
        >
          {ctaLabel}
        </motion.a>
      )}
      {ctaLabel && !href && onCta && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-glow mt-5"
          onClick={onCta}
        >
          {ctaLabel}
        </motion.button>
      )}
    </motion.div>
  );
};

export default EmptyState;
