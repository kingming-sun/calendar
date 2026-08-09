import { Button, Card, Empty, Progress, Space, Timeline, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { MetricCard } from "@/components/common/MetricCard";
import { formatCurrency } from "@/services/cost/CostCalculator";
import { useAppStore } from "@/stores/appStore";
import { getStatusLabel } from "@/utils/statusLabel";
import {
  estimateDailyImages,
  estimateRequiredConcurrency
} from "@/utils/throughput";

export function Dashboard() {
  const navigate = useNavigate();
  const activeBatch = useAppStore((state) => state.activeBatch);
  const jobs = useAppStore((state) => state.jobs);
  const sets = useAppStore((state) => state.sets);

  if (!activeBatch) {
    return (
      <Card className="glass-card">
        <Empty
          description="还没有批次，先创建一个模拟服务任务验证流程。"
        >
          <Button type="primary" onClick={() => navigate("/generator")}>
            创建第一个批次
          </Button>
        </Empty>
      </Card>
    );
  }

  const remaining =
    activeBatch.totalImages -
    activeBatch.completedImages -
    activeBatch.failedImages;
  const percent =
    activeBatch.totalImages === 0
      ? 0
      : (activeBatch.completedImages / activeBatch.totalImages) * 100;
  const conservativeSecondsPerImage = 30;
  const estimatedDailyImages = estimateDailyImages(
    activeBatch.concurrency,
    conservativeSecondsPerImage
  );
  const requiredConcurrencyFor10k = estimateRequiredConcurrency(
    10_000,
    conservativeSecondsPerImage
  );

  return (
    <div className="page-grid">
      <div className="span-3">
        <MetricCard label="分组数" value={activeBatch.setCount} hint="任务分组总数" />
      </div>
      <div className="span-3">
        <MetricCard
          label="图片数"
          value={activeBatch.totalImages}
          hint={`${activeBatch.imagesPerSet} 张 / 组`}
        />
      </div>
      <div className="span-3">
        <MetricCard
          label="已完成"
          value={activeBatch.completedImages}
          hint={`${percent.toFixed(2)}%`}
        />
      </div>
      <div className="span-3">
        <MetricCard label="失败数" value={activeBatch.failedImages} hint="可重试" />
      </div>

      <Card className="glass-card span-8">
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Space direction="vertical" size={2}>
            <Typography.Text className="eyebrow">当前批次</Typography.Text>
            <Typography.Title level={2}>{activeBatch.name}</Typography.Title>
            <Typography.Text type="secondary">
              <span className="status-dot" />
              {getStatusLabel(activeBatch.status)} · 服务商 {activeBatch.providerId} · 模型{" "}
              {activeBatch.model}
            </Typography.Text>
          </Space>
          <Progress percent={Number(percent.toFixed(2))} strokeColor="#32d5ff" />
          <Space size="large">
            <Typography.Text>处理中：{activeBatch.processingImages}</Typography.Text>
            <Typography.Text>剩余：{remaining}</Typography.Text>
            <Typography.Text>
              预计成本：{formatCurrency(activeBatch.estimatedCost ?? 0)}
            </Typography.Text>
            <Typography.Text>
              实际成本：{formatCurrency(activeBatch.actualCost ?? 0)}
            </Typography.Text>
          </Space>
        </Space>
      </Card>

      <Card className="glass-card span-4" title="运行时间线">
        <Timeline
          items={[
            {
              color: "blue",
              children: `批次创建：${new Date(activeBatch.createdAt).toLocaleString()}`
            },
            {
              color: "green",
              children: `已完成 ${activeBatch.completedImages} 张图片`
            },
            {
              color: activeBatch.failedImages ? "red" : "gray",
              children: `失败 ${activeBatch.failedImages} 张，可进入详情重试`
            }
          ]}
        />
      </Card>

      <Card className="glass-card span-12" title="产能估算">
        <Space size="large" wrap>
          <Typography.Text>
            当前并发：{activeBatch.concurrency}
          </Typography.Text>
          <Typography.Text>
            按 fal.ai 每张约 {conservativeSecondsPerImage} 秒估算：约{" "}
            {estimatedDailyImages.toLocaleString()} 张/天
          </Typography.Text>
          <Typography.Text>
            目标 10,000 张/天：至少需要并发 {requiredConcurrencyFor10k}
          </Typography.Text>
        </Space>
        <Typography.Paragraph className="muted" style={{ marginTop: 12 }}>
          实际速度取决于 fal.ai 模型耗时、账号限流、浏览器连接数、图片下载速度和本地磁盘写入。
          如果页面显示未及时变化，系统会每 1.5 秒自动刷新运行中批次。
        </Typography.Paragraph>
      </Card>

      <Card className="glass-card span-12" title="Set 快照">
        <div className="job-grid">
          {sets.slice(0, 26).map((set) => (
            <div key={set.id} className={`job-cell ${set.status}`}>
              {set.index}
            </div>
          ))}
        </div>
        <Typography.Paragraph className="muted" style={{ marginTop: 18 }}>
          当前已加载 {sets.length} 个 Set，{jobs.length} 个 Job。大列表页面应采用虚拟化展示。
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
