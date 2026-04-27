import { useState } from "react";

interface AvatarProps {
  photoURL: string | null;
  fallbackText: string;
  /** Class applied to both the image and the initials fallback (for sizing/shape). */
  className: string;
  /** Extra class applied only to the initials fallback. */
  fallbackClassName?: string;
}

/**
 * Profile photo with a graceful initials fallback.
 *
 * `referrerPolicy="no-referrer"` is required for Google profile photos
 * (`lh3.googleusercontent.com`) — Google rejects requests when the browser
 * sends an origin/referer it doesn't recognise, returning 403 and a broken
 * image. Suppressing the referer makes the request behave like a public
 * fetch and the image loads.
 */
export function Avatar({ photoURL, fallbackText, className, fallbackClassName }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initial = (fallbackText || "?").charAt(0).toUpperCase();
  if (!photoURL || failed) {
    const cls = fallbackClassName ? `${className} ${fallbackClassName}` : className;
    return (
      <span className={cls} aria-hidden>
        {initial}
      </span>
    );
  }
  return (
    <img
      src={photoURL}
      alt=""
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
