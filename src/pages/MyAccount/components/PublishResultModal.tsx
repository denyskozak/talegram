import { Button, Modal, Text } from "@telegram-apps/telegram-ui";
import type { TFunction } from "i18next";

import type { ThemeColors } from "@/app/providers/ThemeProvider";

import type { PublishResultState } from "../types";

export type PublishResultModalProps = {
  result: PublishResultState | null;
  onClose: () => void;
  t: TFunction<"translation">;
  theme: ThemeColors;
};

export function PublishResultModal({
  result,
  onClose,
  t,
  theme,
}: PublishResultModalProps): JSX.Element {
  return (
    <Modal open={result !== null} onOpenChange={(open) => !open && onClose()}>
      {result && (
        <>
          <Modal.Header>
            {result.status === "success"
              ? t("account.publish.modal.successTitle")
              : t("account.publish.modal.errorTitle")}
          </Modal.Header>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <Text style={{ color: theme.text }}>
              {result.status === "success"
                ? t("account.publish.modal.successDescription", { title: result.title })
                : t("account.publish.modal.errorDescription")}
            </Text>
            <Button mode="filled" size="m" onClick={onClose}>
              {t("account.publish.modal.close")}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
