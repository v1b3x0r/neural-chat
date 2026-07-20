# Deploy — Living Memory Engine on Alibaba Cloud

**Live:** https://cm.viibe.to (also http://47.79.255.217) — Alibaba Cloud Simple Application Server.

## Architecture
```
visitor ──HTTPS──▶ Cloudflare (edge TLS, valid cert) ──HTTPS(Full)──▶ nginx :443/:80 (Alibaba server)
                                                                        └─▶ node server.mjs :3000 (systemd)
                                                                              ├─ serves web/dist (static build)
                                                                              └─ /api/qwen/v1/* → Qwen Cloud (key from server env)
```
- Host: Alibaba Cloud Simple Application Server, Ubuntu 24.04, 1 GB RAM, IP `47.79.255.217`. SAS firewall opens 80/443 by default.
- DNS: `cm.viibe.to` is a Cloudflare-proxied record → the Alibaba origin. Cloudflare SSL mode = **Full** (accepts the origin's self-signed cert).
- App: `web/server.mjs` (zero-dependency Node) under systemd unit `memory-engine`, listening on `127.0.0.1:3000`.
- Reverse proxy: nginx site `memory-engine` (`/etc/nginx/sites-available/memory-engine`), 80 + 443, `proxy_buffering off` for SSE streaming.
- Origin TLS: self-signed cert at `/etc/nginx/ssl/cm.{crt,key}` (works with Cloudflare Full; for Full-**strict** replace with a Cloudflare Origin Certificate).
- Secret: `QWEN_API_KEY` lives only in `/etc/memory-engine.env` (mode 600) on the server, loaded by systemd. Never in the repo or the client bundle.

## Re-deploy after a code change
```bash
# on the Mac, from the repo:
cd web && npm run build
tar czf /tmp/memeng-deploy.tgz dist server.mjs
scp /tmp/memeng-deploy.tgz root@47.79.255.217:/tmp/
ssh root@47.79.255.217 'tar xzf /tmp/memeng-deploy.tgz -C /opt/memory-engine && rm -f /opt/memory-engine/._* && systemctl restart memory-engine && sleep 1 && systemctl is-active memory-engine'
# verify: curl -s -o /dev/null -w "%{http_code}\n" http://47.79.255.217/
```

## Ops
- Logs: `ssh root@47.79.255.217 'journalctl -u memory-engine -n 50 --no-pager'`
- Restart: `systemctl restart memory-engine` · Status: `systemctl status memory-engine`
- Rotate the Qwen key: edit `/etc/memory-engine.env`, `systemctl restart memory-engine`.
- Optional polish (founder, in Cloudflare dashboard): turn on "Always Use HTTPS" so bare `http://cm.viibe.to` redirects to HTTPS at the edge.
