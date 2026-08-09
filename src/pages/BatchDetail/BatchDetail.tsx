import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Alert, Button, Card, Descriptions, Empty, Space, Table, Tag, Typography } from "antd";
import { useAppStore } from "@/stores/appStore";
import { JobStatus, type ImageJob, type ImageSet } from "@/types";
import { getStatusLabel } from "@/utils/statusLabel";
import {
  estimateDailyImages,
  estimateRequiredConcurrency
} from "@/utils/throughput";

function getJobClass(status: JobStatus): string {
  if (status === JobStatus.SUCCESS) {
    return "success";
  }
  if (status === JobStatus.FAILED) {
    return "failed";
  }
  if (
    status === JobStatus.PROCESSING ||
    status === JobStatus.DOWNLOADING ||
    status === JobStatus.SAVING
  ) {
    return "processing";
  }

  return "";
}

export function BatchDetail() {
  const { batchId } = useParams();
  const activeBatch = useAppStore((state) => state.activeBatch);
  const sets = useAppStore((state) => state.sets);
  const jobs = useAppStore((state) => state.jobs);
  const pauseBatch = useAppStore((state) => state.pauseBatch);
  const resumeBatch = useAppStore((state) => state.resumeBatch);
  const cancelBatch = useAppStore((state) => state.cancelBatch);
  const retryFailed = useAppStore((state) => state.retryFailed);
  const loadBatch = useAppStore((state) => state.loadBatch);

  useEffect(() => {
    if (!batchId) {
      return;
    }

    void loadBatch(batchId);
  }, [batchId, loadBatch]);

  const jobsBySet = useMemo(() => {
    const map = new Map<string, ImageJob[]>();
    jobs.forEach((job) => {
      const list = map.get(job.setId) ?? [];
      list.push(job);
      map.set(job.setId, list);
    });
    return map;
  }, [jobs]);

  if (!activeBatch) {
    return <Empty description="批次不存在或尚未加载" />;
  }

  const secondsPerImage = 30;
  const dailyImages = estimateDailyImages(activeBatch.concurrency, secondsPerImage);
  const requiredConcurrency = estimateRequiredConcurrency(10_000, secondsPerImage);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card className="glass-card">
        <div className="toolbar">
          <Space direction="vertical" size={0}>
            <Typography.Text className="eyebrow">批次详情</Typography.Text>
            <Typography.Title level={2}>{activeBatch.name}</Typography.Title>
          </Space>
          <Space>
            <Button onClick={pauseBatch}>暂停</Button>
            <Button onClick={resumeBatch}>继续</Button>
            <Button onClick={() => retryFailed(activeBatch.id)}>重试失败项</Button>
            <Button danger onClick={() => cancelBatch(activeBatch.id)}>
              取消
            </Button>
          </Space>
        </div>
        <Descriptions
          bordered
          column={4}
          items={[
            { key: "status", label: "状态", children: getStatusLabel(activeBatch.status) },
            { key: "provider", label: "服务商", children: activeBatch.providerId },
            { key: "model", label: "模型", children: activeBatch.model },
            { key: "sets", label: "分组数", children: activeBatch.setCount },
            { key: "images", label: "图片数", children: activeBatch.totalImages },
            { key: "failed", label: "失败数", children: activeBatch.failedImages }
          ]}
        />
        {activeBatch.providerId === "mock" ? (
          <Alert
            style={{ marginTop: 16 }}
            showIcon
            type="warning"
            message="当前批次使用的是模拟图片服务"
            description="这个批次不会调用 fal.ai，也不会产生 API Usage。要调用真实 API，请重新创建批次，并在生成器中选择“fal.ai FLUX”。"
          />
        ) : null}
        <Alert
          style={{ marginTop: 16 }}
          showIcon
          type="info"
          message="速度说明"
          description={`当前并发 ${activeBatch.concurrency}，所以会先同时跑 ${activeBatch.concurrency} 张，剩余任务等待空位。按 fal.ai 每张约 ${secondsPerImage} 秒估算，当前约 ${dailyImages.toLocaleString()} 张/天；目标 10,000 张/天至少需要并发 ${requiredConcurrency}。实际还会受账号限流和图片下载影响。`}
        />
      </Card>

      <Card className="glass-card" title="Set 列表">
        <Table<ImageSet>
          rowKey="id"
          dataSource={sets}
          pagination={{ pageSize: 12 }}
          expandable={{
            expandedRowRender: (set) => {
              const setJobs = (jobsBySet.get(set.id) ?? []).sort(
                (a, b) => a.imageIndex - b.imageIndex
              );
              return (
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                  <div className="job-grid">
                    {setJobs.map((job) => (
                      <div
                        key={job.id}
                        className={`job-cell ${getJobClass(job.status)}`}
                        title={job.error?.message}
                      >
                        {String(job.imageIndex).padStart(2, "0")}
                      </div>
                    ))}
                  </div>
                  {setJobs
                    .filter((job) => job.status === JobStatus.FAILED)
                    .map((job) => (
                      <Typography.Text key={job.id} type="danger">
                        {job.localFilename}: {job.error?.message}
                      </Typography.Text>
                    ))}
                </Space>
              );
            }
          }}
          columns={[
            {
              title: "Set",
              dataIndex: "name"
            },
            {
              title: "状态",
              dataIndex: "status",
              render: (status) => <Tag>{getStatusLabel(status)}</Tag>
            },
            {
              title: "完成",
              render: (_, record) =>
                `${record.completedImages}/${record.totalImages}`
            },
            {
              title: "失败",
              dataIndex: "failedImages"
            }
          ]}
        />
      </Card>
    </Space>
  );
}
