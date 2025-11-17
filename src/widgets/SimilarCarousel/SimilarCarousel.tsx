import type { TFunction } from "i18next";
import type { Book } from "@/entities/book/types";

import { Card, Tappable, Text, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { handleBookCoverError, resolveBookCover } from "@/entities/book/lib";
import { useWalrusCover } from "@/entities/book/hooks/useWalrusCover";

interface SimilarCarouselProps {
  books: Book[];
  onSelect: (bookId: string) => void;
}

export function SimilarCarousel({ books, onSelect }: SimilarCarouselProps): JSX.Element {
  const { t } = useTranslation();

  if (books.length === 0) {
    return (
      <Text style={{ color: "var(--tg-theme-subtitle-text-color, #7f7f81)", padding: "0 16px" }}>
        {t("similar.empty")}
      </Text>
    );
  }

  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
        {books.map((book) => (
          <SimilarCarouselItem key={book.id} book={book} onSelect={onSelect} t={t} />
        ))}
      </div>
    </div>
  );
}

type SimilarCarouselItemProps = {
  book: Book;
  onSelect: (bookId: string) => void;
  t: TFunction<"translation">;
};

function SimilarCarouselItem({ book, onSelect, t }: SimilarCarouselItemProps): JSX.Element {
  const walrusCover = useWalrusCover({
    bookId: book.coverImageData ? null : book.id,
    mimeType: book.coverMimeType,
    enabled: !book.coverImageData,
  });
  const coverSrc = walrusCover ?? resolveBookCover(book);

  return (
    <Tappable
      onClick={() => onSelect(book.id)}
      style={{ width: 160, flexShrink: 0 }}
      interactiveAnimation="background"
      aria-label={t("similar.aria", { title: book.title })}
    >
      <Card style={{ borderRadius: 18, overflow: "hidden" }}>
        <div style={{ aspectRatio: "16 / 9", background: "var(--tg-theme-secondary-bg-color, #f3f3f5)" }}>
          <img
            src={coverSrc}
            alt={t("images.bookCover", { title: book.title })}
            loading="lazy"
            onError={handleBookCoverError}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <div style={{ padding: 12 }}>
          <Title level="3" weight="2" style={{ fontSize: 16 }}>
            {book.title}
          </Title>
          <Text style={{ color: "var(--tg-theme-subtitle-text-color, #7f7f81)" }}>{book.authors.join(", ")}</Text>
        </div>
      </Card>
    </Tappable>
  );
}
