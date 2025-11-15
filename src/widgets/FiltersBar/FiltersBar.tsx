import type { ChangeEvent } from "react";
import { useMemo } from "react";

import { Chip, Input, SegmentedControl } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import type { BookSort } from "@/shared/lib/bookSort";

const SORT_OPTION_KEYS: Array<{ labelKey: string; value: BookSort }> = [
  { labelKey: "filters.sort.popular", value: "popular" },
  { labelKey: "filters.sort.rating", value: "rating" },
  { labelKey: "filters.sort.new", value: "new" },
];

interface FiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: BookSort;
  onSortChange: (sort: BookSort) => void;
  tags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

export function FiltersBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  tags,
  selectedTags,
  onToggleTag,
}: FiltersBarProps): JSX.Element {
  const { t } = useTranslation();
  const sortOptions = useMemo(
    () => SORT_OPTION_KEYS.map((option) => ({ ...option, label: t(option.labelKey) })),
    [t],
  );

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Input
          className="input-wrapper"
        type="search"
        value={search}
        onChange={handleSearch}
        placeholder={t("filters.searchPlaceholder")}
        aria-label={t("filters.searchPlaceholder")}
      />
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
