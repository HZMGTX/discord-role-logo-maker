/** Turn a role name into a safe, readable file name fragment. */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug || 'icon';
}

export function exportFilename(roleName: string, size: number): string {
  return `role-icon-${slugify(roleName)}-${size}.png`;
}
