/** Avatar with an automatic ui-avatars fallback when no image is set. */
export function Avatar({ src, name = 'User', size = 40, className = '' }) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;
  return (
    <img
      src={src || fallback}
      alt={name}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      onError={(e) => {
        if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
      }}
      className={`rounded-full object-cover shadow-sm ${className}`}
    />
  );
}

export default Avatar;
