# 人才盘点实时投票工具

## 本地运行

运行 `pnpm start`，打开 `http://localhost:3000/admin.html`。二维码会自动使用当前局域网地址。

## 远程服务器部署

推荐使用 Docker：

```bash
docker compose up -d --build
```

部署后通过 `https://你的域名/admin.html` 打开后台。二维码会根据访问后台时的域名、协议和端口自动生成，并指向同一服务器的手机评估页。

如果反向代理没有正确传递域名，设置环境变量强制指定公开地址：

```bash
PUBLIC_URL=https://talent.example.com docker compose up -d --build
```

反向代理需要保留 `Host`、`X-Forwarded-Host`、`X-Forwarded-Proto`，并允许 WebSocket 的 `Upgrade` 和 `Connection` 请求头。生产环境建议启用 HTTPS。

健康检查地址：`/healthz`。现场数据保存在 `data/session.json`，Docker 部署时已映射为持久化目录。