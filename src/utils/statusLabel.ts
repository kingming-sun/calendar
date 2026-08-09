const statusLabels: Record<string, string> = {
  idle: "空闲",
  created: "已创建",
  running: "运行中",
  paused: "已暂停",
  completed: "已完成",
  partial_failed: "部分失败",
  failed: "失败",
  cancelled: "已取消",
  pending: "等待中",
  processing: "生成中",
  downloading: "下载中",
  saving: "保存中",
  success: "成功"
};

export function getStatusLabel(status?: string): string {
  if (!status) {
    return "未知";
  }

  return statusLabels[status] ?? status;
}
