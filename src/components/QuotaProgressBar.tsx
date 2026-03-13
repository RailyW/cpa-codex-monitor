"use client";

import { Flex, Progress, Text } from "@radix-ui/themes";
import type { QuotaWindow } from "@/lib/types";

function progressColor(percent: number | null): "green" | "yellow" | "red" | "gray" {
  if (percent === null) return "gray";
  if (percent >= 60) return "green";
  if (percent >= 20) return "yellow";
  return "red";
}

interface QuotaProgressBarProps {
  window: QuotaWindow;
}

export function QuotaProgressBar({ window }: QuotaProgressBarProps) {
  const percent = window.remainingPercent;
  const value = percent !== null ? Math.round(percent) : undefined;
  const color = progressColor(percent);
  const percentLabel = percent !== null ? `${Math.round(percent)}%` : "--";

  return (
    <Flex direction="column" gap="1">
      <Flex justify="between" align="center">
        <Text size="2" weight="medium">
          {window.label}
        </Text>
        <Text size="2" color={color}>
          {percentLabel}
        </Text>
      </Flex>
      <Progress value={value ?? 0} color={color} size="1" />
      <Text size="1" color="gray">
        重置: {window.resetLabel}
      </Text>
    </Flex>
  );
}
