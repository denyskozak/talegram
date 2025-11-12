function slugify(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function normalizeCategoryId(value: string): string {
  const slug = slugify(value);
  return slug.length > 0 ? slug : 'general';
}

export function formatCategoryTitle(categoryId: string): string {
  return categoryId
    .split('-')
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toLocaleUpperCase() + segment.slice(1))
    .join(' ');
}
