// Deterministic per-user avatar: initials + HSL hue derived from the user id.
// Used wherever we need a quick visual badge for a volunteer without loading
// an avatar image (admin walkbook groupings, assign screen, etc.).

export function userInitials(fullName: string | null, email: string | null): string {
  if (fullName && fullName.trim().length > 0) {
    const parts = fullName.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
  }
  if (email && email.length > 0) return email[0]!.toUpperCase();
  return "?";
}

// djb2 hash → 0..360 hue. Keeps the same avatar color across pages.
export function userHue(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

export function userAvatarBackground(seed: string): string {
  return `hsl(${userHue(seed)}, 60%, 88%)`;
}

export function userAvatarForeground(seed: string): string {
  return `hsl(${userHue(seed)}, 55%, 30%)`;
}
