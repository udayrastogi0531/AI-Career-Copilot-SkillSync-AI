const Loader = ({ label = "Processing..." }) => {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-300">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-neon border-t-transparent" />
      <span>{label}</span>
    </div>
  );
};

export default Loader;
