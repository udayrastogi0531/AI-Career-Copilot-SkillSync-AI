const LoadingSkeleton = ({ rows = 3, className = "" }) => {
  return (
    <div className={`premium-card ${className}`}>
      <div className="space-y-3">
        {[...Array(rows)].map((_, index) => (
          <div key={index} className="skeleton h-4 w-full" />
        ))}
      </div>
    </div>
  );
};

export default LoadingSkeleton;
