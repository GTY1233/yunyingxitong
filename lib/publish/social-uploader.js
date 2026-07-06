// 经 social-auto-upload(github.com/dreammis/social-auto-upload)把视频发到矩阵号。
// 官方 API 已死,这是浏览器自动化的现实方案:用户先 `sau <platform> login --account <名>` 扫码存 cookie,
// 之后本命令行 `sau <platform> upload-video --account <名> --file <视频> --title .. --desc ..` 自动发。
// 灰色地带(违反平台条款、有风控):只对矩阵小号用;主号/绑店号建议手动。详见 docs/14。
const { spawn } = require("node:child_process");
const fs = require("node:fs");

// 我们的平台名 → social-auto-upload 内部标识。
const PLATFORM_MAP = {
  抖音: "douyin",
  小红书: "xiaohongshu",
  快手: "kuaishou",
  视频号: "tencent",
  B站: "bilibili",
  哔哩哔哩: "bilibili",
};

function mapPlatform(platform) {
  return PLATFORM_MAP[String(platform || "").trim()] || "";
}

// 配置:SAU_ENABLED=1 开启真发;SAU_CLI 命令(默认 sau,也可写 "python cli_main.py");SAU_CWD cookie/工作目录。
function config() {
  return {
    enabled: process.env.SAU_ENABLED === "1",
    cli: String(process.env.SAU_CLI || "sau").trim(),
    cwd: String(process.env.SAU_CWD || "").trim() || undefined,
    timeoutMs: Number(process.env.SAU_TIMEOUT_MS || 300000), // 上传默认 5 分钟超时
  };
}

// 该平台+账号是否具备真发条件(已开启 + 平台可映射 + 账号有 publishHandle/name)。
function canRealPublish(platform, account) {
  const c = config();
  return Boolean(c.enabled && mapPlatform(platform) && (account?.publishHandle || account?.name));
}

// 构造命令参数(纯函数,可离线断言):sau <platform> upload-video --account .. --file .. --title .. --desc ..
function buildArgs(payload, { platform, account }) {
  const sauPlatform = mapPlatform(platform);
  if (!sauPlatform) throw new Error(`social-auto-upload 不支持平台:${platform}`);
  const handle = String(account?.publishHandle || account?.name || "").trim();
  if (!handle) throw new Error("账号缺少发布名(publishHandle),无法定位已登录的 cookie");
  if (!payload?.videoPath) throw new Error("缺少视频文件路径");
  const args = [
    sauPlatform,
    "upload-video",
    "--account",
    handle,
    "--file",
    payload.videoPath,
    "--title",
    payload.title || payload.productName || "",
  ];
  if (payload.desc) args.push("--desc", payload.desc);
  if (Array.isArray(payload.tags) && payload.tags.length) {
    args.push("--tags", payload.tags.join(","));
  }
  return args;
}

// 真发:spawn CLI,收集 stdout/stderr,退出码 0 视为成功。永不假成功。
function runSau(args, { cli, cwd, timeoutMs }) {
  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let child;
    try {
      child = spawn(cli, args, { cwd, shell: process.platform === "win32" });
    } catch (e) {
      resolve({ ok: false, error: `启动 social-auto-upload 失败:${e.message}`, output: "" });
      return;
    }
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({
        ok: false,
        error: `发布超时(${Math.round(timeoutMs / 1000)}s)`,
        output: out + err,
      });
    }, timeoutMs);
    child.stdout?.on("data", (d) => {
      out += d.toString();
    });
    child.stderr?.on("data", (d) => {
      err += d.toString();
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        error: `无法执行 ${cli}:${e.message}(是否已安装 social-auto-upload?)`,
        output: out + err,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ ok: true, output: out.slice(-2000) });
      } else {
        resolve({
          ok: false,
          error: `发布失败(退出码 ${code}):${(err || out).slice(-300)}`,
          output: (out + err).slice(-2000),
        });
      }
    });
  });
}

// 发布一个视频到一个账号。返回 { ok, externalId?, output?, error? }。
async function publish(payload, { platform, account }) {
  const c = config();
  const args = buildArgs(payload, { platform, account }); // 抛=配置问题,由上层转失败
  if (
    payload.videoPath &&
    !/^https?:/i.test(payload.videoPath) &&
    !fs.existsSync(payload.videoPath)
  ) {
    return { ok: false, error: `视频文件不存在:${payload.videoPath}` };
  }
  const r = await runSau(args, c);
  return r.ok ? { ok: true, output: r.output } : r;
}

module.exports = { PLATFORM_MAP, mapPlatform, config, canRealPublish, buildArgs, publish };
