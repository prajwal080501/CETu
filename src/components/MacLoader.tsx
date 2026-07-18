/**
 * macOS-style activity spinner — 12 rounded bars arranged radially, each fading
 * in sequence to create the classic clockwise "chasing light" effect. Pure CSS
 * (keyframe `mac-spinner-fade` in globals.css); inherits `currentColor`.
 */
export function MacLoader({
  size = 34,
  label,
  className = "",
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  const bars = 12;
  const dur = 1; // seconds
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div style={{ width: size, height: size }} className="relative text-muted-foreground">
        {Array.from({ length: bars }).map((_, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: Math.max(2, size * 0.08),
              height: size * 0.27,
              borderRadius: size,
              background: "currentColor",
              transformOrigin: "center",
              transform: `translate(-50%, -50%) rotate(${i * (360 / bars)}deg) translateY(-${(size * 0.34).toFixed(1)}px)`,
              animation: `mac-spinner-fade ${dur}s linear infinite`,
              animationDelay: `${((i - bars) / bars) * dur}s`,
              opacity: 0.15,
            }}
          />
        ))}
      </div>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}
