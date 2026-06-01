# AI 测试平台 - QA Platform

一个基于大语言模型的智能测试辅助平台，支持测试用例生成、代码分析、需求文档处理等功能。

## 🏗️ 项目架构

```
qa-platform/
├── services/
│   ├── agent/          # Python LangChain Agent 服务 (端口 8000)
│   │   ├── main.py              # FastAPI 应用入口
│   │   ├── agent_service.py     # LangChain Agent 逻辑
│   │   ├── intent_detector.py   # 意图检测模块 (Max-Similarity)
│   │   ├── document_processor.py # 文档智能切分
│   │   ├── tools/               # 工具集
│   │   │   ├── code_analyzer.py       # 代码分析工具
│   │   │   ├── test_case_generator.py # 测试用例生成
│   │   │   └── bug_hunter.py          # 缺陷预测工具
│   │   ├── config.py            # 配置管理
│   │   ├── requirements.txt     # Python 依赖
│   │   └── .env                 # 环境变量
│   │
│   ├── backend/        # Go 后端服务 (端口 8081)
│   │   ├── main.go          # Gin 框架应用
│   │   ├── go.mod           # Go 依赖
│   │   └── .env             # 环境变量配置
│   │
│   └── frontend/       # Next.js 前端 (端口 3000)
│       ├── app/
│       │   ├── api/chat/route.ts   # 聊天 API 路由
│       │   ├── layout.tsx          # 布局组件
│       │   └── page.tsx            # 主页面
│       ├── components/
│       │   ├── ui/                 # shadcn/ui 组件库
│       │   ├── ai-elements/        # AI 聊天组件
│       │   ├── chat-input.tsx      # 聊天输入框
│       │   ├── chat-messages.tsx   # 消息列表
│       │   └── chat-sidebar.tsx    # 会话侧边栏
│       ├── lib/utils.ts            # 工具函数
│       ├── hooks/                  # 自定义 hooks
│       └── package.json            # 依赖配置
│
├── docker-compose.yml   # Docker 编排配置
├── Dockerfile.agent     # Agent 服务镜像
├── Dockerfile.backend   # Backend 服务镜像
├── Dockerfile.frontend  # Frontend 服务镜像
├── .env                 # Docker 环境变量
├── start.sh             # 一键启动脚本（带端口检测）
└── stop.sh              # 停止脚本
```

## 🔧 核心功能

| 功能模块 | 说明 | 状态 |
|---------|------|------|
| **意图检测** | 基于 Max-Similarity 策略，支持中文模型 (bge-base-zh-v1.5) | ✅ |
| **会话记忆** | 使用 LangChain ConversationBufferMemory | ✅ |
| **文档处理** | 支持语义切分、递归切分、主题识别 | ✅ |
| **代码分析工具** | 分析 Git Commit 变更，生成测试建议 | ✅ |
| **测试用例生成** | 输入需求文本，输出结构化 JSON | ✅ |
| **缺陷预测工具** | 分析历史缺陷，预测高风险模块 | ✅ |
| **多轮对话** | 支持上下文保持，解决"失忆症" | ✅ |

## 🚀 快速开始

### 方式一：Docker 一键启动（推荐）

```bash
# 1. 配置环境变量
cp .env .env.local
# 编辑 .env.local，填入你的 OpenAI API Key

# 2. 启动所有服务
docker-compose up -d

# 3. 查看服务状态
docker-compose ps
```

服务地址：
- 前端界面: http://localhost:3000
- Go 后端: http://localhost:8081
- Agent 服务: http://localhost:8000

### 方式二：本地启动（开发模式）

#### 1. 启动 Python Agent 服务

```bash
cd services/agent

# 激活虚拟环境
source ~/ai_env/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量（已有 .env 文件）
# 编辑 .env 文件，填入你的 API Key

# 启动服务
python main.py
```

#### 2. 启动 Go 后端服务

```bash
cd services/backend

# 下载依赖
go mod tidy

# 配置环境变量（已有 .env 文件）
# 编辑 .env 文件，配置端口等参数

# 启动服务
go run main.go
```

#### 3. 启动前端服务

```bash
cd services/frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 方式三：一键脚本启动

```bash
chmod +x start.sh stop.sh
./start.sh
```

**脚本特性**：
- ✅ 启动前自动检测端口占用（8000/8081/3000）
- ✅ 端口被占用时显示友好错误提示
- ✅ 自动安装依赖
- ✅ 后台运行，日志输出到 /tmp

## ⚙️ 配置说明

### Agent 服务配置 (`services/agent/.env`)

```env
# LLM 配置
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1
MODEL_NAME=gpt-3.5-turbo

# 嵌入模型配置
EMBEDDING_MODEL=bge-base-zh-v1.5
```

**支持的模型：**
- OpenAI: `gpt-3.5-turbo`, `gpt-4`
- DeepSeek: 需配置 `OPENAI_API_BASE`
- Ollama 本地模型: `OPENAI_API_BASE=http://localhost:11434/v1`

### Go 后端配置 (`services/backend/.env`)

```env
PORT=8081
AGENT_SERVICE_URL=http://127.0.0.1:8000
AUTH_TOKEN=
LOG_LEVEL=info

# 数据库配置（预留）
DB_HOST=localhost
DB_PORT=5432
DB_NAME=qa_platform
DB_USER=postgres
DB_PASSWORD=
```

### Docker 配置 (`.env`)

```env
# LLM Configuration
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1
MODEL_NAME=gpt-3.5-turbo

# Auth Configuration
AUTH_TOKEN=

# Port Configuration
AGENT_PORT=8000
BACKEND_PORT=8081
FRONTEND_PORT=3000
```

## 📡 API 接口

### Go 后端接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/chat` | POST | 普通对话（同步） |
| `/api/chat/stream` | POST | 流式对话（SSE） |
| `/api/history/{session_id}` | GET | 获取会话历史 |
| `/api/history/{session_id}` | DELETE | 清除会话历史 |
| `/api/export` | POST | 导出对话记录 |

**请求示例：**

```bash
curl -X POST http://localhost:8081/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "为用户登录功能生成测试用例", "session_id": "test-session"}'
```

### Agent 服务接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/config` | GET | 获取配置信息 |
| `/intent` | POST | 意图检测 |
| `/chat` | POST | 普通对话 |
| `/chat/stream` | POST | 流式对话 |
| `/history/{session_id}` | GET | 获取历史 |
| `/document/process` | POST | 智能文档处理 |
| `/document/upload` | POST | 文档上传 |

### 意图检测接口

```bash
curl -X POST http://localhost:8000/intent \
  -H "Content-Type: application/json" \
  -d '{"message": "帮我写测试用例"}'
```

响应示例：
```json
{
  "intent": "TEST_CASE",
  "description": "测试用例生成",
  "detection_method": "Max-Similarity",
  "confidence": 0.85
}
```

### 文档处理接口

```bash
curl -X POST http://localhost:8000/document/process \
  -H "Content-Type: application/json" \
  -d '{
    "content": "用户登录模块...\n\n商品管理模块...",
    "strategy": "semantic",
    "target_chunks": 3
  }'
```

## 🧪 联调验证

1. 打开浏览器访问 http://localhost:3000
2. 在对话框输入测试需求，例如：
   - "为用户登录功能生成测试用例"
   - "分析 commit abc123 的代码变更"
   - "基于刚才的需求，写个自动化脚本"
3. 观察前端是否流畅展示 AI 回复
4. 测试多轮对话上下文保持能力

## 🛠️ 工具集说明

### CodeAnalyzerTool
- **功能**：分析 Git Commit 代码变更
- **输入**：commit_id, repo_path(可选)
- **输出**：代码变更分析报告 + 测试建议

### TestCaseGeneratorTool
- **功能**：生成结构化测试用例
- **输入**：requirement(需求文本), test_type(测试类型)
- **输出**：JSON 格式测试用例

### BugHunterTool
- **功能**：预测高风险模块
- **输入**：defect_logs(缺陷日志), current_changes(本次变更)
- **输出**：风险评估报告

## 🔐 安全说明

- ⚠️ **API Key 仅保存在 Python Agent 服务的 `.env` 文件中**
- ⚠️ **绝对不要将 API Key 暴露给前端或 Go 业务层**
- ⚠️ **`.env` 文件已添加到 `.gitignore`，不会被提交到代码库**
- ⚠️ 支持配置 AUTH_TOKEN 进行 API 访问控制

## 📦 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js + shadcn/ui | 现代化全栈框架，支持 SSR |
| 后端 | Go + Gin | 高性能 API 网关 |
| Agent | Python + FastAPI + LangChain | AI 智能体服务 |
| 嵌入模型 | bge-base-zh-v1.5 | 中文语义理解 |
| 大模型 | OpenAI / DeepSeek / Ollama | 可切换多种模型 |
| 容器 | Docker + Docker Compose | 一键部署 |

## 📊 意图类型

| 意图 | 说明 | 示例 |
|------|------|------|
| TEST_CASE | 测试用例生成 | "生成登录功能测试用例" |
| TEST_PLAN | 测试计划制定 | "制定测试计划" |
| CODE_ANALYSIS | 代码分析 | "分析代码变更" |
| RAG_QA | 知识库问答 | "查询知识库" |
| RUN_TESTS | 测试执行 | "运行测试" |
| DEFAULT | 默认回答 | 其他输入 |

## 🎯 下一步计划

- [ ] 添加用户认证和权限管理
- [ ] 实现测试用例的持久化存储
- [ ] 添加测试用例模板管理
- [ ] 集成测试执行引擎
- [ ] 添加测试报告生成功能
- [ ] 支持更多 Agent 工具
- [ ] 前端专业化升级（侧边栏、表格渲染、导出功能）

## 📝 License

MIT