# Talent Review Tool 3.0 - Cloudflare 版

此分支为 `codex/cloudflare-3.0`。原 VPS 4.0 版保留在 `main`，迁移前提交为 `47ee72b`。版本号 3.0 专指 Cloudflare 版。

## Cloudflare 运行

架构：Workers 托管页面和接口，SQLite-backed Durable Objects 持久化账号及评估并同步 WebSocket，R2 保存照片。无需 VPS、Nginx 或固定监听端口。

需要 Node.js 22 或更新版本、pnpm：

```sh
pnpm install --frozen-lockfile
pnpm start
```

打开 http://127.0.0.1:8787/home.html 。数据保存在 `.wrangler/state/`，与原 `data/session.json` 分开；首次运行为空环境。

```sh
pnpm test
pnpm check:cloudflare
pnpm exec wrangler login
pnpm exec wrangler r2 bucket create talent-review-photos
pnpm deploy
```

部署和旧数据迁移请先阅读 [Cloudflare 部署说明](deploy/CLOUDFLARE.md)。需要启用 Workers、Durable Objects、R2；建议使用 Workers Paid，以支持密码计算与 Excel 导入的 CPU 开销，费用及配额以账户为准。

二维码默认使用当前访问域名，不读取旧 VPS 的 `PUBLIC_URL`。可选 `CLOUDFLARE_PUBLIC_URL` 用于强制统一域名。

当前通过一个持久化协调实例在应用层隔离账号数据，适合现有 Panel 规模；大规模并发需额外压测和分片。原两套评估场景仍然独立。

下面是保留的 **VPS 运行说明**，不是 Cloudflare 部署步骤。也可执行 `pnpm start:vps` 运行原 Node 后端。

## 本地运行

```powershell
$env:PORT="3100"
$env:PUBLIC_URL="http://192.168.31.227:3100"
node server.mjs
```

讨论区首页：`http://localhost:3100/home.html`

## Docker 部署

```bash
cp .env.example .env
# 编辑 .env，将 PUBLIC_URL 改为正式域名
docker compose up -d --build
```

生产环境中，应用通过 VPS 本机 `127.0.0.1:3001` 提供给 Nginx，域名流量由 Nginx 转发到该端口。Docker Compose 已将端口限制绑定到 `127.0.0.1:3001`，不会直接暴露到公网。现场数据保存在 `data/session.json`，Docker 已将该目录设置为持久化目录。

## Nginx 反向代理与域名

项目支持 Nginx 反向代理、HTTPS 域名和 WebSocket 实时同步。

1. 将 `deploy/nginx-talent-review.conf.example` 复制到 Nginx 配置目录。
2. 把配置中的 `talent.example.com` 替换为正式域名。
3. 如果应用端口不是 `3001`，修改 `upstream talent_review_app` 中的端口。
4. 检查并重载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

5. 使用 Certbot 或公司证书为域名启用 HTTPS，并在 `.env` 中设置：

```dotenv
PUBLIC_URL=https://你的域名
```

Nginx 必须转发 `Host`、`X-Forwarded-Host`、`X-Forwarded-Proto`，并保留 WebSocket 的 `Upgrade` 和 `Connection` 请求头。示例配置已包含这些设置。

## 验证

```text
https://你的域名/healthz
https://你的域名/home.html
```

`/healthz` 应返回 `{"ok":true,...}`。主持后台切换员工时，手机页面应实时同步。
