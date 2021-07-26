## 配置 .env 文件
配置机器人推送 URL
```
PROD_BOOT_URL=xxx
DEV_BOOT_URL=xxx
```

修改 shebang 为自己的 Node.js 可执行文件
`#!/root/.nvm/versions/node/v14.17.3/bin/node`

添加可执行权限
`chmod +x index.js`

## 运行
`./index --mode [dev|prod]`

- --mode dev: 使用 DEV_BOOT_URL 进行推送
- --mode prod: 使用 PROD_BOOT_URL 进行推送