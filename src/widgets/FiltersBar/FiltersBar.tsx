import { useMemo } from "react";

import {Card, Chip, SegmentedControl, Tappable} from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import type { BookSort } from "@/shared/lib/bookSort";

const SORT_OPTION_KEYS: Array<{ labelKey: string; value: BookSort }> = [
  { labelKey: "filters.sort.popular", value: "popular" },
  { labelKey: "filters.sort.rating", value: "rating" },
  { labelKey: "filters.sort.new", value: "new" },
];

interface FiltersBarProps {
  sort: BookSort;
  onSortChange: (sort: BookSort) => void;
  tags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  searchButtonLabel?: string;
  onSearchClick?: () => void;
}

export function FiltersBar({
  sort,
  onSortChange,
  tags,
  selectedTags,
  onToggleTag,
  searchButtonLabel,
  onSearchClick,
}: FiltersBarProps): JSX.Element {
  const { t } = useTranslation();
  const sortOptions = useMemo(
    () => SORT_OPTION_KEYS.map((option) => ({ ...option, label: t(option.labelKey) })),
    [t],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {onSearchClick && (
        <Card>
          <Tappable
            onClick={onSearchClick}
            style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600 }}
            aria-label={searchButtonLabel ?? t("buttons.search")}
          >
            {searchButtonLabel ?? t("buttons.search")}
          </Tappable>
        </Card>
      )}
      <SegmentedControl>
        {sortOptions.map((option) => (
          <SegmentedControl.Item
            key={option.value}
            selected={option.value === sort}
            onClick={() => onSortChange(option.value)}
          >
            {option.label}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tags.map((tag) => {
          const selected = selectedTags.includes(tag);
          return (
            <Chip
              key={tag}
              mode={selected ? "elevated" : "outline"}
              aria-pressed={selected}
              role="button"
              onClick={() => onToggleTag(tag)}
            >
              #{tag}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}
