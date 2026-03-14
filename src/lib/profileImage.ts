export type ProfileImageSource = {
  profilePictureUrl?: string | null;
  profilePhotoURL?: string | null;
  photoURL?: string | null;
  avatarUrl?: string | null;
};

export function resolveProfileImageUrl(source?: ProfileImageSource | null): string | null {
  if (!source) return null;
  const candidates = [
    source.profilePictureUrl,
    source.profilePhotoURL,
    source.photoURL,
    source.avatarUrl,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}
