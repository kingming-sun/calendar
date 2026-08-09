import { Card, Typography } from "antd";
import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
}

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <Card className="glass-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint ? <Typography.Text type="secondary">{hint}</Typography.Text> : null}
    </Card>
  );
}
