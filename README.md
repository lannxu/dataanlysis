# Talent Review Tool 3.0 - 人才盘点 / 九宫格评估系统

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