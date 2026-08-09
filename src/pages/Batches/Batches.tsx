import { Button, Card, Progress, Space, Table, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/services/cost/CostCalculator";
import { useAppStore } from "@/stores/appStore";
import type { Batch } from "@/types";
import { getStatusLabel } from "@/utils/statusLabel";

export function Batches() {
  const navigate = useNavigate();
  const batches = useAppStore((state) => state.batches);

  return (
    <Card className="glass-card" title="历史批次">
      <Table<Batch>
        rowKey="id"
        dataSource={batches}
        pagination={{ pageSize: 10 }}
        columns={[
          {
            title: "批次",
            dataIndex: "name",
            render: (value, record) => (
              <Space direction="vertical" size={0}>
                <Typography.Text strong>{value}</Typography.Text>
                <Typography.Text type="secondary">{record.id}</Typography.Text>
              </Space>
            )
          },
          {
            title: "状态",
            dataIndex: "status",
            render: (status) => <Tag color="cyan">{getStatusLabel(status)}</Tag>
          },
          {
            title: "进度",
            render: (_, record) => {
              const percent =
                record.totalImages === 0
                  ? 0
                  : (record.completedImages / record.totalImages) * 100;
              return <Progress percent={Number(percent.toFixed(2))} />;
            }
          },
          {
            title: "规模",
            render: (_, record) => `${record.setCount} 个分组 / ${record.totalImages} 张图片`
          },
          {
            title: "失败",
            dataIndex: "failedImages"
          },
          {
            title: "成本",
            render: (_, record) => formatCurrency(record.actualCost ?? 0)
          },
          {
            title: "操作",
            render: (_, record) => (
              <Button type="link" onClick={() => navigate(`/batches/${record.id}`)}>
                查看详情
              </Button>
            )
          }
        ]}
      />
    </Card>
  );
}
