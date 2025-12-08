export const CATEGORY_LABEL_KEY_BY_VALUE: Record<string, string> = {
    // Books
    "Novels / Literary Fiction": "account.publish.form.category.options.book.novels",
    "Philosophy": "account.publish.form.category.options.book.philosophy",
    "Science Fiction": "account.publish.form.category.options.book.scienceFiction",
    "Fantasy": "account.publish.form.category.options.book.fantasy",
    "Mystery & Thrillers": "account.publish.form.category.options.book.mystery",
    "Non-Fiction": "account.publish.form.category.options.book.nonFiction",
    "Self-Help & Psychology": "account.publish.form.category.options.book.selfHelp",
    "History": "account.publish.form.category.options.book.history",
    "Biographies & Memoirs": "account.publish.form.category.options.book.biographies",
    "Business & Finance": "account.publish.form.category.options.book.business",
    "Children’s Literature": "account.publish.form.category.options.book.children",

    // Articles
    "News & Politics": "account.publish.form.category.options.article.news",
    "Science & Technology": "account.publish.form.category.options.article.scienceTech",
    "Business & Economics": "account.publish.form.category.options.article.business",
    "Education": "account.publish.form.category.options.article.education",
    "Sports": "account.publish.form.category.options.article.sports",
    "Entertainment (movies, music, showbiz)": "account.publish.form.category.options.article.entertainment",
    "Travel": "account.publish.form.category.options.article.travel",
    "Lifestyle": "account.publish.form.category.options.article.lifestyle",
    "Health & Medicine": "account.publish.form.category.options.article.health",
    "Culture & Arts": "account.publish.form.category.options.article.culture",

    // Comics
    "Superheroes": "account.publish.form.category.options.comics.superheroes",
    "Manga": "account.publish.form.category.options.comics.manga",
    "Horror": "account.publish.form.category.options.comics.horror",
    "Adventure": "account.publish.form.category.options.comics.adventure",
    "Comedy / Satire": "account.publish.form.category.options.comics.comedy",
    "Crime / Noir": "account.publish.form.category.options.comics.crime",
    "Romance": "account.publish.form.category.options.comics.romance",
    "Historical Comics": "account.publish.form.category.options.comics.historical",
    "Fantasy": "account.publish.form.category.options.comics.fantasy",
    "Science Fiction": "account.publish.form.category.options.comics.scienceFiction",
};

export function getCategoryLabelKey(title: string | undefined): string | null {
    if (!title) return null;
    return CATEGORY_LABEL_KEY_BY_VALUE[title] ?? null;
}
