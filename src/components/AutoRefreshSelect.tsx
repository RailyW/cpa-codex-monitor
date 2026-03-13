"use client";

import { Select } from "@radix-ui/themes";

const OPTIONS = [
  { value: "0", label: "关闭" },
  { value: "30", label: "30 秒" },
  { value: "60", label: "60 秒" },
  { value: "120", label: "120 秒" },
];

interface AutoRefreshSelectProps {
  value: number;
  onChange: (seconds: number) => void;
}

export function AutoRefreshSelect({ value, onChange }: AutoRefreshSelectProps) {
  const str = value === 0 ? "0" : String(value);
  return (
    <Select.Root value={str} onValueChange={(v) => onChange(Number(v))}>
      <Select.Trigger placeholder="自动刷新" />
      <Select.Content>
        {OPTIONS.map((opt) => (
          <Select.Item key={opt.value} value={opt.value}>
            {opt.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}
