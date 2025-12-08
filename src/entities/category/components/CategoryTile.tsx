import type {Category} from "@/entities/category/types";

import {Card, Tappable, Text, Title} from "@telegram-apps/telegram-ui";
import {useTranslation} from "react-i18next";

import {getCategoryLabelKey} from "@/shared/lib/categoryTranslations";

interface CategoryTileProps {
    category: Category;
    onClick: () => void;
}

export function CategoryTile({category, onClick}: CategoryTileProps): JSX.Element {
    const {t} = useTranslation();
    const labelKey = getCategoryLabelKey(category.title);
    const localizedTitle = labelKey ? t(labelKey) : category.title;

    return (
        <Tappable
            onClick={onClick}
            style={{display: "block", textDecoration: "none"}}
            interactiveAnimation="background"
            aria-label={t("categories.aria", {title: localizedTitle})}
        >
            <Card style={{width: '80%', padding: 16, borderRadius: 20, minHeight: 140}}>
                <div style={{fontSize: 32, marginBottom: 12}}>{category.emoji ?? "📚"}</div>
                <Title weight="2" level="3" style={{marginBottom: 8}}>
                    {localizedTitle}
                </Title>
                <Text weight="2" style={{color: "var(--tg-theme-subtitle-text-color, #7f7f81)"}}>
                    {category.booksCount ? t("categories.booksCount", {count: category.booksCount}) : t('categories.specialCategory')}
                </Text>
            </Card>
        </Tappable>
    );
}
