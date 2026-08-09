import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Alert, Badge, Button, Layout, Menu, Space, Typography } from "antd";
import {
  GalleryHorizontalEnd,
  Gauge,
  History,
  PlaySquare,
  Settings,
  Sparkles
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { BatchStatus } from "@/types";
import { getStatusLabel } from "@/utils/statusLabel";

const { Header, Sider, Content } = Layout;

const navItems = [
  {
    key: "/dashboard",
    icon: <Gauge size={18} />,
    label: "仪表盘"
  },
  {
    key: "/generator",
    icon: <PlaySquare size={18} />,
    label: "生成器"
  },
  {
    key: "/batches",
    icon: <History size={18} />,
    label: "批次"
  },
  {
    key: "/gallery",
    icon: <GalleryHorizontalEnd size={18} />,
    label: "图库"
  },
  {
    key: "/settings",
    icon: <Settings size={18} />,
    label: "设置"
  }
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeBatch = useAppStore((state) => state.activeBatch);
  const error = useAppStore((state) => state.error);
  const reload = useAppStore((state) => state.reload);

  useEffect(() => {
    if (activeBatch?.status !== BatchStatus.RUNNING) {
      return;
    }

    const timer = window.setInterval(() => {
      void reload();
    }, 1500);

    return () => window.clearInterval(timer);
  }, [activeBatch?.status, reload]);

  return (
    <Layout className="app-shell">
      <Sider width={260} className="app-sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={24} />
          </div>
          <div>
            <Typography.Title level={4}>AI 批量图片</Typography.Title>
            <Typography.Text type="secondary">生成控制台</Typography.Text>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={navItems}
          onClick={(item) => navigate(item.key)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Space direction="vertical" size={0}>
            <Typography.Text className="eyebrow">纯前端批量生成控制台</Typography.Text>
            <Typography.Title level={3}>
              {activeBatch?.name ?? "准备创建新的批次"}
            </Typography.Title>
          </Space>
          <Space>
            <Badge
              color={activeBatch ? "#32d5ff" : "#f6b443"}
              text={getStatusLabel(activeBatch?.status ?? "idle")}
            />
            <Button type="primary" onClick={() => navigate("/generator")}>
              新建任务
            </Button>
          </Space>
        </Header>
        {error ? (
          <Alert className="global-alert" type="error" showIcon message={error} />
        ) : null}
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
