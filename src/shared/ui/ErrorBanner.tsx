import {Button, Card, Text, Title} from "@telegram-apps/telegram-ui";
import {useTranslation} from "react-i18next";

interface ErrorBannerProps {
    message: string;
    onRetry?: () => void;
    actionLabel?: string;
    style?: Record<string, string>
}

export function ErrorBanner({message, style = {}, onRetry, actionLabel}: ErrorBannerProps): JSX.Element {
    const {t} = useTranslation();
    const retryLabel = actionLabel ?? t("buttons.retry");

    return (
        <Card style={{padding: 16, display: "flex", flexDirection: "column", gap: 12, ...style}}>
            <div>
                <Title level="3" weight="2">
                    {t("errors.genericTitle")}
                </Title>
                <Text style={{color: "var(--tg-theme-subtitle-text-color, #7f7f81)"}}>{message}</Text>
            </div>
            {onRetry ? (
                <Button mode="filled" size="s" onClick={onRetry}>
                    {retryLabel}
                </Button>
            ) : null}
        </Card>
    );
}
