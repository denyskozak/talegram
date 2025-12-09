import {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";

import {Card, SegmentedControl, Tappable, Title} from "@telegram-apps/telegram-ui";
import {useTranslation} from "react-i18next";

import {CategoryTile} from "@/entities/category/components/CategoryTile";
import type {Category} from "@/entities/category/types";
import {
    SPECIAL_CATEGORIES,
    SPECIAL_CATEGORY_MAP,
    type SpecialCategory,
    isSpecialCategoryId,
} from "@/entities/category/customCategories";
import type {Book} from "@/entities/book/types";
import {catalogApi} from "@/entities/book/api";
import {useScrollRestoration} from "@/shared/hooks/useScrollRestoration";
import {EmptyState} from "@/shared/ui/EmptyState";
import {ErrorBanner} from "@/shared/ui/ErrorBanner";
import {CategoryTileSkeleton} from "@/shared/ui/Skeletons";
import {GLOBAL_CATEGORIES, type GlobalCategory} from "@/shared/lib/globalCategories";
import {BookCard} from "@/entities/book/components/BookCard";
import {BookCardSkeleton} from "@/shared/ui/Skeletons";

export default function HomeCategories(): JSX.Element {
    const navigate = useNavigate();
    const {t, i18n} = useTranslation();
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState(0);
    const [selectedGlobalCategory, setSelectedGlobalCategory] = useState<GlobalCategory>("book");
    const [topBooks, setTopBooks] = useState<Book[]>([]);
    const [isTopLoading, setIsTopLoading] = useState(false);
    const [topError, setTopError] = useState<string | null>(null);
    const [topRefreshToken, setTopRefreshToken] = useState(0);

    useScrollRestoration("home-categories");

    const translatedSpecialCategories = useMemo<SpecialCategory[]>(
        () =>
            SPECIAL_CATEGORIES.map((category) => ({
                ...category,
                title: t(category.titleKey),
            })),
        [t],
    );
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const items = await catalogApi.listCategories({
                    globalCategory: selectedGlobalCategory,
                });
                if (!cancelled) {
                    setCategories(items);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error(err);
                    setError(t("errors.loadCategories"));
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
    }, [refreshToken, selectedGlobalCategory, t]);

    useEffect(() => {
        let cancelled = false;

        const loadTopBooks = async () => {
            try {
                setIsTopLoading(true);
                setTopError(null);

                const response = await catalogApi.listBooks({
                    sort: "popular",
                    limit: 10,
                    language: i18n.language,
                });

                if (!cancelled) {
                    setTopBooks(response.items);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error(err);
                    setTopError(t("errors.loadBooks"));
                }
            } finally {
                if (!cancelled) {
                    setIsTopLoading(false);
                }
            }
        };

        if (selectedGlobalCategory === "book") {
            void loadTopBooks();
        } else {
            setTopBooks([]);
            setTopError(null);
        }

        return () => {
            cancelled = true;
        };
    }, [i18n.language, selectedGlobalCategory, t, topRefreshToken]);

    const specialCategories: SpecialCategory[] = translatedSpecialCategories;

    const displayedCategories: Category[] = [...specialCategories, ...categories];

    const handleCategoryClick = (category: Category) => {
        if (isSpecialCategoryId(category.id)) {
            navigate(SPECIAL_CATEGORY_MAP[category.id].path);
            return;
        }

        navigate(`/category/${category.id}`);
    };

    const handleTopRetry = () => setTopRefreshToken((prev) => prev + 1);

    const handleViewAllTopBooks = () => navigate(SPECIAL_CATEGORY_MAP["most-read"].path);

    return (
        <main style={{padding: "16px 16px 32px", margin: "0 auto", maxWidth: 720}}>
            {/*<Banner*/}
            {/*    header={t("homeCategories.alphaBanner.title")}*/}
            {/*    subheader={t("homeCategories.alphaBanner.description")}*/}
            {/*    style={{marginBottom: 16}}*/}
            {/*/>*/}

            <Card style={{marginBottom: 16, width: '100%'}}>
                <Tappable
                    onClick={() => navigate("/search")}
                    style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600 }}
                    aria-label={t("buttons.search")}
                >
                    {t("buttons.search")}
                </Tappable>
            </Card>
            {selectedGlobalCategory === 'book' && (
                <section style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    margin: "8px 0 20px"
                }}>
                    <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12}}>
                        <Title level="2" weight="2">
                            {t("homeCategories.popularBooksTitle")}
                        </Title>
                    </div>
                    {topError && <ErrorBanner message={topError} onRetry={handleTopRetry}/>}                    
                    <div style={{overflowX: "auto", paddingBottom: 8}}>
                        <div
                            style={{
                                display: "grid",
                                gridAutoFlow: "column", // новые элементы добавляются в новые колонки
                                gridTemplateRows: "repeat(2, minmax(0, 1fr))", // 3 строки (3 элемента в столбце)
                                gridAutoColumns: "calc(50% - 8px)", // ширина одной колонки ~ половина контейнера
                                overflowX: "auto", // горизонтальный скролл
                                columnGap: 16,
                                rowGap: 16,
                                paddingRight: 4,
                                paddingBottom: 4,
                            }}
                        >
                            {topBooks.map((book, index) => (
                                <div key={book.id + index} style={{minWidth: 0, width: "100%"}}>
                                    <BookCard
                                        onlyImage
                                        book={book}
                                        onClick={() => navigate(`/book/${book.id}`)}
                                    />
                                </div>
                            ))}

                            {isTopLoading && topBooks.length === 0 && Array.from({length: 4}).map((_, index) => (
                                <div key={index} style={{minWidth: 0, width: "100%"}}>
                                    <BookCardSkeleton />
                                </div>
                            ))}
                            {isTopLoading && topBooks.length > 0 && (
                                <div style={{minWidth: 0, width: "100%"}}>
                                    <BookCardSkeleton />
                                </div>
                            )}
                        </div>
                    </div>
                    {!isTopLoading && topBooks.length === 0 && !topError && (
                        <EmptyState
                            title={t("homeCategories.popularBooksEmptyTitle")}
                            description={t("homeCategories.popularBooksEmptyDescription")}
                        />
                    )}
                    {topBooks.length > 0 && (
                        <div style={{display: "flex", justifyContent: "flex-end"}}>
                            <button
                                type="button"
                                onClick={handleViewAllTopBooks}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "var(--tg-theme-link-color, #3390ff)",
                                    cursor: "pointer",
                                    fontSize: 16,
                                    fontWeight: 600,
                                    padding: 8,
                                }}
                            >
                                {t("homeCategories.popularBooksShowAll")}
                            </button>
                        </div>
                    )}
                </section>
            )}
            <Title level="1" weight="2">
                {t("homeCategories.title")}
            </Title>
            <div style={{display: "flex", flexDirection: "column", gap: 8, marginBottom: 16}}>
                <SegmentedControl
                >
                    {GLOBAL_CATEGORIES.map((category) => (
                        <SegmentedControl.Item key={category}
                                               onClick={() => setSelectedGlobalCategory(category)}
                                               value={category} selected={selectedGlobalCategory === category}>
                            {t(`globalCategories.${category}`, {
                                defaultValue: `${category.charAt(0).toUpperCase()}${category.slice(1)}`,
                            })}
                        </SegmentedControl.Item>
                    ))}
                </SegmentedControl>
            </div>
            {error && <ErrorBanner style={{margin: "16px 0"}} message={error}
                                   onRetry={() => setRefreshToken((prev) => prev + 1)}/>}
            {selectedGlobalCategory === 'article' || selectedGlobalCategory === 'comics'
                ? <div style={{
                    width: "100%",
                    display: 'flex',
                    justifyContent: "center"
                }}>{t("homeCategories.comingSoon")}</div>
                : isLoading && displayedCategories.length === 0
                    ? (
                        <div style={{
                            display: "grid",
                            gap: 16,
                            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))"
                        }}>
                            {Array.from({length: 6}).map((_, index) => (
                                <CategoryTileSkeleton key={index}/>
                            ))}
                        </div>
                    )
                    : displayedCategories.length > 0 ? (
                        <div style={{
                            display: "grid",
                            gap: 16,
                            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))"
                        }}>
                            {displayedCategories.map((category) => (
                                <CategoryTile
                                    key={category.id}
                                    category={category}
                                    onClick={() => handleCategoryClick(category)}
                                />
                            ))}
                        </div>
                    ) : (
                        !isLoading && (
                            <EmptyState
                                title={t("homeCategories.emptyTitle")}
                                description={t("homeCategories.emptyDescription")}
                            />
                        )
                    )}

        </main>
    );
}
