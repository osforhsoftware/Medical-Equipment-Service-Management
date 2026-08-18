/** Case-insensitive-ish text search filter (MySQL collation-dependent). */
export function searchContains(value: string) {
  return { contains: value };
}
