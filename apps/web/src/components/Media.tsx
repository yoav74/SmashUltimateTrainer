import { useEffect, useState } from 'react';
import { portraitUrl } from '../lib/assets';

export function Portrait({ slug, name, size = 56, className = '' }: { slug: string; name: string; size?: number; className?: string }) {
  return (
    <img
      className={`portrait ${className}`}
      src={portraitUrl(slug)}
      alt={name}
      width={size}
      height={Math.round(size * 1.15)}
      style={{ width: size, height: Math.round(size * 1.15) }}
      loading="lazy"
    />
  );
}

/**
 * Hitbox GIFs from UFD are big (Kazuya's run 2-5 MB), so show a loading state
 * instead of an empty box, and say so when a move has no GIF at all.
 */
export function HitboxGif({ src, alt, className = '', lazy = false }: { src: string | undefined; alt: string; className?: string; lazy?: boolean }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  useEffect(() => setState('loading'), [src]);

  if (!src) return <div className={`gif-box empty ${className}`}>No hitbox GIF</div>;
  return (
    <div className={`gif-box ${state} ${className}`}>
      {state === 'loading' && <span className="gif-status">Loading GIF…</span>}
      {state === 'error' && <span className="gif-status">GIF failed to load</span>}
      <img key={src} src={src} alt={alt} loading={lazy ? 'lazy' : 'eager'} onLoad={() => setState('ok')} onError={() => setState('error')} />
    </div>
  );
}

/** Warm the browser cache for GIFs the next question will need. */
export function preloadImages(urls: string[]) {
  for (const u of urls) {
    const img = new Image();
    img.src = u;
  }
}
