import {useMemo} from "react";

import type {Book} from "@/entities/book/types";

import {Card, Chip, Tappable, Text, Title} from "@telegram-apps/telegram-ui";
import {useTranslation} from "react-i18next";

import {handleBookCoverError} from "@/entities/book/lib";
import {buildBookFileDownloadUrl} from "@/shared/api/storage";
import {BookRating} from "./BookRating";

interface BookCardProps {
    book: Book;
    showTags?: boolean;
    onClick: () => void;
}

export function BookCard({book, showTags = true, onClick}: BookCardProps): JSX.Element {
    const {t} = useTranslation();

    const coverSrc = useMemo(() => {
        if (book.coverWalrusFileId || book.coverWalrusBlobId) {
            return buildBookFileDownloadUrl(book.id, "cover");
        }

        return book.coverUrl ?? '';
    }, [book.coverWalrusFileId, book.coverWalrusBlobId, book.coverUrl, book.id]);

    return (
        <Tappable
            onClick={onClick}
            interactiveAnimation="background"
            aria-label={t("book.cardAria", {title: book.title})}
            style={{textDecoration: "none", color: "inherit", display: "flex", justifyContent: "center"}}
        >
            <Card style={{width: '100%', borderRadius: 20, overflow: "hidden"}}>
                <div style={{position: "relative", aspectRatio: "3 / 3"}}>
                    <img
                        src={coverSrc}
                        alt={t("book.coverAlt", {title: book.title})}
                        loading="lazy"
                        onError={handleBookCoverError}
                        style={{width: "100%", height: "100%", objectFit: "contain"}}
                    />
                </div>
                <div style={{padding: 16, display: "flex", flexDirection: "column", gap: 8}}>
                    <Title weight="2" level="3">
                        {book.title}
                    </Title>
                    <Text
                        style={{color: "var(--tg-theme-subtitle-text-color, #7f7f81)"}}>{book.authors.join(", ")}</Text>
                    {book.rating.average > 0 && (
                        <BookRating value={book.rating.average} votes={book.rating.votes}/>
                    )}
                    {showTags && (
                        <div style={{display: "flex", flexWrap: "wrap", gap: 8}}>
                            {book.tags.slice(0, 3).map((tag) => (
                                <Chip key={tag} mode="outline">
                                    #{tag}
                                </Chip>
                            ))}
                            {book.tags.length > 3 && (
                                <Text weight="2">+{book.tags.length - 3}</Text>
                            )}
                        </div>
                    )}

                </div>
            </Card>
        </Tappable>
    );
}
