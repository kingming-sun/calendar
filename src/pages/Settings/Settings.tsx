import { Button, Card, Form, Input, InputNumber, Space, Switch, Table, Typography } from "antd";
import { useAppStore } from "@/stores/appStore";
import type { ProviderConfig } from "@/types";

export function Settings() {
  const providers = useAppStore((state) => state.providers);
  const prompts = useAppStore((state) => state.prompts);
  const saveProvider = useAppStore((state) => state.saveProvider);

  const handleProviderSave = async (provider: ProviderConfig) => {
    await saveProvider(provider);
  };

  return (
    <div className="page-grid">
      <Card className="glass-card span-7" title="服务商配置">
        <Table<ProviderConfig>
          rowKey="id"
          dataSource={providers}
          pagination={false}
          expandable={{
            expandedRowRender: (provider) => (
              <Form
                layout="vertical"
                initialValues={{
                  ...provider,
                  pricePerImage: provider.pricing.pricePerImage ?? 0,
                  pricePerMegapixel: provider.pricing.pricePerMegapixel ?? 0
                }}
                onFinish={(values) =>
                  handleProviderSave({
                    ...provider,
                    name: values.name,
                    model: values.model,
                    apiKey: values.apiKey,
                    enabled: values.enabled,
                    browserCompatible: values.browserCompatible,
                    pricing: {
                      pricePerImage: values.pricePerImage,
                      pricePerMegapixel: values.pricePerMegapixel
                    }
                  })
                }
              >
                <Space size="large" align="start">
                  <Form.Item name="name" label="名称">
                    <Input />
                  </Form.Item>
                  <Form.Item name="model" label="模型">
                    <Input />
                  </Form.Item>
                  <Form.Item name="apiKey" label="API Key">
                    <Input.Password placeholder="仅保存在 IndexedDB，不导出" />
                  </Form.Item>
                </Space>
                {provider.id === "flux" ? (
                  <Typography.Paragraph className="muted">
                    BFL 官方 Key 通常以 <Typography.Text code>bfl_</Typography.Text>{" "}
                    开头。部署到 Vercel 时更推荐把 Key 配置为环境变量{" "}
                    <Typography.Text code>BFL_API_KEY</Typography.Text>，这样浏览器端不需要保存 Key。
                  </Typography.Paragraph>
                ) : null}
                {provider.id === "gemini" ? (
                  <Typography.Paragraph className="muted">
                    Gemini 图片模型建议使用{" "}
                    <Typography.Text code>gemini-2.5-flash-image-preview</Typography.Text>。
                    部署到 Vercel 时推荐配置环境变量{" "}
                    <Typography.Text code>GEMINI_API_KEY</Typography.Text>。
                  </Typography.Paragraph>
                ) : null}
                <Space size="large" align="start">
                  <Form.Item name="pricePerImage" label="单张价格">
                    <InputNumber min={0} step={0.001} />
                  </Form.Item>
                  <Form.Item name="enabled" label="启用" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    name="browserCompatible"
                    label="浏览器兼容"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  <Button type="primary" htmlType="submit">
                    保存
                  </Button>
                </Space>
              </Form>
            )
          }}
          columns={[
            {
              title: "服务商",
              dataIndex: "name"
            },
            {
              title: "模型",
              dataIndex: "model"
            },
            {
              title: "启用",
              dataIndex: "enabled",
              render: (enabled) => (enabled ? "是" : "否")
            },
            {
              title: "CORS",
              dataIndex: "browserCompatible",
              render: (compatible) => (compatible ? "可直连" : "待验证")
            }
          ]}
        />
      </Card>

      <Card className="glass-card span-5" title="Prompt 模板">
        <Space direction="vertical" style={{ width: "100%" }}>
          {prompts.map((prompt) => (
            <Card key={prompt.id} size="small">
              <Typography.Title level={5}>{prompt.name}</Typography.Title>
              <Typography.Paragraph ellipsis={{ rows: 4 }}>
                {prompt.template}
              </Typography.Paragraph>
            </Card>
          ))}
        </Space>
      </Card>

      <Card className="glass-card span-12" title="配置导入导出">
        <Typography.Paragraph className="muted">
          最小可用版本已预留配置导入导出入口。导出配置时不得包含 API Key、目录授权句柄、
          历史任务明细或本地文件路径。
        </Typography.Paragraph>
        <Space>
          <Button disabled>导出配置</Button>
          <Button disabled>导入配置</Button>
        </Space>
      </Card>
    </div>
  );
}
