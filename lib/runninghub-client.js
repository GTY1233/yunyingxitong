const fs = require("fs");
const path = require("path");

const DEBUG_LOG_PATH = path.join(__dirname, "..", "data", "runninghub-debug-log.jsonl");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasRunningHubApi() {
  return Boolean(process.env.RUNNINGHUB_API_KEY);
}

function runningHubBaseUrl() {
  return String(process.env.RUNNINGHUB_BASE_URL || "https://www.runninghub.cn").replace(/\/$/, "");
}

function runningHubHeaders(extra = {}) {
  if (!process.env.RUNNINGHUB_API_KEY) {
    throw new Error("缺少 RUNNINGHUB_API_KEY，无法调用 RunningHub。");
  }
  return {
    Authorization: `Bearer ${process.env.RUNNINGHUB_API_KEY}`,
    ...extra,
  };
}

function isPublicUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function appendRunningHubDebugLog(entry) {
  try {
    const dir = path.dirname(DEBUG_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      DEBUG_LOG_PATH,
      `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`,
      "utf8"
    );
  } catch (error) {
    console.error("RunningHub debug log write failed:", error.message);
  }
}

function readRunningHubDebugLogs(limit = 50) {
  if (!fs.existsSync(DEBUG_LOG_PATH)) return [];
  const rows = fs
    .readFileSync(DEBUG_LOG_PATH, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-Math.max(1, Math.min(Number(limit) || 50, 500)));
  return rows.map((line) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      return { ts: "", type: "parse_error", raw: line };
    }
  });
}

function isDataUri(value) {
  return /^data:[^;]+;base64,/i.test(String(value || ""));
}

function mimeFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
  };
  return map[ext] || "application/octet-stream";
}

function mediaValueFromUpload(payload) {
  const data = payload?.data || payload || {};
  const preferred = String(process.env.RUNNINGHUB_UPLOAD_VALUE_FIELD || "fileName").trim();
  return data[preferred] || data.download_url || data.fileName || data.url || data.name || "";
}

function resolveLocalMediaPath(value, context = {}) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (path.isAbsolute(text) && fs.existsSync(text)) return text;

  const matched = (context.productImages || []).find(
    (item) => item.url === text || item.id === text
  );
  if (matched?.url && matched.url !== text) return resolveLocalMediaPath(matched.url, context);

  if (text.startsWith("/generated/")) {
    const rel = text.replace(/^\/generated\//, "");
    const filePath = path.join(
      context.rootDir || path.join(__dirname, ".."),
      "data",
      "generated",
      rel
    );
    if (fs.existsSync(filePath)) return filePath;
  }
  return "";
}

async function uploadRunningHubMedia(input, context = {}) {
  const value = String(input || "").trim();
  if (!value) throw new Error("缺少要上传到 RunningHub 的素材文件。");

  let buffer;
  let fileName = "media.bin";
  let mimeType = "application/octet-stream";

  if (isDataUri(value)) {
    const match = value.match(/^data:([^;]+);base64,(.*)$/i);
    mimeType = match?.[1] || mimeType;
    const ext = mimeType.split("/")[1] || "bin";
    fileName = `upload.${ext === "jpeg" ? "jpg" : ext}`;
    buffer = Buffer.from(match?.[2] || "", "base64");
  } else {
    const filePath = resolveLocalMediaPath(value, context);
    if (filePath) {
      fileName = path.basename(filePath);
      mimeType = mimeFromFile(filePath);
      buffer = fs.readFileSync(filePath);
    } else if (isPublicUrl(value)) {
      const resp = await fetch(value);
      if (!resp.ok) throw new Error(`无法下载素材：${value}（${resp.status}）`);
      const contentType = resp.headers.get("content-type") || mimeType;
      const ext = contentType.split("/")[1] || "bin";
      fileName = `upload.${ext === "jpeg" ? "jpg" : ext}`;
      mimeType = contentType;
      buffer = Buffer.from(await resp.arrayBuffer());
    } else {
      return value;
    }
  }

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), fileName);

  const response = await fetch(`${runningHubBaseUrl()}/openapi/v2/media/upload/binary`, {
    method: "POST",
    headers: runningHubHeaders(),
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`RunningHub 素材上传失败：${response.status} ${detail.slice(0, 120)}`);
  }

  const payload = await response.json();
  if (payload.code !== undefined && Number(payload.code) !== 0) {
    throw new Error(payload.message || "RunningHub 素材上传失败");
  }

  const mediaValue = mediaValueFromUpload(payload);
  if (!mediaValue) throw new Error("RunningHub 素材上传未返回可用文件地址。");
  return mediaValue;
}

async function resolveRunningHubMediaValue(input, context = {}) {
  const value = String(input || "").trim();
  if (!value) return "";
  if (isPublicUrl(value) && process.env.RUNNINGHUB_UPLOAD_REMOTE_URL !== "1") return value;
  return uploadRunningHubMedia(value, context);
}

function extractUrlResults(payload) {
  return (payload?.results || []).filter((item) => item?.url);
}

async function submitRunningHubAiApp(appId, nodeInfoList, options = {}) {
  const id = String(appId || "").trim();
  if (!id) throw new Error("缺少 RunningHub AI App ID。");

  const body = {
    nodeInfoList: Array.isArray(nodeInfoList) ? nodeInfoList : [],
    instanceType: options.instanceType || process.env.RUNNINGHUB_INSTANCE_TYPE || "default",
    usePersonalQueue:
      options.usePersonalQueue ?? process.env.RUNNINGHUB_USE_PERSONAL_QUEUE === "true",
  };
  if (options.retainSeconds || process.env.RUNNINGHUB_RETAIN_SECONDS) {
    body.retainSeconds = Number(options.retainSeconds || process.env.RUNNINGHUB_RETAIN_SECONDS);
  }
  if (options.webhookUrl || process.env.RUNNINGHUB_WEBHOOK_URL) {
    body.webhookUrl = options.webhookUrl || process.env.RUNNINGHUB_WEBHOOK_URL;
  }

  const endpoint = `${runningHubBaseUrl()}/openapi/v2/run/ai-app/${id}`;
  appendRunningHubDebugLog({
    type: "submit",
    label: options.label || "",
    localTaskId: options.localTaskId || "",
    appId: id,
    endpoint,
    request: body,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: runningHubHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    appendRunningHubDebugLog({
      type: "submit_http_error",
      label: options.label || "",
      localTaskId: options.localTaskId || "",
      appId: id,
      statusCode: response.status,
      responseText: detail.slice(0, 1000),
    });
    throw new Error(`RunningHub 提交失败：${response.status} ${detail.slice(0, 120)}`);
  }

  const payload = await response.json();
  appendRunningHubDebugLog({
    type: "submit_response",
    label: options.label || "",
    localTaskId: options.localTaskId || "",
    appId: id,
    taskId: payload.taskId || "",
    status: payload.status || "",
    errorCode: payload.errorCode || "",
    errorMessage: payload.errorMessage || "",
    failedReason: payload.failedReason || null,
    resultCount: Array.isArray(payload.results) ? payload.results.length : 0,
  });
  if (payload.status === "FAILED") {
    const detail = payload.failedReason
      ? JSON.stringify(payload.failedReason)
      : payload.errorMessage || "";
    throw new Error(`RunningHub 提交失败: ${detail.slice(0, 300)}`);
  }
  // 提交未受理(如 NODE_INFO_MISMATCH:节点不在工作流):无 taskId 但带错误信息 → 抛真因
  if (!payload.taskId && (payload.errorMessage || payload.errorCode)) {
    throw new Error(`RunningHub 提交未受理: ${payload.errorMessage || payload.errorCode}`);
  }
  return payload;
}

async function runRunningHubAiApp(appId, nodeInfoList, options = {}) {
  const payload = await submitRunningHubAiApp(appId, nodeInfoList, options);
  let results = extractUrlResults(payload);
  if (!results.length && payload.taskId) {
    results = await pollRunningHubTask(payload.taskId, options.label || "任务");
  }
  return { payload, results };
}

async function pollRunningHubTask(taskId, label = "任务") {
  // 上限须覆盖最慢产物:生图≤10min、生视频 20~40min。默认 720×5s=60min 兜底(.env 可调)。
  const maxAttempts = Number(process.env.RUNNINGHUB_POLL_MAX || 720);
  const interval = Number(process.env.RUNNINGHUB_POLL_INTERVAL || 5000);
  // 查询端点偶发 5xx/504/网络抖动是临时的(任务仍在跑),容忍连续 N 次,别把整条任务判死。
  const maxTransient = Number(process.env.RUNNINGHUB_QUERY_MAX_TRANSIENT || 20);
  let transient = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let payload = null;
    try {
      const response = await fetch(`${runningHubBaseUrl()}/openapi/v2/query`, {
        method: "POST",
        headers: runningHubHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ taskId }),
      });
      if (!response.ok) {
        // 4xx(非429)=永久错误(如 taskId 非法/鉴权),快速失败;5xx/429/网络=临时,继续轮询
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          const detail = await response.text().catch(() => "");
          throw new Error(`RunningHub query error: ${response.status} ${detail.slice(0, 120)}`);
        }
        throw new Error(`transient:${response.status}`);
      }
      payload = await response.json();
      transient = 0; // 成功查询一次就清零
    } catch (e) {
      if (!/^transient:/.test(e.message) && /query error: 4/.test(e.message)) throw e; // 永久错误透传
      transient += 1;
      appendRunningHubDebugLog({
        type: "query_transient",
        label,
        taskId,
        attempt,
        transient,
        error: e.message,
      });
      if (transient > maxTransient) {
        throw new Error(`RunningHub ${label}查询连续失败 ${transient} 次(最近:${e.message}),放弃`);
      }
      await sleep(interval);
      continue; // 临时错误:等下一轮再查
    }

    if (payload.status === "SUCCESS") {
      return extractUrlResults(payload);
    }
    if (payload.status === "FAILED") {
      const detail = payload.failedReason
        ? JSON.stringify(payload.failedReason)
        : payload.errorMessage || "";
      throw new Error(`RunningHub ${label}失败: ${detail.slice(0, 300)}`);
    }
    await sleep(interval);
  }
  throw new Error(`RunningHub ${label}超时`);
}

async function queryRunningHubTask(taskId, label = "query") {
  const response = await fetch(`${runningHubBaseUrl()}/openapi/v2/query`, {
    method: "POST",
    headers: runningHubHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ taskId }),
  });

  if (!response.ok) {
    const detail = await response.text();
    appendRunningHubDebugLog({
      type: "query_http_error",
      label,
      taskId,
      statusCode: response.status,
      responseText: detail.slice(0, 1000),
    });
    throw new Error(`RunningHub query error: ${response.status} ${detail.slice(0, 120)}`);
  }

  const payload = await response.json();
  appendRunningHubDebugLog({
    type: "query_response",
    label,
    taskId,
    status: payload.status || "",
    errorCode: payload.errorCode || "",
    errorMessage: payload.errorMessage || "",
    failedReason: payload.failedReason || null,
    resultCount: Array.isArray(payload.results) ? payload.results.length : 0,
  });
  return payload;
}

module.exports = {
  sleep,
  hasRunningHubApi,
  runningHubBaseUrl,
  appendRunningHubDebugLog,
  readRunningHubDebugLogs,
  resolveRunningHubMediaValue,
  runRunningHubAiApp,
  submitRunningHubAiApp,
  uploadRunningHubMedia,
  queryRunningHubTask,
  pollRunningHubTask,
};
