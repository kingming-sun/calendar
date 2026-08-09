# AI Batch Image Generator — Frontend Architecture

## 1. 项目目标

开发一个**纯前端 Web 应用**，用于批量调用第三方 AI Image Generation API。

核心场景：

```text
用户配置 API
    ↓
配置图片生成参数
    ↓
创建多个 Set
    ↓
每个 Set 生成 13 张图片
    ↓
调用第三方 Image API
    ↓
浏览器直接下载图片
    ↓
保存到用户选择的本地文件夹
```

例如：

```text
1000 Sets
×
13 Images
=
13000 Images
```

应用本身：

* 不需要后端
* 不需要数据库
* 不需要 Redis
* 不需要 Celery
* 不需要 GPU
* 不需要部署 AI 模型
* 不需要云服务器

---

## 2. 总体架构

```text
┌──────────────────────────────────────────────┐
│                  Browser                     │
│                                              │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │ React UI     │      │ Application     │ │
│  │              │─────▶│ State           │ │
│  └──────────────┘      └────────┬────────┘ │
│                                 │          │
│                                 ▼          │
│                       ┌─────────────────┐  │
│                       │ Batch Engine    │  │
│                       └────────┬────────┘  │
│                                │           │
│                    ┌───────────┼──────────┐│
│                    ▼           ▼          ▼│
│               Provider     Retry       Progress
│                Manager      Manager      Manager
│                    │
│                    ▼
│             Third-party API
│                    │
│                    ▼
│                 Image
│                    │
│                    ▼
│          File System Access API
│                    │
│                    ▼
│             Local Folder
└──────────────────────────────────────────────┘
```

---

## 3. 技术栈

### Frontend

```text
React
TypeScript
Vite
Ant Design
```

推荐：

```text
React 19+
TypeScript 5+
Vite
Ant Design
```

### State Management

推荐：

```text
Zustand
```

不要引入 Redux，当前项目规模没有必要。

### HTTP

```text
fetch
```

或者：

```text
axios
```

建议优先使用原生 `fetch`。

### 本地持久化

使用：

```text
IndexedDB
```

推荐：

```text
Dexie.js
```

IndexedDB 保存：

* Batch
* Set
* Job
* Prompt
* Provider Config
* Progress
* Settings

### 本地文件系统

使用：

```text
File System Access API
```

核心 API：

```text
showDirectoryPicker()
```

用户主动选择输出目录。

---

## 4. 浏览器要求

因为项目需要直接写本地文件，因此必须使用支持 File System Access API 的浏览器。

优先支持：

```text
Google Chrome
Microsoft Edge
```

暂不保证：

```text
Firefox
Safari
```

项目启动时检查：

```typescript
if (!("showDirectoryPicker" in window)) {
    // show unsupported browser message
}
```

---

## 5. 项目目录

```text
src/
│
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── providers.tsx
│
├── components/
│   ├── common/
│   ├── batch/
│   ├── provider/
│   ├── prompt/
│   └── settings/
│
├── pages/
│   ├── Dashboard/
│   ├── Generator/
│   ├── Batches/
│   ├── BatchDetail/
│   ├── Gallery/
│   └── Settings/
│
├── stores/
│   ├── batchStore.ts
│   ├── jobStore.ts
│   ├── providerStore.ts
│   └── settingsStore.ts
│
├── services/
│   ├── providers/
│   │   ├── ImageProvider.ts
│   │   ├── FluxProvider.ts
│   │   ├── GeminiProvider.ts
│   │   └── SeedreamProvider.ts
│   │
│   ├── batch/
│   │   ├── BatchEngine.ts
│   │   ├── JobScheduler.ts
│   │   ├── RetryManager.ts
│   │   └── ProgressManager.ts
│   │
│   ├── filesystem/
│   │   ├── FileSystemService.ts
│   │   └── DownloadService.ts
│   │
│   ├── storage/
│   │   └── IndexedDBService.ts
│   │
│   └── cost/
│       └── CostCalculator.ts
│
├── types/
│   ├── batch.ts
│   ├── job.ts
│   ├── provider.ts
│   └── settings.ts
│
├── utils/
│   ├── retry.ts
│   ├── hash.ts
│   ├── filename.ts
│   └── validation.ts
│
└── main.tsx
```

---

## 6. 核心概念

系统只有四个核心对象：

```text
Batch
Set
Job
Image
```

关系：

```text
Batch
 │
 ├── Set 000001
 │     ├── Job 01
 │     ├── Job 02
 │     ├── ...
 │     └── Job 13
 │
 ├── Set 000002
 │     ├── Job 01
 │     └── ...
 │
 └── Set 001000
```

---

## 7. Batch

一个 Batch 表示一次完整生成任务。

例如：

```typescript
interface Batch {
    id: string;

    name: string;

    setCount: number;

    imagesPerSet: number;

    totalImages: number;

    provider: string;

    model: string;

    status: BatchStatus;

    completedImages: number;

    failedImages: number;

    processingImages: number;

    createdAt: number;

    updatedAt: number;
}
```

计算：

```text
totalImages =
    setCount × imagesPerSet
```

默认：

```text
imagesPerSet = 13
```

---

## 8. Set

Set 是一个挂历对应的 13 张图片集合。

```typescript
interface ImageSet {
    id: string;

    batchId: string;

    index: number;

    status: SetStatus;

    totalImages: number;

    completedImages: number;

    failedImages: number;

    createdAt: number;

    updatedAt: number;
}
```

例如：

```text
set_000001
```

包含：

```text
01
02
03
...
13
```

---

## 9. Job

Job 是最小执行单位。

一个 Job = 生成一张图片。

```typescript
interface ImageJob {
    id: string;

    batchId: string;

    setId: string;

    imageIndex: number;

    prompt: string;

    negativePrompt?: string;

    provider: string;

    model: string;

    status: JobStatus;

    retryCount: number;

    maxRetries: number;

    imageUrl?: string;

    localPath?: string;

    error?: string;

    estimatedCost?: number;

    actualCost?: number;

    createdAt: number;

    startedAt?: number;

    completedAt?: number;
}
```

---

## 10. Job Status

```typescript
enum JobStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    DOWNLOADING = "downloading",
    SAVING = "saving",
    SUCCESS = "success",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
```

---

## 11. Batch Status

```typescript
enum BatchStatus {
    CREATED = "created",
    RUNNING = "running",
    PAUSED = "paused",
    COMPLETED = "completed",
    PARTIAL_FAILED = "partial_failed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
```

---

## 12. Provider 抽象

所有图片 API 必须实现统一接口。

```typescript
interface ImageProvider {
    id: string;

    name: string;

    generate(
        request: ImageGenerationRequest
    ): Promise<ImageGenerationResult>;
}
```

Request：

```typescript
interface ImageGenerationRequest {
    prompt: string;

    negativePrompt?: string;

    width: number;

    height: number;

    seed?: number;

    model: string;
}
```

Result：

```typescript
interface ImageGenerationResult {
    success: boolean;

    imageUrl?: string;

    imageBlob?: Blob;

    providerJobId?: string;

    cost?: number;

    error?: ProviderError;
}
```

---

## 13. Provider Manager

统一管理 Provider。

```text
ProviderManager
      │
      ├── FluxProvider
      │
      ├── GeminiProvider
      │
      └── SeedreamProvider
```

业务层禁止直接：

```typescript
fetch("https://xxx")
```

必须：

```typescript
providerManager.generate(...)
```

这样未来换模型不需要修改 Batch Engine。

---

## 14. API Key

由于是纯前端项目，API Key 必然存在浏览器端。

这是一个**个人/内部工具**，可以接受。

但是必须：

```text
API Key
↓
只保存在本地 IndexedDB
```

不要：

```text
API Key
↓
发送到任何自己的服务器
```

也不要：

```text
console.log(apiKey)
```

UI 默认：

```text
***************
```

---

## 15. API Key 安全边界

必须明确：

> **纯前端应用无法真正隐藏 API Key。**

用户自己的浏览器拥有 Key 的访问权限。

因此这个项目定位为：

```text
Personal Tool
Internal Tool
```

而不是：

```text
Public SaaS
```

如果以后变成公开 SaaS，再增加 Backend Proxy。

当前阶段禁止增加 Backend Proxy。

---

## 16. File System Architecture

用户点击：

```text
Select Output Folder
```

调用：

```typescript
const directoryHandle =
    await window.showDirectoryPicker();
```

保存：

```text
DirectoryHandle
```

注意：

**DirectoryHandle 本身不能简单 JSON 序列化。**

需要通过 IndexedDB 保存 File System Access API 支持的 Handle。

---

## 17. 输出目录

用户选择：

```text
/Users/user/Desktop/calendar
```

程序自动创建：

```text
calendar/
│
├── set_000001/
│   ├── 01.jpg
│   ├── 02.jpg
│   ├── ...
│   └── 13.jpg
│
├── set_000002/
│   └── ...
│
└── set_001000/
```

---

## 18. FileSystemService

统一封装浏览器文件 API：

```typescript
interface FileSystemService {

    selectDirectory(): Promise<void>;

    createDirectory(
        name: string
    ): Promise<FileSystemDirectoryHandle>;

    saveFile(
        directory: FileSystemDirectoryHandle,
        filename: string,
        blob: Blob
    ): Promise<void>;

    fileExists(
        directory: FileSystemDirectoryHandle,
        filename: string
    ): Promise<boolean>;
}
```

UI 和 Batch Engine 不允许直接操作：

```text
FileSystem API
```

全部通过：

```text
FileSystemService
```

---

## 19. IndexedDB

使用：

```text
Dexie.js
```

数据库：

```text
AIBatchDB
```

Tables：

```text
batches
sets
jobs
providers
prompts
settings
```

---

## 20. 为什么需要 IndexedDB

虽然是纯前端，但不能只使用 React State。

因为：

```text
13000 jobs
```

如果全部只存在内存：

```text
浏览器刷新
↓
全部丢失
```

所以：

```text
React State
     ↓
运行时状态

IndexedDB
     ↓
持久化状态
```

---

## 21. Batch Engine

这是整个项目最重要的模块。

```text
BatchEngine
    │
    ├── loadBatch()
    │
    ├── createJobs()
    │
    ├── start()
    │
    ├── pause()
    │
    ├── resume()
    │
    ├── cancel()
    │
    └── retryFailed()
```

---

## 22. Job Scheduler

负责控制并发。

例如：

```text
Concurrency = 10
```

那么：

```text
Job 1 → running
Job 2 → running
...
Job 10 → running

Job 11 → pending
Job 12 → pending
...
```

Job 完成：

```text
Job 1 SUCCESS
       ↓
Job 11 START
```

始终保持：

```text
running <= concurrency
```

---

## 23. 不要一次创建 13,000 个 Promise

禁止：

```typescript
await Promise.all(
    jobs.map(job => generate(job))
);
```

这是错误架构。

必须使用 Scheduler：

```text
Queue
 ↓
Worker Slot
 ↓
API
 ↓
Result
 ↓
Next Job
```

---

## 24. 推荐 Scheduler

使用简单的 Promise Pool。

例如：

```typescript
class JobScheduler {

    constructor(
        private concurrency: number
    ) {}

    async run(
        jobs: ImageJob[]
    ) {
        // worker pool
    }
}
```

第一版不需要第三方 Queue Library。

---

## 25. Retry

默认：

```text
maxRetries = 3
```

策略：

```text
Attempt 1
 ↓
5 sec

Attempt 2
 ↓
30 sec

Attempt 3
 ↓
120 sec

Failed
```

使用：

```text
Exponential Backoff
```

---

## 26. HTTP 429

遇到：

```text
429 Too Many Requests
```

读取：

```text
Retry-After
```

例如：

```text
Retry-After: 20
```

那么：

```text
等待 20 秒
↓
重新请求
```

不要立即 retry。

---

## 27. HTTP Error

分类：

### Retry

```text
429
500
502
503
504
network error
timeout
```

### Don't Retry

```text
400
401
403
404
invalid prompt
invalid parameter
invalid API key
```

---

## 28. Pause

用户点击：

```text
Pause
```

只停止：

```text
新 Job
```

已经执行的请求：

```text
继续完成
```

完成以后不再启动新的 Job。

---

## 29. Resume

```text
PAUSED
 ↓
RESUME
 ↓
Scheduler继续消费
```

---

## 30. Browser 刷新恢复

应用启动：

```text
load IndexedDB
       ↓
找到 RUNNING Batch
       ↓
检查 jobs
       ↓
SUCCESS → skip
FAILED → retry
PROCESSING → reset to PENDING
PENDING → continue
```

注意：

浏览器关闭时无法保证正在进行的 HTTP request 完成。

因此：

```text
PROCESSING
```

重新启动后应该变成：

```text
PENDING
```

---

## 31. 文件恢复

重新启动时检查：

```text
set_000001/01.jpg
```

如果文件存在：

```text
SUCCESS
```

即使 IndexedDB 状态没有保存成功，也可以恢复。

所以最终判断：

```text
File exists
+
File size > 0
```

即可认为图片已经保存。

---

## 32. Filename

统一：

```text
01.jpg
02.jpg
...
13.jpg
```

Set：

```text
set_000001
```

不要使用：

```text
image-uuid-random.jpg
```

因为不方便人工检查。

---

## 33. Prompt Template

支持变量：

```text
{{set_index}}
{{image_index}}
{{theme}}
{{subject}}
{{style}}
{{environment}}
```

例如：

```text
A beautiful {{subject}},
{{style}},
{{environment}},
fine art,
high detail,
vertical composition,
no text,
no watermark.
```

---

## 34. Set Template

例如：

```json
{
    "name": "Cat Calendar",

    "theme": "Vintage Blue",

    "subject": "Siamese Cat",

    "style": "Impressionist Oil Painting",

    "images": [
        {
            "index": 1,
            "prompt": "cat sitting on a chair"
        },
        {
            "index": 2,
            "prompt": "cat sleeping beside a window"
        }
    ]
}
```

如果只有一个基础 Prompt：

```text
每个 Set 的 13 张图片使用相同 Prompt
```

也必须支持。

---

## 35. Seed

如果 Provider 支持 Seed：

提供：

```text
Seed Mode
```

选项：

```text
Random
Fixed
Increment
```

例如：

```text
Set 1
seed = 10001

Set 2
seed = 10002
```

---

## 36. 图片质量

第一阶段只做基础检查：

```text
HTTP success
Blob exists
File size > 0
Image decode success
Width correct
Height correct
```

不要第一版就接 Vision Model。

---

## 37. Cost Calculator

Provider 配置：

```typescript
interface ProviderPricing {
    pricePerImage?: number;
    pricePerMegapixel?: number;
}
```

前端实时计算：

```text
Total Images
×
Price
=
Estimated Cost
```

例如：

```text
1000 Sets
×
13
=
13000

$0.003/image

Estimated:
$39
```

---

## 38. Dashboard

显示：

```text
Current Batch

Sets
1000

Images
13000

Completed
7821

Failed
31

Processing
10

Remaining
5138

Progress
60.16%

Estimated Cost
$39.00

Actual Cost
$23.46
```

---

## 39. Generator 页面

核心 UI：

```text
Provider
Model
API Key

Output Folder

Set Count
Images Per Set

Prompt Template

Concurrency

Width
Height

Seed Mode

[ Start ]
```

---

## 40. Batch Detail

显示：

```text
Set 000001
SUCCESS 13/13

Set 000002
SUCCESS 13/13

Set 000003
FAILED 11/13

Set 000004
PROCESSING 8/13
```

点击 Set：

```text
01 SUCCESS
02 SUCCESS
03 FAILED
...
13 SUCCESS
```

可以单独：

```text
Retry
```

---

## 41. Gallery

简单展示已经生成的图片：

```text
┌────┐ ┌────┐ ┌────┐
│    │ │    │ │    │
│IMG │ │IMG │ │IMG │
│    │ │    │ │    │
└────┘ └────┘ └────┘
```

支持：

```text
Set
Image Index
Status
```

---

## 42. 不需要服务器

最终数据流：

```text
React
 │
 ├───────────────→ AI API
 │                     │
 │                     ↓
 │                  Image
 │                     │
 ↓                     │
IndexedDB               │
 │                     │
 └───────────────┐     │
                 ↓     ↓
              Browser
                 │
                 ↓
        File System Access API
                 │
                 ↓
            Local Disk
```

---

## 43. 网络限制

纯前端最大的技术风险：

```text
CORS
```

某些 Provider API 可能不允许：

```text
Browser → API
```

因此 Provider 必须在开发阶段验证：

```text
CORS
Streaming
Response format
Authentication
```

如果某 Provider 不支持浏览器直接调用：

**第一版不要为了它加后端。**

直接标记：

```text
Browser incompatible
```

换支持浏览器直连的 Provider。

---

## 44. 不要做代理

项目明确禁止：

```text
Browser
 ↓
Your Backend
 ↓
AI API
```

当前版本必须：

```text
Browser
 ↓
AI API
```

---

## 45. 性能要求

目标：

```text
100 jobs
1000 jobs
13000 jobs
```

都不能因为 Job 数量增长导致：

```text
页面卡顿
```

不要把所有 Job 全部渲染到 DOM。

使用：

```text
Virtual List
```

例如：

```text
react-window
```

或者 Ant Design Virtual List。

---

## 46. 内存管理

图片 Blob 使用完成以后：

```typescript
URL.revokeObjectURL(url);
```

避免：

```text
13000 images
```

导致浏览器内存不断增长。

Gallery 只加载：

```text
Thumbnail
```

不要自动加载原图。

---

## 47. 并发默认值

默认：

```text
10
```

允许：

```text
1 ~ 100
```

但是 UI 必须显示：

> 实际可用并发取决于 Provider API Rate Limit。

---

## 48. 浏览器标签页

用户关闭页面：

```text
任务停止
```

这是纯前端应用的正常行为。

不要承诺：

```text
浏览器关闭以后继续生成
```

如果未来需要后台继续运行，再考虑：

```text
Tauri
Electron
Backend
```

当前版本不做。

---

## 49. 数据持久化策略

每个 Job 状态变化：

```text
Job START
 ↓
IndexedDB update

Job SUCCESS
 ↓
IndexedDB update
```

但是不能每几毫秒写一次数据库。

Progress 更新采用：

```text
throttle 500ms
```

或：

```text
debounce 500ms
```

---

## 50. 错误日志

保存：

```typescript
interface JobError {
    code?: string;

    message: string;

    httpStatus?: number;

    retryable: boolean;

    timestamp: number;
}
```

用户可以查看：

```text
Failed Jobs
```

并：

```text
Retry Failed
```

---

## 51. 配置导入导出

非常重要。

支持：

```text
Export Config
Import Config
```

导出：

```json
{
    "provider": "flux",
    "model": "xxx",
    "width": 1024,
    "height": 1024,
    "concurrency": 10,
    "promptTemplate": "..."
}
```

**不要导出 API Key。**

---

## 52. Prompt Template 保存

可以保存：

```text
Cat Vintage
Dog Vintage
Flower Oil Painting
Japanese Art
```

用户直接选择：

```text
Template
```

---

## 53. Provider 配置

例如：

```text
FLUX
Model: xxx
Price: $0.003/image

Gemini
Model: xxx
Price: $0.0xx/image
```

支持：

```text
Enable / Disable
```

---

## 54. MVP 开发顺序

严格按照：

### Phase 1

```text
React
Vite
TypeScript
Ant Design
```

完成 UI。

### Phase 2

```text
IndexedDB
Dexie
```

完成数据持久化。

### Phase 3

```text
File System Access API
```

完成：

```text
选择文件夹
创建 Set 文件夹
保存图片
```

### Phase 4

实现：

```text
ImageProvider
```

只接入一个 Provider。

### Phase 5

实现：

```text
BatchEngine
JobScheduler
RetryManager
```

### Phase 6

测试：

```text
1 Set
13 Images
```

### Phase 7

测试：

```text
10 Sets
130 Images
```

### Phase 8

测试：

```text
100 Sets
1300 Images
```

### Phase 9

测试：

```text
1000 Sets
13000 Images
```

---

## 55. MVP 验收标准

必须满足：

```text
✓ 浏览器直接调用 AI API

✓ 不需要后端

✓ API Key 本地保存

✓ 用户可以选择本地输出目录

✓ 自动创建 Set 文件夹

✓ 每 Set 13 张

✓ 图片直接写入本地

✓ 并发控制

✓ Retry

✓ 429 处理

✓ Pause

✓ Resume

✓ Cancel

✓ Retry Failed

✓ IndexedDB 持久化

✓ 浏览器刷新可以恢复任务状态

✓ 已经存在的图片不会重复生成

✓ 支持 1000 Set / 13000 Image

✓ 不因大量 Job 导致 UI 卡死
```

---

## 56. 最终架构图

```text
                         Browser
┌────────────────────────────────────────────────────┐
│                                                    │
│                    React UI                        │
│                       │                            │
│                       ▼                            │
│                 Zustand Store                     │
│                       │                            │
│          ┌────────────┴────────────┐              │
│          ▼                         ▼              │
│    Batch Engine               IndexedDB           │
│          │                    (Dexie)              │
│          │                                         │
│          ▼                                         │
│    Job Scheduler                                   │
│          │                                         │
│     ┌────┼────┬────┐                              │
│     ▼    ▼    ▼    ▼                              │
│   Job   Job  Job  Job                             │
│     │    │    │    │                              │
│     └────┼────┴────┘                              │
│          ▼                                         │
│    Provider Manager                                │
│          │                                         │
│     ┌────┼────────────┐                           │
│     ▼    ▼            ▼                           │
│   FLUX Gemini      Seedream                       │
│     │    │            │                           │
│     └────┼────────────┘                           │
│          ▼                                         │
│       Image Blob                                   │
│          │                                         │
│          ▼                                         │
│  File System Access API                            │
│          │                                         │
└──────────┼─────────────────────────────────────────┘
           ▼
     Local File System

     output/
       ├── set_000001/
       │    ├── 01.jpg
       │    ├── ...
       │    └── 13.jpg
       │
       ├── set_000002/
       │    └── ...
       │
       └── set_001000/
```

---

## 57. TypeScript 类型分层

类型定义应集中放在：

```text
src/types/
```

建议拆分：

```text
batch.ts
set.ts
job.ts
provider.ts
filesystem.ts
settings.ts
error.ts
```

规则：

```text
types/
  只放类型、枚举、常量类型

services/
  只放业务逻辑

stores/
  只放状态读取和状态更新

pages/
  只负责页面组合

components/
  只负责可复用 UI
```

禁止：

```text
在 React Component 里定义核心业务类型
```

---

## 58. 推荐核心类型

### Batch

```typescript
export interface Batch {
    id: string;
    name: string;
    setCount: number;
    imagesPerSet: number;
    totalImages: number;
    providerId: string;
    model: string;
    width: number;
    height: number;
    concurrency: number;
    status: BatchStatus;
    completedImages: number;
    failedImages: number;
    processingImages: number;
    estimatedCost?: number;
    actualCost?: number;
    createdAt: number;
    updatedAt: number;
}
```

### ImageSet

```typescript
export interface ImageSet {
    id: string;
    batchId: string;
    index: number;
    name: string;
    status: SetStatus;
    totalImages: number;
    completedImages: number;
    failedImages: number;
    createdAt: number;
    updatedAt: number;
}
```

### ImageJob

```typescript
export interface ImageJob {
    id: string;
    batchId: string;
    setId: string;
    setIndex: number;
    imageIndex: number;
    prompt: string;
    negativePrompt?: string;
    providerId: string;
    model: string;
    width: number;
    height: number;
    seed?: number;
    status: JobStatus;
    retryCount: number;
    maxRetries: number;
    imageUrl?: string;
    localDirectory?: string;
    localFilename?: string;
    error?: JobError;
    estimatedCost?: number;
    actualCost?: number;
    createdAt: number;
    updatedAt: number;
    startedAt?: number;
    completedAt?: number;
}
```

### Settings

```typescript
export interface AppSettings {
    defaultImagesPerSet: number;
    defaultConcurrency: number;
    defaultWidth: number;
    defaultHeight: number;
    defaultMaxRetries: number;
    progressFlushIntervalMs: number;
}
```

---

## 59. Dexie 数据库设计

数据库文件：

```text
src/services/storage/db.ts
```

推荐定义：

```typescript
import Dexie, { type Table } from "dexie";

export class AIBatchDB extends Dexie {
    batches!: Table<Batch, string>;
    sets!: Table<ImageSet, string>;
    jobs!: Table<ImageJob, string>;
    providers!: Table<ProviderConfig, string>;
    prompts!: Table<PromptTemplate, string>;
    settings!: Table<AppSettingRecord, string>;
    fileHandles!: Table<FileHandleRecord, string>;

    constructor() {
        super("AIBatchDB");

        this.version(1).stores({
            batches: "id, status, createdAt, updatedAt",
            sets: "id, batchId, status, index",
            jobs: "id, batchId, setId, status, setIndex, imageIndex",
            providers: "id, enabled",
            prompts: "id, name, updatedAt",
            settings: "key",
            fileHandles: "id, batchId"
        });
    }
}
```

说明：

```text
batches
  保存批次汇总信息

sets
  保存每个 Set 的汇总状态

jobs
  保存每张图片的执行状态

providers
  保存 Provider 配置和 API Key

prompts
  保存 Prompt 模板

settings
  保存应用设置

fileHandles
  保存 File System Access API Handle
```

---

## 60. IndexedDB 写入策略

不要每次 UI 变化都直接写数据库。

推荐：

```text
用户配置表单
  ↓
Zustand 临时状态
  ↓
点击 Save / Start
  ↓
IndexedDB
```

Job 状态必须及时写入：

```text
PENDING → PROCESSING
PROCESSING → DOWNLOADING
DOWNLOADING → SAVING
SAVING → SUCCESS
PROCESSING → FAILED
```

Progress 汇总可以节流写入：

```text
completedImages
failedImages
processingImages
updatedAt
```

推荐：

```text
throttle 500ms
```

---

## 61. Zustand Store 边界

Zustand 只负责：

```text
当前页面状态
当前 Batch 摘要
运行中进度
Provider 配置缓存
Settings 缓存
UI Loading / Error
```

Zustand 不应该长期保存：

```text
13000 个完整 Job 对象
13000 个图片 Blob
大量 base64 图片
```

大量 Job 应该：

```text
IndexedDB 查询
  ↓
分页 / 虚拟列表加载
  ↓
只渲染当前可见区域
```

---

## 62. 状态机

### Job 状态机

```text
PENDING
  ↓
PROCESSING
  ↓
DOWNLOADING
  ↓
SAVING
  ↓
SUCCESS
```

失败分支：

```text
PROCESSING
  ↓
FAILED

DOWNLOADING
  ↓
FAILED

SAVING
  ↓
FAILED
```

取消分支：

```text
PENDING
  ↓
CANCELLED
```

注意：

```text
已经 PROCESSING 的 Job 不强制中断
```

### Batch 状态机

```text
CREATED
  ↓
RUNNING
  ↓
COMPLETED
```

暂停：

```text
RUNNING
  ↓
PAUSED
  ↓
RUNNING
```

失败：

```text
RUNNING
  ↓
PARTIAL_FAILED
```

取消：

```text
CREATED / RUNNING / PAUSED
  ↓
CANCELLED
```

---

## 63. BatchEngine 职责边界

`BatchEngine` 是业务编排层。

负责：

```text
读取 Batch
创建 Set
创建 Job
启动 Scheduler
暂停 Scheduler
恢复 Scheduler
取消未开始 Job
重试失败 Job
聚合进度
调用 ProviderManager
调用 FileSystemService
更新 IndexedDB
```

不负责：

```text
React UI 渲染
表单校验 UI
Provider 具体 HTTP 细节
File System API 具体实现细节
图片 Gallery 展示
```

---

## 64. Scheduler 伪代码

必须使用 Worker Pool。

```typescript
export class JobScheduler {
    private paused = false;
    private cancelled = false;

    constructor(
        private readonly concurrency: number,
        private readonly runJob: (job: ImageJob) => Promise<void>
    ) {}

    pause() {
        this.paused = true;
    }

    resume() {
        this.paused = false;
    }

    cancel() {
        this.cancelled = true;
    }

    async run(jobs: ImageJob[]) {
        let cursor = 0;

        const worker = async () => {
            while (cursor < jobs.length && !this.cancelled) {
                if (this.paused) {
                    await sleep(500);
                    continue;
                }

                const job = jobs[cursor];
                cursor += 1;

                await this.runJob(job);
            }
        };

        const workers = Array.from(
            { length: this.concurrency },
            () => worker()
        );

        await Promise.all(workers);
    }
}
```

注意：

```text
这里创建的是固定数量 worker
不是为每个 Job 创建 Promise
```

---

## 65. RetryManager 设计

职责：

```text
判断错误是否可重试
计算下一次等待时间
处理 Retry-After
记录 retryCount
返回最终失败原因
```

推荐接口：

```typescript
export interface RetryDecision {
    shouldRetry: boolean;
    delayMs: number;
    reason: string;
}

export interface RetryManager {
    getDecision(error: ProviderError, retryCount: number): RetryDecision;
}
```

默认延迟：

```text
retryCount = 0 → 5s
retryCount = 1 → 30s
retryCount = 2 → 120s
```

如果响应包含：

```text
Retry-After
```

则优先使用 Provider 返回的等待时间。

---

## 66. Provider 接入规范

每个 Provider 文件只负责一个外部 API。

例如：

```text
FluxProvider.ts
GeminiProvider.ts
SeedreamProvider.ts
```

Provider 必须处理：

```text
鉴权 Header
请求参数转换
响应格式转换
错误格式转换
CORS 兼容性验证
429 Retry-After 读取
图片 URL 或 Blob 提取
```

Provider 不允许处理：

```text
Batch 状态
Job 调度
文件保存
UI 提示
Zustand 状态
```

统一返回：

```typescript
ImageGenerationResult
```

---

## 67. Provider 兼容性检查表

接入任何 Provider 前必须验证：

```text
是否允许 Browser 直接请求
是否支持 CORS preflight
是否允许 Authorization Header
是否返回图片 Blob
是否返回图片 URL
图片 URL 是否允许浏览器下载
是否需要轮询任务结果
是否有 Rate Limit
是否返回 Retry-After
是否支持 Seed
是否支持 Width / Height
是否支持 Negative Prompt
错误响应格式是否稳定
```

如果任一关键项不支持：

```text
标记为 Browser incompatible
```

不要为该 Provider 增加后端代理。

---

## 68. FileSystemService 实现要求

文件服务必须封装：

```text
选择目录
保存目录 Handle
恢复目录权限
创建 Set 子目录
保存 Blob
检查文件是否存在
检查文件大小
```

保存文件流程：

```text
getDirectoryHandle("set_000001", { create: true })
  ↓
getFileHandle("01.jpg", { create: true })
  ↓
createWritable()
  ↓
write(blob)
  ↓
close()
```

伪代码：

```typescript
async function saveFile(
    directory: FileSystemDirectoryHandle,
    filename: string,
    blob: Blob
) {
    const fileHandle = await directory.getFileHandle(filename, {
        create: true
    });

    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}
```

---

## 69. 文件权限恢复

浏览器可能在刷新后要求重新授权。

启动时需要：

```text
读取 IndexedDB 中的 directoryHandle
  ↓
queryPermission({ mode: "readwrite" })
  ↓
如果 granted，继续
  ↓
如果 prompt，调用 requestPermission()
  ↓
如果 denied，让用户重新选择目录
```

伪代码：

```typescript
async function ensureReadWritePermission(
    handle: FileSystemDirectoryHandle
) {
    const options = { mode: "readwrite" as const };

    if ((await handle.queryPermission(options)) === "granted") {
        return true;
    }

    if ((await handle.requestPermission(options)) === "granted") {
        return true;
    }

    return false;
}
```

---

## 70. 图片下载策略

Provider 可能返回：

```text
Blob
URL
Base64
```

统一转换成：

```text
Blob
```

处理规则：

```text
Blob
  直接保存

URL
  fetch(url) 转 Blob

Base64
  decode 成 Blob
```

保存前必须校验：

```text
blob.size > 0
mime type 合法
图片可以 decode
宽高符合配置
```

---

## 71. 图片校验

第一版推荐使用浏览器原生能力：

```typescript
async function validateImageBlob(
    blob: Blob,
    expectedWidth: number,
    expectedHeight: number
) {
    const bitmap = await createImageBitmap(blob);

    const valid =
        bitmap.width === expectedWidth &&
        bitmap.height === expectedHeight;

    bitmap.close();

    return valid;
}
```

如果 Provider 可能返回近似尺寸：

```text
允许配置是否严格校验宽高
```

默认：

```text
严格校验
```

---

## 72. Prompt 渲染规则

Prompt Template 输入：

```text
A beautiful {{subject}}, {{style}}, set {{set_index}}, image {{image_index}}
```

渲染上下文：

```typescript
export interface PromptContext {
    setIndex: number;
    imageIndex: number;
    theme?: string;
    subject?: string;
    style?: string;
    environment?: string;
}
```

规则：

```text
{{set_index}} 使用 1-based index
{{image_index}} 使用 1-based index
未知变量保留原样或提示错误
空变量不应生成 "undefined"
```

建议：

```text
启动 Batch 前检查 Prompt Template 变量是否合法
```

---

## 73. Seed 生成规则

Seed Mode：

```text
Random
Fixed
Increment
```

规则：

```text
Random
  每个 Job 随机生成 seed

Fixed
  所有 Job 使用同一个 seed

Increment
  baseSeed + setIndex 或 baseSeed + jobIndex
```

推荐：

```text
Increment 默认按 Set 增加
```

例如：

```text
baseSeed = 10000

set_000001 image 01 → 10001
set_000001 image 02 → 10001
set_000002 image 01 → 10002
```

---

## 74. 命名规则

Batch：

```text
batch_yyyyMMdd_HHmmss
```

Set：

```text
set_000001
set_000002
```

Image：

```text
01.jpg
02.jpg
...
13.jpg
```

Job：

```text
job_{batchId}_{setIndex}_{imageIndex}
```

注意：

```text
文件名必须稳定
```

这样才能支持：

```text
刷新恢复
跳过已存在文件
人工检查输出目录
```

---

## 75. 断点续跑算法

应用启动恢复：

```text
加载 RUNNING / PAUSED / PARTIAL_FAILED Batch
  ↓
检查输出目录权限
  ↓
遍历 Job
  ↓
对每个 Job 检查目标文件
  ↓
文件存在且 size > 0 → SUCCESS
  ↓
PROCESSING / DOWNLOADING / SAVING → PENDING
  ↓
FAILED 保持 FAILED
  ↓
重新计算 Batch / Set 进度
```

用户点击 Resume：

```text
只消费 PENDING Job
```

用户点击 Retry Failed：

```text
FAILED → PENDING
retryCount 可选择重置为 0
```

---

## 76. 取消策略

Cancel 行为：

```text
Batch status → CANCELLED
PENDING Job → CANCELLED
不再启动新 Job
已在执行的 Job 允许自然结束
执行完成后不再继续调度
```

如果需要强制中断 HTTP：

```text
第二版再引入 AbortController
```

MVP 中不强制要求中断已经发出的请求。

---

## 77. UI 页面职责

### Dashboard

负责：

```text
展示当前 Batch 总览
展示全局进度
展示成本估算
展示失败数量
提供快速入口
```

### Generator

负责：

```text
创建 Batch
配置 Provider
配置 Prompt
配置输出目录
配置并发
启动任务
```

### Batches

负责：

```text
展示历史 Batch
恢复 Batch
删除 Batch 记录
查看 Batch Detail
```

### BatchDetail

负责：

```text
展示 Set 列表
展示 Job 列表
Retry Set
Retry Failed
Pause / Resume / Cancel
```

### Gallery

负责：

```text
查看已生成图片
按 Batch / Set / Status 筛选
只加载缩略图或当前可见图片
```

### Settings

负责：

```text
Provider 管理
默认参数
Prompt 模板
配置导入导出
```

---

## 78. UI 性能策略

必须避免：

```text
一次渲染 13000 行 Job
一次加载 13000 张图片
把全部 Job 放入单个 useState
每个 Job 状态变化都触发整页重渲染
```

推荐：

```text
虚拟列表
分页查询 IndexedDB
按 Batch 汇总进度
按 Set 展开查看 Job
缩略图懒加载
状态更新节流
```

组件设计：

```text
Dashboard 使用汇总数据
BatchDetail 默认只显示 Set
点击 Set 后再加载该 Set 的 13 个 Job
Gallery 只加载可见区域图片
```

---

## 79. 错误处理分层

错误类型：

```text
ProviderError
NetworkError
RateLimitError
ValidationError
FileSystemError
PermissionError
StorageError
UnknownError
```

错误展示：

```text
用户可读 message
技术细节可展开查看
失败 Job 可筛选
失败原因可复制
```

禁止：

```text
console.log(apiKey)
在错误信息里暴露 API Key
把完整 Authorization Header 写入 IndexedDB
```

---

## 80. 配置导入导出格式

导出文件：

```text
ai-batch-config.json
```

格式：

```json
{
    "version": 1,
    "providerId": "flux",
    "model": "model-name",
    "width": 1024,
    "height": 1024,
    "imagesPerSet": 13,
    "concurrency": 10,
    "maxRetries": 3,
    "promptTemplate": "A beautiful {{subject}}",
    "negativePrompt": "text, watermark",
    "seedMode": "increment",
    "baseSeed": 10000
}
```

禁止导出：

```text
API Key
DirectoryHandle
历史 Job
本地文件路径
```

导入时必须校验：

```text
version
providerId
width
height
concurrency
promptTemplate
```

---

## 81. 安全策略

纯前端安全边界：

```text
不能隐藏 API Key
不能阻止用户从 DevTools 查看请求
不能作为公开 SaaS 提供给不可信用户
```

必须做到：

```text
API Key 只保存在本地 IndexedDB
不上传 API Key
不打印 API Key
导出配置不包含 API Key
错误日志不包含 API Key
UI 默认隐藏 API Key
```

建议：

```text
提示用户使用低权限 API Key
提示用户设置 Provider 侧额度限制
提示用户不要在公共电脑保存 Key
```

---

## 82. 测试策略

### Unit Test

覆盖：

```text
filename
prompt render
seed generate
retry decision
cost calculator
status transition
provider response parser
```

### Integration Test

覆盖：

```text
create batch
create sets
create jobs
scheduler concurrency
retry failed
pause resume
cancel pending jobs
IndexedDB persistence
```

### Manual Test

覆盖：

```text
Chrome 选择目录
刷新后恢复目录权限
保存 1 Set / 13 Images
保存 10 Sets / 130 Images
保存 100 Sets / 1300 Images
断网重试
429 retry-after
关闭页面再打开
```

---

## 83. MVP 不做事项

第一版明确不做：

```text
后端服务
Backend Proxy
用户登录
团队协作
云端同步
云端数据库
服务端队列
浏览器关闭后继续运行
Vision Model 自动质检
复杂图片编辑器
多用户权限
公开 SaaS
Electron
Tauri
```

这些能力如果未来需要，应作为第二阶段或第三阶段重新评估。

---

## 84. 开发优先级

推荐顺序：

```text
1. 初始化 React + Vite + TypeScript + Ant Design
2. 搭建路由和基础布局
3. 定义核心 types
4. 接入 Zustand
5. 接入 Dexie
6. 实现 Settings 和 Provider Config
7. 实现 FileSystemService
8. 实现 Prompt Template
9. 实现 Batch / Set / Job 创建
10. 实现 MockProvider
11. 实现 JobScheduler
12. 实现 BatchEngine
13. 实现 RetryManager
14. 接入第一个真实 Provider
15. 实现 Dashboard / BatchDetail / Gallery
16. 做 1 Set 测试
17. 做 10 Sets 测试
18. 做 100 Sets 测试
19. 做 1000 Sets 测试
```

建议先用：

```text
MockProvider
```

模拟图片生成，确认：

```text
调度
状态
文件保存
恢复
UI 性能
```

再接入真实 AI Provider。

---

## 85. MockProvider

MVP 初期必须实现一个 `MockProvider`。

用途：

```text
不消耗真实 API 额度
不受 CORS 影响
可稳定测试 Scheduler
可稳定测试 Retry
可稳定测试文件保存
可稳定测试 13000 Jobs
```

行为：

```text
延迟 300ms ~ 1500ms
返回 canvas 生成的测试图片 Blob
可配置失败率
可配置 429 概率
可配置网络错误概率
```

这样可以在没有真实 Provider 的情况下先完成核心系统。

---

## 86. 关键风险

### CORS 风险

风险：

```text
Provider 不允许浏览器直连
```

应对：

```text
开发前验证 Provider
不兼容则替换 Provider
不为 MVP 增加后端
```

### 浏览器权限风险

风险：

```text
刷新后目录权限失效
```

应对：

```text
启动时检查权限
必要时让用户重新授权目录
```

### 大任务性能风险

风险：

```text
13000 Jobs 导致页面卡顿
```

应对：

```text
虚拟列表
分页查询
汇总状态
避免全量渲染
```

### 成本风险

风险：

```text
误启动大量任务产生费用
```

应对：

```text
启动前显示预计成本
大批量任务二次确认
Provider 侧配置额度限制
```

---

## 87. 启动前确认弹窗

当任务规模较大时必须二次确认。

触发条件：

```text
totalImages >= 1000
estimatedCost >= 用户设置阈值
```

弹窗展示：

```text
Provider
Model
Sets
Images Per Set
Total Images
Concurrency
Estimated Cost
Output Folder
```

用户确认后才允许启动。

---

## 88. 最小可交付版本

最小版本只需要：

```text
Generator 页面
Dashboard 页面
Batch Detail 页面
Settings 页面
MockProvider
一个真实 Provider
Dexie 持久化
FileSystemService
BatchEngine
JobScheduler
RetryManager
```

Gallery 可以作为：

```text
MVP 后增强
```

但文件必须已经按规范保存到本地目录。

---

## 89. 架构原则

整个项目必须坚持：

```text
纯前端
浏览器直连 Provider
本地 IndexedDB 持久化
本地文件系统保存图片
无后端
无数据库服务器
无任务服务器
Provider 可替换
Scheduler 控制并发
文件名稳定可恢复
大量数据不全量渲染
API Key 不离开用户浏览器
```

## 最终结论

这个项目**完全可以保持纯前端**，而且你目前的需求下，我认为这是最合适的架构：

**React + TypeScript + Vite + Zustand + Dexie + File System Access API + 第三方 Image API。**

唯一需要提前验证的就是**目标图片 API 是否允许浏览器 CORS 直连**。如果允许，你整个项目甚至可以直接部署成一个静态网站，打开 Chrome 就能用，**不需要你维护任何服务器**。

而你的 **13 张 = 1 个 Set** 只属于业务层的任务分组，完全不需要后端数据库。IndexedDB 足够保存任务状态，图片本身直接落到你选择的本地文件夹。
