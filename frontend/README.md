# QA Platform Frontend

基于 Next.js 的智能对话平台前端应用。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS 4
- **UI 组件**: Radix UI + shadcn/ui
- **AI SDK**: @ai-sdk/react
- **图标**: lucide-react

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start
```

## 项目结构

```
app/                    # Next.js App Router 页面
├── api/                # API 路由（后端代理）
├── login/              # 登录页面
├── register/           # 注册页面
├── admin/              # 管理后台
├── layout.tsx          # 根布局
└── page.tsx            # 主聊天页面

components/             # UI 组件
├── ui/                 # shadcn/ui 组件
├── ai-elements/        # AI 聊天专用组件
├── chat-input.tsx      # 聊天输入框
├── chat-messages.tsx   # 消息列表
├── chat-sidebar.tsx    # 侧边栏会话列表
└── client-layout.tsx   # 客户端布局

hooks/                  # 自定义 Hooks
├── use-media-query.ts  # 媒体查询
├── use-mobile.ts       # 移动端检测
└── use-toast.ts        # Toast 提示

lib/                    # 工具库
└── utils.ts            # 通用工具函数

public/                 # 静态资源
└── icons/              # 应用图标
```

## 功能特性

- ✅ AI 聊天对话
- ✅ 会话管理（创建、删除、重命名）
- ✅ 联网搜索模式
- ✅ 消息复制/重试/删除
- ✅ 数据导出
- ✅ 响应式设计（移动端/桌面端）
- ✅ 明暗主题切换

## 配置

环境变量：
- `NEXT_PUBLIC_AGENT_URL`: Agent 服务地址
- `NEXT_PUBLIC_BACKEND_URL`: 后端服务地址

## 开发指南

### 添加新页面

在 `app/` 目录下创建新的页面组件：

```tsx
// app/new-page/page.tsx
export default function NewPage() {
  return <div>新页面内容</div>
}
```

### 添加新组件

在 `components/` 目录下创建组件，并在 `lib/utils.ts` 中导出。

### 运行测试

```bash
# ESLint 检查
pnpm lint
```

## 部署

### Docker 部署

```bash
# 构建镜像
docker build -t qa-platform-frontend .

# 运行容器
docker run -p 3000:3000 qa-platform-frontend
```

### Vercel 部署

直接连接 GitHub 仓库，Vercel 会自动构建部署。
