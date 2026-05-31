# AI 测试平台 - MVP 最小可行原型

打通"前端界面 → Go后端 → LangChain(Agent) → 大模型"的最小闭环

## 🏗️ 项目架构

```
qa-platform/
├── services/
│   ├── agent/          # Python LangChain Agent 服务 (端口 8000)
│   │   ├── main.py           # FastAPI 应用入口
│   │   ├── agent_service.py  # LangChain Agent 逻辑
│   │   ├── config.py         # 配置管理
│   │   ├── requirements.txt  # Python 依赖
│   │   └── .env.example      # 环境变量示例
│   │
│   ├── backend/        # Go 后端服务 (端口 8080)
│   │   ├── main.go          # Gin 框架应用
│   │   └── go.mod           # Go 依赖
│   │
│   └── frontend/       # React 前端 (端口 3000)
│       ├── src/
│       │   ├── App.jsx      # 主应用组件
│       │   ├── App.css      # 样式
│       │   └── main.jsx     # 入口
│       ├── index.html
│       ├── vite.config.js
│       └── package.json
│
├── start.sh            # 一键启动脚本
└── stop.sh             # 停止脚本
```

## 🚀 快速开始

### 方式一：一键启动（推荐）

```bash
chmod +x start.sh stop.sh
./start.sh
```

### 方式二：分别启动各服务

#### 1. 启动 Python Agent 服务

```bash
cd services/agent

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 OpenAI API Key

# 启动服务
python main.py
```

服务地址：http://localhost:8000

#### 2. 启动 Go 后端服务

```bash
cd services/backend

# 安装依赖
go mod tidy

# 启动服务
go run main.go
```

服务地址：http://localhost:8080

#### 3. 启动前端服务

```bash
cd services/frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

服务地址：http://localhost:3000

## 🔧 配置说明

### Agent 服务配置

在 `services/agent/.env` 中配置：

```env
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1
MODEL_NAME=gpt-3.5-turbo
```

**支持的模型：**
- OpenAI: `gpt-3.5-turbo`, `gpt-4`
- DeepSeek: 需配置 `OPENAI_API_BASE`
- Ollama 本地模型: 需配置 `OPENAI_API_BASE=http://localhost:11434/v1`

## 📡 API 接口

### Go 后端接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/chat` | POST | 普通对话（同步） |
| `/api/chat/stream` | POST | 流式对话（SSE） |

**请求示例：**

```bash
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "为用户登录功能生成测试用例"}'
```

### Agent 服务接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/chat` | POST | 普通对话 |
| `/chat/stream` | POST | 流式对话 |

## 🧪 联调验证

1. 打开浏览器访问 http://localhost:3000
2. 在对话框输入测试需求，例如：
   - "为用户登录功能生成测试用例"
   - "分析注册流程的测试要点"
3. 观察前端是否流畅展示 AI 回复

## 🔐 安全说明

- ⚠️ **API Key 仅保存在 Python Agent 服务的 `.env` 文件中**
- ⚠️ **绝对不要将 API Key 暴露给前端或 Go 业务层**
- ⚠️ **`.env` 文件已添加到 `.gitignore`，不会被提交到代码库**

## 📦 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React + Vite | 现代化前端开发体验 |
| 后端 | Go + Gin | 高性能 API 网关 |
| Agent | Python + FastAPI + LangChain | AI 智能体服务 |
| 大模型 | OpenAI / DeepSeek / Ollama | 可切换多种模型 |

## 🎯 下一步计划

- [ ] 添加用户认证和权限管理
- [ ] 实现测试用例的持久化存储
- [ ] 添加测试用例模板管理
- [ ] 集成测试执行引擎
- [ ] 添加测试报告生成功能
- [ ] 支持多轮对话上下文
- [ ] 添加更多 Agent 工具（代码分析、接口测试等）

## 📝 License

MIT
