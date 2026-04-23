# OpenBao Web UI

适用于 [OpenBao](https://openbao.org)（HashiCorp Vault 的开源分支）的现代化自托管管理界面。基于 Next.js 16 App Router、Tailwind CSS 4 和 shadcn/ui 构建。

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)

---

## 功能特性

### 已实现功能

#### 认证与连接
- 基于 Token 的登录，连接前自动检查服务器健康状态
- 最近使用的服务器地址快捷芯片，方便快速重连
- 顶部栏显示 Token TTL 与 Accessor
- 自动登出保护——Token 失效时跳转至登录页
- 直接 CORS 请求优先，跨域场景自动回退至 Next.js 透明代理

#### 仪表盘
- 集群健康状态横幅（已封存 / 待机 / 活跃）
- 统计卡片：挂载总数、认证方法数、策略数、活跃租约数
- Token 信息面板（Accessor、策略列表、TTL、创建时间）
- 版本历史时间线

#### KV v2 密钥浏览器（`/secrets`）
- 双栏目录/文件树，无页面刷新地浏览嵌套路径
- 读取、写入、软删除密钥版本
- 恢复（undelete）和永久销毁（destroy）指定版本
- 版本历史标签页
- 元数据标签页：最大版本数、CAS 要求、自定义元数据编辑
- 创建密钥对话框，支持键值对表格编辑

#### 策略（`/policies`）
- **ACL 策略** — 列表、查看、创建、编辑、删除，内置 HCL 实时编辑器（CodeMirror 6）
- **密码策略** — 列表、查看、创建、编辑、删除，支持生成示例密码
- 系统策略（`root`、`default`）展示为只读
- 空列表优雅处理（OpenBao 在空 LIST 时返回 404）

#### 应用程序（`/apps`）
- 应用注册表，元数据存储于 KV v2 路径 `secret/vault-ui/apps/{name}`
- 列表支持环境筛选（dev / staging / prod）
- **7 步创建向导：**
  1. 基本信息 — 应用名称、项目名称、分类（预设芯片 + 自定义）、环境
  2. 初始密钥 — 可选的 KV 键值对
  3. 策略 — 自动生成的 HCL 模板，可完整编辑
  4. AppRole 配置 — TTL、使用次数、绑定 Secret ID、CIDR 限制
  5. 确认 — 执行前的完整摘要
  6. 执行 — 逐步实时状态（策略 → 密钥 → AppRole → Role ID → Secret ID → 元数据）
  7. 成功 — Role ID（可复制）和一次性 Secret ID（仅显示一次，可复制）
- KV 路径格式：`app/{项目}/{分类}/{应用}/{环境}`
- 应用详情页标签：概览、密钥（链接至浏览器）、策略（可编辑）、凭证（Role ID、生成 Secret ID、列表/销毁 Accessor）
- 删除应用：自动清理策略和 AppRole，保留 KV 密钥

#### 密钥引擎（`/engines`）
- 列出所有已挂载引擎，展示类型、路径、描述、Accessor、选项
- 通过对话框启用新引擎（类型、路径、描述、版本）
- 通过对话框调整挂载参数（TTL、最大 TTL、描述）
- 带确认弹窗的禁用操作
- **引擎详情页：**
  - **PKI** — CA 证书信息、生成/设置 CA、角色 CRUD、签发证书、已吊销证书列表
  - **Transit** — 密钥列表、创建密钥（类型、可导出、允许明文备份）、轮换密钥、加密/解密数据
  - **TOTP** — 密钥列表、创建密钥（发行方、账户、周期、位数、算法、二维码）、生成验证码（带 30 秒倒计时）、验证码校验
  - **通用** — 适用于其他引擎类型的原始 API 探索器

#### 认证方法（`/auth`）
- 列出所有已启用的认证方法，展示类型、路径、Accessor、描述
- 通过对话框启用新认证方法（类型、路径、描述）
- 带确认弹窗的禁用操作
- **认证方法详情页：**
  - **AppRole** — 角色列表 + 详情面板，包含配置、Role ID、生成/列表/销毁 Secret ID、整理过期 Accessor
  - **Token** — Accessor 列表、按 Accessor 查找 Token、撤销 Token、整理
  - **JWT / OIDC** — 配置编辑（JWKS URL、OIDC Discovery、Bound Issuer）、角色 CRUD、生成 OIDC 测试 URL
  - **通用** — 其他类型的原始 API 探索器

#### 身份管理（`/identity`）
- **实体（Entities）** — 表格展示，批量获取详情，创建/编辑/删除对话框，展示关联别名
- **组（Groups）** — 列表显示成员数量，创建/编辑/删除，区分内部组和外部组
- **别名（Aliases）** — 实体别名列表，创建别名（挂载 Accessor + 别名名称）
- **OIDC 提供商** — 密钥、角色、提供商、客户端、范围、Well-known 端点标签页
- **MFA** — 方法标签页（TOTP、Duo、Okta、PingID）和登录强制标签页

#### 租约管理（`/leases`）
- 双栏前缀树，可逐级钻取租约命名空间
- 租约详情：ID、签发/到期时间、TTL、是否可续期
- 按租约或前缀进行续期、撤销、强制撤销和整理

#### 系统（`/system`）
- **状态** — 封存状态、解封进度、HA 集群信息（主节点地址、待机节点列表）
- 封存和解封 Vault（输入密钥分片）
- **审计** — 列出设备，启用（文件/syslog/socket），禁用
- **CORS** — 开关启用状态，设置允许的源和请求头（页面加载时正确从 API 初始化状态）
- **工具** — 哈希计算（SHA-2/SHA-3 系列，十六进制/Base64 输出）、随机字节生成器

#### 命名空间（`/namespaces`）
- 列出命名空间、创建、锁定/解锁、带确认弹窗的删除

---

### 未实现功能

以下路由已存在，但仅渲染部分内容或占位内容：

| 模块 | 缺失内容 |
|---|---|
| 系统 | 配额、插件、日志记录、请求头、包装、密钥轮换、重新生成密钥、锁定用户 等标签页 |
| 身份 / OIDC | 密钥、角色、提供商、客户端、范围的完整 CRUD 操作 |
| 身份 / MFA | TOTP/Duo/Okta/PingID 方法和登录强制规则的完整 CRUD 操作 |
| 命名空间 | 嵌套命名空间树（子命名空间）、命名空间范围内的导航 |
| 密钥浏览器 | KV v1 引擎支持（当前仅支持 KV v2）|
| 认证 / AppRole | 角色配置中的绑定 CIDR 列表编辑器 |

---

### 规划中（P3）

| 功能 | 说明 |
|---|---|
| 深色模式 | CSS 变量主题切换，持久化至 localStorage |
| 命令面板 | `Cmd+K` 快速导航所有路由和实体 |
| 国际化 | 通过 `next-intl` 实现 i18n，首期支持英语和中文 |
| Token 自动续期 | 在 TTL 到期前自动续期，阈值可配置 |
| 审计日志流 | 实时审计日志尾追（需要支持 WebSocket 的代理）|
| 多集群支持 | 无需登出即可切换多个 OpenBao 实例 |

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 框架 | Next.js 16.2（App Router，TypeScript 严格模式）|
| 样式 | Tailwind CSS 4，shadcn/ui（Radix UI 原语）|
| 状态管理 | Zustand v5 — 连接状态持久化至 `localStorage` |
| 数据请求 | TanStack Query v5 — 所有 API 调用通过 `useQuery` / `useMutation` |
| 表单 | React Hook Form + Zod 校验 |
| 编辑器 | CodeMirror 6，自定义 HCL StreamLanguage 和策略关键字补全 |
| 构建 | `output: 'standalone'`，支持 Docker 部署 |

---

## 快速开始

### 环境要求

- Node.js 20+
- 一个可从浏览器或 Next.js 服务器访问的 OpenBao（或 Vault 兼容）实例

### 开发模式

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)，输入 OpenBao 服务器地址和有效 Token。

### 生产构建

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t vault-ui .
docker run -p 3000:3000 vault-ui
```

Standalone 构建仅包含运行所需文件，运行时无需 `node_modules`。

---

## 配置

无需配置环境变量。服务器地址和 Token 在登录时输入，持久化至 `localStorage` 的 `vault-ui:connection` 键。最近使用的地址单独存储于 `vault-ui:recent-addrs`。

### CORS 配置

若浏览器无法直接访问 OpenBao 实例（跨域场景），UI 会自动通过内置的 Next.js 代理 `/api/proxy/[...path]` 转发请求，无需额外配置，代理会透明地转发 `X-Vault-Token` 请求头和请求体。

如需允许浏览器直接连接，请将 UI 源添加至 OpenBao 的 CORS 配置：

```bash
bao write sys/config/cors \
  enabled=true \
  allowed_origins="http://localhost:3000"
```

---

## 项目结构

```
src/
├── app/
│   ├── (shell)/           # 已认证的 Shell 布局（侧边栏 + 顶部栏）
│   │   ├── apps/          # 应用注册表 + 创建向导
│   │   ├── auth/          # 认证方法列表 + 详情
│   │   ├── dashboard/     # 集群概览
│   │   ├── engines/       # 密钥引擎列表 + 详情
│   │   ├── identity/      # 实体、组、别名、OIDC、MFA
│   │   ├── leases/        # 租约浏览器
│   │   ├── namespaces/    # 命名空间管理
│   │   ├── policies/      # ACL + 密码策略
│   │   ├── secrets/       # KV v2 浏览器
│   │   └── system/        # 系统管理
│   ├── api/proxy/         # Edge Runtime 透明代理
│   └── login/             # 登录页
├── components/
│   ├── hcl-editor/        # CodeMirror 6 HCL 编辑器 + 补全
│   ├── layout/            # 侧边栏、顶部栏、面包屑
│   └── ui/                # shadcn/ui 组件
├── hooks/                 # 按领域划分的 TanStack Query Hooks
├── lib/
│   ├── store.ts           # Zustand 连接状态存储
│   ├── utils.ts           # cn、relativeTime、formatTTL、slugify
│   └── vault/
│       ├── api/           # 按领域划分的 OpenBao API 封装
│       ├── client.ts      # vaultFetch — 直连 + 代理回退
│       └── errors.ts      # VaultError 类
└── types/                 # TypeScript 领域类型定义
```

---

## API 兼容性

基于 OpenBao REST API 构建。所有 LIST 操作以 `GET ?list=true` 形式发送（OpenBao 规范）。任何 LIST 端点返回 404 均视为空结果而非错误，与 OpenBao 在路径无数据时返回 404 的行为一致。

已在 OpenBao v2.x 上测试。对 HashiCorp Vault 1.13+ 应大体兼容，企业版专属端点可能存在差异。
