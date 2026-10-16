/** Avatar with an automatic ui-avatars fallback when no image is set. */
export function Avatar({ src, name = 'User', size = 40, className = '' }) {
  const imageUrl = typeof src === 'string' ? src : src?.url || '';
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=6366f1&color=fff`;
  return (
    <img
      src={imageUrl || fallback}
      alt={name || 'Avatar'}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      onError={(e) => {
        if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
      }}
      className={`rounded-full object-cover shadow-sm shrink-0 ${className}`}
    />
  );
}

export default Avatar;
