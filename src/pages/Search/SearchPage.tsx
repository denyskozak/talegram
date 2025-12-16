import {useEffect, useMemo, useRef, useState} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";

import {Card, Input, Title} from "@telegram-apps/telegram-ui";
import {useTranslation} from "react-i18next";

import {catalogApi} from "@/entities/book/api";
import {BookCard} from "@/entities/book/components/BookCard";
import type {Book} from "@/entities/book/types";
import {CategoryTile} from "@/entities/category/components/CategoryTile";
import {SPECIAL_CATEGORY_MAP, isSpecialCategoryId} from "@/entities/category/customCategories";
import type {Category} from "@/entities/category/types";
import {useDebouncedValue} from "@/shared/hooks/useDebouncedValue";
import {useScrollRestoration} from "@/shared/hooks/useScrollRestoration";
import {EmptyState} from "@/shared/ui/EmptyState";
import {ErrorBanner} from "@/shared/ui/ErrorBanner";
import {BookCardSkeleton, CategoryTileSkeleton} from "@/shared/ui/Skeletons";

export default function SearchPage(): JSX.Element {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
    const debouncedQuery = useDebouncedValue(query, 250);
    const trimmedQuery = debouncedQuery.trim();
    const queryTags = useMemo(
        () =>
            trimmedQuery
                .split(/\s+/)
                .map((chunk) => chunk.replace(/^#/, "").trim())
                .filter((chunk) => chunk.length > 0 && chunk !== ""),
        [trimmedQuery],
    );
    const [books, setBooks] = useState<Book[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useScrollRestoration("search-page");

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (trimmedQuery) {
            setSearchParams({q: trimmedQuery}, {replace: true});
        } else {
            setSearchParams({}, {replace: true});
        }
    }, [setSearchParams, trimmedQuery]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!trimmedQuery) {
                setBooks([]);
                setCategories([]);
                setIsLoading(false);
                setError(null);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);
                const [bookResponse, categoryResponse] = await Promise.all([
                    catalogApi.listBooks({
                        search: queryTags.length === 0 ? trimmedQuery : undefined,
                        tags: queryTags.length > 0 ? queryTags : undefined,
                        limit: 20,
                    }),
                    catalogApi.listCategories({
                        search: trimmedQuery,
                        language: i18n.language,
                    }),
                ]);

                if (cancelled) {
                    return;
                }

                setBooks(bookResponse.items);
                setCategories(categoryResponse);
            } catch (err) {
                if (!cancelled) {
                    console.error(err);
                    setError(t("search.error"));
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [i18n.language, queryTags, trimmedQuery, t, refreshToken]);

    const handleCategoryClick = (category: Category) => {
        if (isSpecialCategoryId(category.id)) {
            navigate(SPECIAL_CATEGORY_MAP[category.id].path);
            return;
        }

        navigate(`/category/${category.id}`);
    };

    const showEmptyPrompt = !trimmedQuery && !isLoading;

    return (
        <main style={{padding: "16px 16px 32px", margin: "0 auto", maxWidth: 720}}>
            <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12}}>
                <Title level="1" weight="2">
                    {t("search.title")}
                </Title>
            </div>
            <Card style={{margin: "16px 0"}}>
                <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("search.placeholder")}
                    aria-label={t("search.placeholder")}
                    autoFocus
                    ref={(ref) => {
                        inputRef.current = ref;
                    }}
                />
            </Card>

            {error && <ErrorBanner message={error} onRetry={() => setRefreshToken((value) => value + 1)}/>}

            {showEmptyPrompt && (
                <EmptyState title={t("search.empty.title")} description={t("search.empty.description")}/>
            )}

            {isLoading && (
                <div style={{display: "flex", flexDirection: "column", gap: 24}}>
                    <div style={{display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))"}}>
                        {Array.from({length: 4}).map((_, index) => (
                            <CategoryTileSkeleton key={`category-skeleton-${index}`}/>
                        ))}
                    </div>
                    <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                        {Array.from({length: 3}).map((_, index) => (
                            <BookCardSkeleton key={`book-skeleton-${index}`}/>
                        ))}
                    </div>
                </div>
            )}

            {!isLoading && trimmedQuery && (
                <div style={{display: "flex", flexDirection: "column", gap: 24}}>
                    <section>
                        <Title level="2" weight="2" style={{marginBottom: 12}}>
                            {t("search.results.categories")}
                        </Title>
                        {categories.length > 0 ? (
                            <div style={{display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))"}}>
                                {categories.map((category) => (
                                    <CategoryTile
                                        key={category.id}
                                        category={category}
                                        onClick={() => handleCategoryClick(category)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                title={t("search.results.noCategories")}
                                description={t("search.results.adjustQuery")}
                            />
                        )}
                    </section>

                    <section>
                        <Title level="2" weight="2" style={{marginBottom: 12}}>
                            {t("search.results.books")}
                        </Title>
                        {books.length > 0 ? (
                            <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                                {books.map((book) => (
                                    <BookCard
                                        key={book.id}
                                        book={book}
                                        onClick={() => navigate(`/book/${book.id}`)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                title={t("search.results.noBooks")}
                                description={t("search.results.adjustQuery")}
                            />
                        )}
                    </section>
                </div>
            )}
        </main>
    );
}
