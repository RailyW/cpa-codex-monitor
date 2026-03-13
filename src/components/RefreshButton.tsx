"use client";

import { useState } from "react";
import { Button, Flex, Spinner, Text } from "@radix-ui/themes";
import { UpdateIcon } from "@radix-ui/react-icons";

export function RefreshButton({ onRefresh }: { onRefresh?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/codex-refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "刷新失败");
        return;
      }
      const success = data.results?.filter((r: { success: boolean }) => r.success).length ?? 0;
      const total = data.results?.length ?? 0;
      setMessage(`刷新完成: ${success}/${total} 成功`);
      onRefresh?.();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex align="center" gap="2">
      <Button variant="soft" size="2" onClick={handleClick} disabled={loading}>
        {loading ? <Spinner size="1" /> : <UpdateIcon width={16} height={16} />}
        {loading ? "刷新中…" : "刷新账号"}
      </Button>
      {message && (
        <Text size="2" color="gray">
          {message}
        </Text>
      )}
    </Flex>
  );
}
