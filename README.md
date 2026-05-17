# AI Data Board

AI Data 部门 看板应用。

## 前置要求

- Node.js >= 18
- pnpm >= 8

## 启动

```bash
# 安装依赖
pnpm install

# 配置环境变量（需 Supabase Postgres 连接串 + 匿名 key）
cp .env.example .env   # 然后编辑 .env

# 同时启动前后端
pnpm dev
```

前端 `http://localhost:5173`，后端 `http://localhost:8787`。
