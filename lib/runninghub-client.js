function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasRunningHubApi() {
  return Boolean(process.env.RUNNINGHUB_API_KEY);
}

function runningHubBaseUrl() {
  return String(process.env.RUNNINGHUB_BASE_URL || "https://www.runninghub.ai").replace(/\/$/, "");
}

async function pollRunningHubTask(taskId, label = "任务") {
  const maxAttempts = Number(process.env.RUNNINGHUB_POLL_MAX || 90);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(`${runningHubBaseUrl()}/openapi/v2/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RUNNINGHUB_API_KEY}`,
      },
      body: JSON.stringify({ taskId }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`RunningHub query error: ${response.status} ${detail.slice(0, 120)}`);
    }

    const payload = await response.json();
    if (payload.status === "SUCCESS") {
      return (payload.results || []).filter((item) => item?.url);
    }
    if (payload.status === "FAILED") {
      throw new Error(payload.errorMessage || payload.failedReason?.message || `RunningHub ${label}失败`);
    }
    await sleep(Number(process.env.RUNNINGHUB_POLL_INTERVAL || 2000));
  }
  throw new Error(`RunningHub ${label}超时`);
}

module.exports = {
  sleep,
  hasRunningHubApi,
  runningHubBaseUrl,
  pollRunningHubTask,
};
