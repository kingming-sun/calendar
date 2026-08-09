import { Card, Empty, Select, Space, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { JobStatus } from "@/types";
import { getStatusLabel } from "@/utils/statusLabel";

export function Gallery() {
  const jobs = useAppStore((state) => state.jobs);
  const [status, setStatus] = useState<JobStatus | "all">("all");

  const visibleJobs = useMemo(
    () => jobs.filter((job) => status === "all" || job.status === status).slice(0, 80),
    [jobs, status]
  );

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card className="glass-card">
        <div className="toolbar">
          <Space direction="vertical" size={0}>
            <Typography.Text className="eyebrow">图库</Typography.Text>
            <Typography.Title level={2}>生成图片浏览</Typography.Title>
            <Typography.Text type="secondary">
              MVP 阶段以本地文件为准，这里展示 Job 状态与文件位置。
            </Typography.Text>
          </Space>
          <Select
            value={status}
            style={{ width: 180 }}
            onChange={setStatus}
            options={[
              { label: "全部", value: "all" },
              { label: "成功", value: JobStatus.SUCCESS },
              { label: "失败", value: JobStatus.FAILED },
              { label: "等待中", value: JobStatus.PENDING }
            ]}
          />
        </div>
      </Card>

      {visibleJobs.length === 0 ? (
        <Card className="glass-card">
          <Empty description="暂无可展示图片状态" />
        </Card>
      ) : (
        <div className="gallery-grid">
          {visibleJobs.map((job) => (
            <div key={job.id} className="gallery-tile">
              <Space direction="vertical">
                <Tag color={job.status === JobStatus.SUCCESS ? "green" : "default"}>
                  {getStatusLabel(job.status)}
                </Tag>
                <Typography.Title level={4}>{job.localFilename}</Typography.Title>
                <Typography.Text type="secondary">
                  分组 {job.setIndex} · 图片 {job.imageIndex}
                </Typography.Text>
                <Typography.Paragraph className="muted" ellipsis={{ rows: 3 }}>
                  {job.prompt}
                </Typography.Paragraph>
              </Space>
            </div>
          ))}
        </div>
      )}
    </Space>
  );
}
