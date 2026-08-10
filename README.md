# 小明专用

纯前端批量 AI 图片生成器，基于 `React + TypeScript + Vite + Zustand + Dexie + File System Access API`。

## 当前能力

- 纯前端架构，无后端、无服务端数据库。
- `MockProvider` 可生成 Canvas 测试图片 Blob。
- 支持 Batch / Set / Job 数据模型。
- 支持 IndexedDB 持久化。
- 支持选择本地输出目录并写入 `set_000001/01.jpg` 格式文件。
- 支持并发调度、Retry、Pause、Resume、Cancel、Retry Failed。
- 已实现 Dashboard、Generator、Batches、Batch Detail、Gallery、Settings 页面。

## 本地运行

请先安装 Node.js 20+，然后执行：

```bash
npm install
npm run dev
```

类型检查：

```bash
npm run check
```

生产构建：

```bash
npm run build
```

## 部署到 Vercel

本项目是 Vite 单页应用，可以直接部署到 Vercel。

### 推荐方式：Git 导入

1. 将项目推送到 GitHub / GitLab / Bitbucket。
2. 在 Vercel 中点击 `Add New Project`。
3. 选择该仓库。
4. Vercel 通常会自动识别为 Vite 项目。
5. 使用以下配置：

```text
Framework Preset: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

6. 点击 Deploy。

### AI Provider 环境变量

如果使用真实 AI Provider，推荐在 Vercel 项目中配置环境变量：

```text
BFL_API_KEY=bfl_xxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIza...
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxx
```

应用会通过 Vercel Serverless Function 调用真实 Provider：

```text
/api/bfl/submit
/api/bfl/result
/api/gemini/generate
/api/replicate/generate
```

这样可以绕过浏览器 CORS 限制，也避免把 API Key 暴露在浏览器请求里。

### 前端路由

项目已包含 `vercel.json`：

```json
{
  "rewrites": [
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ]
}
```

这样直接访问 `/dashboard`、`/generator`、`/settings` 等前端路由时不会返回 404。

### 部署注意事项

- Vercel 只托管静态前端，不会保存用户图片或任务数据。
- 用户任务状态仍保存在访问者自己浏览器的 IndexedDB 中。
- 图片仍写入访问者自己选择的本地目录。
- File System Access API 需要 HTTPS 或 localhost，Vercel 默认提供 HTTPS，满足要求。
- BFL 官方 API 通过 Vercel Serverless 代理调用，不需要浏览器 CORS 直连。
- Gemini API 通过 Vercel Serverless 代理调用，不需要浏览器 CORS 直连。
- Replicate API 通过 Vercel Serverless 代理调用，默认模型为 `black-forest-labs/flux-schnell`。
- 如果没有配置 Provider 对应环境变量，应用会退回使用设置页保存的本地 Key。
- 如果账号余额不足或没有额度，任务会显示 Provider 返回的额度/支付错误。

## 浏览器要求

文件写入依赖 File System Access API，建议使用：

- Google Chrome
- Microsoft Edge

Firefox 和 Safari 暂不保证支持。

## 开发文档

- `ARCHITECTURE.md`
- `.trae/documents/PRD.md`
- `.trae/documents/TECHNICAL_ARCHITECTURE.md`
