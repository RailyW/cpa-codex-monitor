"use client";

import { Card, Flex, Grid, Text } from "@radix-ui/themes";
import type { CodexQuotaResponse } from "@/lib/types";

interface StatsSummaryProps {
  data: CodexQuotaResponse;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

export function StatsSummary({ data }: StatsSummaryProps) {
  const total = data.accounts.length;
  const success = data.accounts.filter((a) => a.status === "success").length;
  const error = data.accounts.filter((a) => a.status === "error").length;

  return (
    <Grid columns={{ initial: "2", sm: "4" }} gap="3">
      <Card size="1" variant="surface">
        <Flex direction="column" gap="1">
          <Text size="1" color="gray">
            总账号数
          </Text>
          <Text size="5" weight="bold">
            {total}
          </Text>
        </Flex>
      </Card>
      <Card size="1" variant="surface">
        <Flex direction="column" gap="1">
          <Text size="1" color="gray">
            健康账号
          </Text>
          <Text size="5" weight="bold" color="green">
            {success}
          </Text>
        </Flex>
      </Card>
      <Card size="1" variant="surface">
        <Flex direction="column" gap="1">
          <Text size="1" color="gray">
            异常账号
          </Text>
          <Text size="5" weight="bold" color={error > 0 ? "red" : "gray"}>
            {error}
          </Text>
        </Flex>
      </Card>
      <Card size="1" variant="surface">
        <Flex direction="column" gap="1">
          <Text size="1" color="gray">
            上次刷新时间
          </Text>
          <Text size="5" weight="bold">
            {formatTime(data.queriedAt)}
          </Text>
        </Flex>
      </Card>
    </Grid>
  );
}
