"use client";

import { Flex, Progress, Text } from "@radix-ui/themes";
import type { QuotaWindow } from "@/lib/types";

function progressColor(percent: number | null): "green" | "yellow" | "red" | "gray" {
  if (percent === null) return "gray";
  if (percent >= 60) return "green";
  if (percent >= 20) return "yellow";
  return "red";
}

function formatExactTime(isoStr: string | null): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return "";
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${mo}/${day} ${hh}:${mm}`;
  } catch {
    return "";
  }
}

interface QuotaProgressBarProps {
  window: QuotaWindow;
}

export function QuotaProgressBar({ window }: QuotaProgressBarProps) {
  const percent = window.remainingPercent;
  const value = percent !== null ? Math.round(percent) : undefined;
  const color = progressColor(percent);
  const percentLabel = percent !== null ? `${Math.round(percent)}%` : "--";

  const exact = formatExactTime(window.resetAt);
  const resetDisplay = exact
    ? `${window.resetLabel} (${exact})`
    : window.resetLabel;

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
        重置: {resetDisplay}
      </Text>
    </Flex>
  );
}
