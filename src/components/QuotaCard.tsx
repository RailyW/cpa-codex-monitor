"use client";

import { Badge, Card, Callout, Flex, Heading, Separator, Skeleton, Text } from "@radix-ui/themes";
import { FileTextIcon } from "@radix-ui/react-icons";
import type { CodexAccountQuota } from "@/lib/types";
import { PLAN_TYPE_LABELS } from "@/lib/types";
import { QuotaProgressBar } from "./QuotaProgressBar";

interface QuotaCardProps {
  account: CodexAccountQuota;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

function planBadgeColor(planType: string | null): "orange" | "blue" | "gray" {
  if (!planType) return "gray";
  if (planType === "plus") return "orange";
  if (planType === "team") return "blue";
  return "gray";
}

export function QuotaCard({ account }: QuotaCardProps) {
  if (account.status === "loading") {
    return (
      <Card size="2" variant="surface">
        <Flex direction="column" gap="3">
          <Skeleton height="24px" width="80%" />
          <Skeleton height="16px" />
          <Separator size="4" />
          <Skeleton height="60px" />
        </Flex>
      </Card>
    );
  }

  if (account.status === "error") {
    return (
      <Card size="2" variant="surface">
        <Flex direction="column" gap="2">
          <Heading size="3">{account.name}</Heading>
          <Callout.Root color="red" size="1">
            <Callout.Text>{account.error ?? "未知错误"}</Callout.Text>
          </Callout.Root>
        </Flex>
      </Card>
    );
  }

  const mainWindows = [account.fiveHourWindow, account.weeklyWindow].filter(Boolean) as import("@/lib/types").QuotaWindow[];
  const codeReviewWindows = [account.codeReviewFiveHourWindow, account.codeReviewWeeklyWindow].filter(Boolean) as import("@/lib/types").QuotaWindow[];
  const planLabel = account.planType ? PLAN_TYPE_LABELS[account.planType] ?? account.planType : null;

  return (
    <Card size="2" variant="surface">
      <Flex direction="column" gap="2">
        <Flex align="center" gap="2">
          <FileTextIcon width={18} height={18} />
          <Heading size="3">{account.name}</Heading>
        </Flex>
        <Flex align="center" gap="2" wrap="wrap">
          {account.email && (
            <Text size="2" color="gray">
              {account.email}
            </Text>
          )}
          {planLabel && <Badge color={planBadgeColor(account.planType)}>{planLabel}</Badge>}
        </Flex>
        <Separator size="4" />
        <Flex direction="column" gap="3">
          {mainWindows.map((w) => (
            <QuotaProgressBar key={w.id} window={w} />
          ))}
          {codeReviewWindows.map((w) => (
            <QuotaProgressBar key={w.id} window={w} />
          ))}
          {mainWindows.length === 0 && codeReviewWindows.length === 0 && (
            <Text size="2" color="gray">
              无额度数据
            </Text>
          )}
        </Flex>
        <Separator size="4" />
        <Text size="1" color="gray">
          查询于 {formatTime(account.queriedAt)}
        </Text>
      </Flex>
    </Card>
  );
}
