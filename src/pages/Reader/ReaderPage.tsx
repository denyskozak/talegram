import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Spinner } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { ReadingOverlay } from "@/entities/book/components/ReadingOverlay";
import { fetchBookFile } from "@/shared/api/storage";
import { useTMA } from "@/app/providers/TMAProvider";
import { getTelegramUserId } from "@/shared/lib/telegram";

type ReaderRouteParams = {
  bookId?: string;
};

type ReaderErrorCode = "missing-book-id" | "load-failed" | null;

const DEFAULT_MIME_TYPE = "application/pdf";

export default function ReaderPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { bookId } = useParams<ReaderRouteParams>();
  const { launchParams } = useTMA();
  const telegramUserId = useMemo(
    () => getTelegramUserId(launchParams?.tgWebAppData?.user?.id),
    [launchParams],
  );
  const objectUrlRef = useRef<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<ReaderErrorCode>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setFileUrl(null);

    if (!bookId || bookId.trim().length === 0) {
      setIsLoading(false);
      setErrorCode("missing-book-id");
      return;
    }

    let isActive = true;
    const controller = new AbortController();

    setIsLoading(true);
    setErrorCode(null);

    const loadFile = async () => {
      try {
        const file = await fetchBookFile(bookId, "book", {
          telegramUserId,
          signal: controller.signal,
        });

        if (!isActive) {
          return;
        }

        const mimeType = file.mimeType ?? DEFAULT_MIME_TYPE;
        const objectUrl = URL.createObjectURL(new Blob([file.data], { type: mimeType }));
        objectUrlRef.current = objectUrl;
        setFileUrl(objectUrl);
      } catch (error) {
        if (!isActive) {
          return;
        }

        const maybeDomError = error as { name?: string } | null | undefined;
        if (maybeDomError?.name === "AbortError") {
          return;
        }

        console.error("Failed to load reader file", error);
        setErrorCode("load-failed");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadFile();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [bookId, telegramUserId, reloadToken]);

  const handleRetry = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  const handleGoHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const errorMessage = useMemo(() => {
    if (!errorCode) {
      return null;
    }

    return t("book.reader.loadError");
  }, [errorCode, t]);

  if (errorMessage) {
    return (
      <div
        role="alert"
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480, width: "100%" }}>
          <p style={{ margin: 0, textAlign: "center", fontSize: 16 }}>{errorMessage}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {errorCode === "load-failed" && (
              <Button size="l" onClick={handleRetry}>
                {t("buttons.retry")}
              </Button>
            )}
            <Button size="l" mode={errorCode === "load-failed" ? "outline" : "filled"} onClick={handleGoHome}>
              {t("buttons.goHome")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !fileUrl) {
    return (
      <div
        aria-live="polite"
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner size="l" />
      </div>
    );
  }

  return <ReadingOverlay fileUrl={fileUrl} />;
}
