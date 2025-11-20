import type { ImpactHapticFeedbackStyle } from "@telegram-apps/bridge";
import { hapticFeedback } from '@telegram-apps/sdk';

import { Button as TelegramButton } from "@telegram-apps/telegram-ui";
import type { ComponentProps } from "react";
import { forwardRef, useCallback } from "react";

const DEFAULT_IMPACT_STYLE: ImpactHapticFeedbackStyle = "light";
const { impactOccurred, selectionChanged } = hapticFeedback;

const HAPTIC_EFFECTS = {
  impact: (style: ImpactHapticFeedbackStyle) => {
    impactOccurred.ifAvailable(style);
  },
  selection: () => {
    selectionChanged.ifAvailable();
  },
} as const;

type TelegramUIButtonProps = ComponentProps<typeof TelegramButton>;

export type ButtonProps = TelegramUIButtonProps & {
  hapticEffect?:
    | { type: "selection" }
    | { type: "impact"; style?: ImpactHapticFeedbackStyle };
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      hapticEffect,
      onClick,
      disabled,
      ...rest
    },
    ref,
  ) => {
    const hapticType = hapticEffect?.type ?? "impact";
    const impactStyle =
      hapticType === "impact"
        ? hapticEffect?.style ?? DEFAULT_IMPACT_STYLE
        : DEFAULT_IMPACT_STYLE;
    const isDisabled = Boolean(disabled);

    const handleClick = useCallback<NonNullable<TelegramUIButtonProps["onClick"]>>(
      (event) => {
        if (!isDisabled) {
          if (hapticType === "selection") {
            HAPTIC_EFFECTS.selection();
          } else {
            HAPTIC_EFFECTS.impact(impactStyle);
          }
        }

        onClick?.(event);
      },
      [impactStyle, isDisabled, hapticType, onClick],
    );

    return (
      <TelegramButton
        {...rest}
        disabled={disabled}
        onClick={handleClick}
        ref={ref}
      />
    );
  },
);

Button.displayName = "Button";
