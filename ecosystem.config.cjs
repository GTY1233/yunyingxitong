// PM2 进程管理配置：自动重启、开机自启、崩溃拉起。
// 用法：pm2 start ecosystem.config.cjs  /  pm2 save  /  pm2 startup
module.exports = {
  apps: [
    {
      name: "yunyingxitong",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 4173,
      },
      out_file: "data/pm2-out.log",
      error_file: "data/pm2-error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
