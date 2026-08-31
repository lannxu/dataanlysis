# Cloudflare 3.0 部署与迁移

## 1. 保留原系统

迁移前提交为 `47ee72b`，在 GitHub 的 `main` 分支。Cloudflare 代码在 `codex/cloudflare-3.0`。

不要删除 VPS 的 `data/`。先备份 `data/session.json`（包含员工隐私和密码哈希，不要上传 GitHub），暂停原网站的名单和投票写入后再获取最终备份。旧服务与 Cloudflare 的数据不自动互相同步。

## 2. 创建新环境

1. 安装依赖，执行 `pnpm check:cloudflare`。
2. `pnpm exec wrangler login` 登录自己的 Cloudflare 账户。
3. `pnpm exec wrangler r2 bucket create talent-review-photos` 创建照片桶。
4. `pnpm deploy` 创建 Worker 与 SQLite-backed Durable Object。
5. 先用测试域名验证，不立即替换正式域名。

`wrangler.jsonc` 的 Durable Object migration tag 和对象名称是持久化数据标识，后续不要删除或随意更名。R2 桶名称更改需同步配置。当前未配置任何正式域名，部署不会接管原 VPS 域名。

## 3. 一次性导入旧数据

仅在全新空环境导入，**导入前不要创建管理员账号**。导入保留原账号密码、讨论区 ID、员工字段和两个模式各自的记录；用户需重新登录。内嵌照片转存 R2。

1. 生成至少 32 字节的随机迁移口令，不要使用账号密码。
2. `pnpm exec wrangler secret put MIGRATION_TOKEN` 按提示输入口令。
3. 临时把 `wrangler.jsonc` 中 `ALLOW_MIGRATION` 改为 `"true"`，执行 `pnpm deploy`。
4. 在本机终端将环境变量 `MIGRATION_TOKEN` 设置为同一口令，然后执行：

```sh
node scripts/migrate-cloudflare.mjs https://测试域名 data/session.json
```

5. 返回 `ok: true` 与讨论区、账号数量后，确认原账号可登录、名单与结果完整。
6. 把 `ALLOW_MIGRATION` 改回 `"false"` 并部署；执行 `pnpm exec wrangler secret delete MIGRATION_TOKEN`，清除本机临时口令变量。

迁移接口默认关闭、需要私密口令，并拒绝覆盖已有账号或名单的环境。备份上限 30 MB，单张照片上限约 9 MB；超过时不要截断文件，请先制定分批迁移方案。失败时业务状态不提交，可能已有少量无引用的 R2 照片，不影响重试。

## 4. 域名与二维码

在 Worker 的 Settings / Domains & Routes 中添加 Custom Domain。把正式域名从 VPS 切换到 Worker，DNS 冲突按控制台提示处理。

二维码默认使用当前域名，切换后请刷新页面、重新发送二维码或链接。旧 IP 二维码不会自动变成域名。可选变量 `CLOUDFLARE_PUBLIC_URL=https://你的域名` 用于强制二维码统一域名。无需 `PORT`、Nginx 或 `PUBLIC_URL`。

## 5. 上线检查

- `/healthz` 返回版本 `3.0.0` 和平台 `cloudflare`。
- 未登录访问主持后台跳转登录；普通账号看不到他人讨论区。
- 主持后台切换员工，手机同步；初评单人切换只影响初评跟随页。
- 现场票与初评票不串联；评委姓名、Box 比例正常。
- Excel 导入预览字段和照片并保存；两个汇总 CSV 均有 Final Box / Final PL / Final POT。
- 关闭初评或锁定讨论区后不能继续修改数据。
- 重新部署后，账号、名单、照片、评估数据仍在。

本地模拟通过不等于线上验证。账户权限、域名、配额及手机实际网络需在真实部署后确认。

## 本地完整测试

只能使用隔离测试目录，不要指向业务数据：

```sh
pnpm exec wrangler dev --port 8788 --persist-to .wrangler/test-state
# 另一个终端设置 CF_TEST_URL=http://127.0.0.1:8788
node --test tests/cloudflare-runtime.test.mjs
```

## 数据与运行限制

- 每次成功写入持久化后再广播，WebSocket 使用休眠接口。
- 当前单个协调实例串行处理请求，不能宣称无限并发。大名单和大量同时投票需要压测。
- 更换名单不删除历史 R2 图片对象；隐私删除需同时清理无引用对象。
- 公开评估链接免登录；知道链接的人可查看名单，个人初评按评委姓名/标识查询，不等同于强身份认证。请仅向评委发送链接。
- 回退 VPS 使用旧代码与备份；Cloudflare 新增数据不会自动回写 VPS。

官方参考：[Static Assets](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)、[WebSocket](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)、[Storage](https://developers.cloudflare.com/durable-objects/api/storage-api/)。
