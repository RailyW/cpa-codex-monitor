"use client";

import { useCallback, useEffect, useState } from "react";
import { Callout, Container, Flex, Grid, Heading, Section, Spinner, Text } from "@radix-ui/themes";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import type { CodexQuotaResponse } from "@/lib/types";
import { QuotaCard } from "./QuotaCard";
import { StatsSummary } from "./StatsSummary";

export function QuotaDashboard() {
  const [data, setData] = useState<CodexQuotaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchQuota = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/codex-quota", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        setData(null);
        return;
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  useEffect(() => {
    const id = setInterval(fetchQuota, 60 * 1000);
    return () => clearInterval(id);
  }, [fetchQuota]);

  return (
    <Container size="4" py="6">
      <Section size="1">
        <Flex justify="between" align="center" wrap="wrap" gap="4" mb="4">
          <Heading size="6">CPA Codex Monitor</Heading>
        </Flex>
      </Section>

      {error && (
        <Section size="1" mb="4">
          <Callout.Root color="red">
            <Callout.Icon>
              <ExclamationTriangleIcon />
            </Callout.Icon>
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        </Section>
      )}

      {loading && !data && (
        <Flex justify="center" py="9">
          <Spinner size="3" />
        </Flex>
      )}

      {data && !loading && (
        <>
          <Section size="1" mb="4">
            <StatsSummary data={data} />
          </Section>
          <Section size="1">
            {data.accounts.length === 0 ? (
              <Flex direction="column" align="center" gap="4" py="9">
                <Text size="5" color="gray">
                  暂无 Codex 账号
                </Text>
                <Text size="2" color="gray">
                  请先在 CPA 服务器上登录 Codex 账号
                </Text>
              </Flex>
            ) : (
              <Grid columns={{ initial: "1", sm: "2", lg: "3" }} gap="4">
                {data.accounts.map((account) => (
                  <QuotaCard key={account.name} account={account} />
                ))}
              </Grid>
            )}
          </Section>
        </>
      )}

      <Section size="1" pt="6">
        <Text size="1" color="gray">
          CPA Codex Monitor · Powered by CLIProxyAPI
        </Text>
      </Section>
    </Container>
  );
}
