import { useMemo } from "react";
import {
  App,
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Typography
} from "antd";
import { FolderOpen, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCurrency, estimateImageCost } from "@/services/cost/CostCalculator";
import {
  fileSystemService,
  isFileSystemAccessSupported
} from "@/services/filesystem/FileSystemService";
import { useAppStore } from "@/stores/appStore";
import type { BatchCreateInput, SeedMode } from "@/types";
import { findUnknownPromptTokens } from "@/utils/prompt";

const defaultPrompt =
  "一幅精致的{{subject}}，{{style}}，{{environment}}，艺术挂历插画，高细节，竖版构图，无文字，无水印。第 {{set_index}} 组，第 {{image_index}} 张。";

export function Generator() {
  const [form] = Form.useForm<BatchCreateInput>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const providers = useAppStore((state) => state.providers);
  const directoryName = useAppStore((state) => state.directoryName);
  const selectDirectory = useAppStore((state) => state.selectDirectory);
  const createBatch = useAppStore((state) => state.createBatch);
  const startBatch = useAppStore((state) => state.startBatch);

  const watchedValues = Form.useWatch([], form);
  const selectedProvider = useMemo(
    () =>
      providers.find(
        (provider) => provider.id === (watchedValues?.providerId ?? "mock")
      ),
    [providers, watchedValues?.providerId]
  );

  const totalImages =
    (watchedValues?.setCount ?? 10) * (watchedValues?.imagesPerSet ?? 13);
  const estimatedCost = estimateImageCost(
    totalImages,
    watchedValues?.width ?? 1024,
    watchedValues?.height ?? 1024,
    selectedProvider?.pricing ?? {}
  );

  const handleSelectDirectory = async () => {
    try {
      const handle = await fileSystemService.selectDirectory();
      await selectDirectory(handle);
      message.success(`已选择输出目录：${handle.name}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "选择目录失败");
    }
  };

  const submit = async () => {
    const values = await form.validateFields();
    const unknownTokens = findUnknownPromptTokens(values.promptTemplate);

    if (unknownTokens.length > 0) {
      message.error(`Prompt 存在未知变量：${unknownTokens.join(", ")}`);
      return;
    }

    const run = async () => {
      const batch = await createBatch(values);
      await startBatch(batch.id);
      navigate(`/batches/${batch.id}`);
    };

    if (totalImages >= 1000 || estimatedCost >= 10) {
      Modal.confirm({
        title: "确认启动大批量任务",
        content: `将生成 ${totalImages} 张图片，预计成本 ${formatCurrency(
          estimatedCost
        )}，并发 ${values.concurrency}。`,
        okText: "确认启动",
        cancelText: "取消",
        onOk: run
      });
      return;
    }

    await run();
  };

  return (
    <div className="page-grid">
      <Card className="glass-card span-8" title="生成参数">
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            name: `挂历批次 ${new Date().toLocaleDateString()}`,
            providerId: "mock",
            model: "mock-canvas-v1",
            setCount: 10,
            imagesPerSet: 13,
            width: 1024,
            height: 1024,
            concurrency: 10,
            maxRetries: 3,
            promptTemplate: defaultPrompt,
            negativePrompt: "文字，水印，低质量，模糊",
            seedMode: "increment" satisfies SeedMode,
            baseSeed: 10000
          }}
        >
          <Form.Item name="name" label="批次名称" rules={[{ required: true }]}>
            <Input placeholder="挂历批次" />
          </Form.Item>
          <Space size="large" style={{ width: "100%" }}>
            <Form.Item
              name="providerId"
              label="服务商"
              rules={[{ required: true }]}
              style={{ width: 240 }}
            >
              <Select
                options={providers.map((provider) => ({
                  label: `${provider.name}${provider.browserCompatible ? "" : " · 待验证"}`,
                  value: provider.id
                }))}
              />
            </Form.Item>
            <Form.Item
              name="model"
              label="模型"
              rules={[{ required: true }]}
              style={{ width: 260 }}
            >
              <Input />
            </Form.Item>
          </Space>
          <Space size="large" style={{ width: "100%" }}>
            <Form.Item name="setCount" label="分组数量" rules={[{ required: true }]}>
              <InputNumber min={1} max={1000} />
            </Form.Item>
            <Form.Item name="imagesPerSet" label="每组图片数">
              <InputNumber min={1} max={30} />
            </Form.Item>
            <Form.Item name="concurrency" label="并发数">
              <InputNumber min={1} max={100} />
            </Form.Item>
            <Form.Item name="maxRetries" label="最大重试次数">
              <InputNumber min={0} max={10} />
            </Form.Item>
          </Space>
          <Space size="large" style={{ width: "100%" }}>
            <Form.Item name="width" label="宽度">
              <InputNumber min={256} max={4096} step={64} />
            </Form.Item>
            <Form.Item name="height" label="高度">
              <InputNumber min={256} max={4096} step={64} />
            </Form.Item>
            <Form.Item name="seedMode" label="种子模式">
              <Select
                style={{ width: 160 }}
                options={[
                  { label: "随机", value: "random" },
                  { label: "固定", value: "fixed" },
                  { label: "递增", value: "increment" }
                ]}
              />
            </Form.Item>
            <Form.Item name="baseSeed" label="基础种子">
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Form.Item name="promptTemplate" label="提示词模板">
            <Input.TextArea rows={6} />
          </Form.Item>
          <Form.Item name="negativePrompt" label="负向提示词">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Card>

      <Card className="glass-card span-4" title="启动前检查">
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <div className="metric-label">输出目录</div>
            <Typography.Title level={4}>
              {directoryName ?? "尚未选择"}
            </Typography.Title>
            <Button
              icon={<FolderOpen size={16} />}
              disabled={!isFileSystemAccessSupported()}
              onClick={handleSelectDirectory}
            >
              选择输出目录
            </Button>
          </div>
          <div>
            <div className="metric-label">图片总数</div>
            <div className="metric-value">{totalImages}</div>
          </div>
          <div>
            <div className="metric-label">预计成本</div>
            <div className="metric-value">{formatCurrency(estimatedCost)}</div>
          </div>
          <Typography.Paragraph className="muted">
            实际可用并发取决于服务商 API 限流。模拟服务可用于先测试调度、
            重试和文件保存。
          </Typography.Paragraph>
          {watchedValues?.providerId === "mock" ? (
            <Alert
              showIcon
              type="warning"
              message="当前是测试模式"
              description="模拟图片服务只会生成占位测试图，不会调用真实 AI 图片模型。要生成真实图片，需要接入支持浏览器 CORS 直连的真实 Provider。"
            />
          ) : null}
          <Button type="primary" size="large" icon={<Play size={17} />} onClick={submit}>
            创建并启动
          </Button>
        </Space>
      </Card>
    </div>
  );
}
