// 抖店开放平台请求签名(纯函数,可单测)。
// ⚠️ 算法依据镜像站/第三方资料,务必在拿到 app_key 进沙箱后照官方复核(docs/13 §2.2 待实测)。
// 待签名串 = secret + "app_key"+appKey + "method"+method + "param_json"+paramJson
//          + "timestamp"+timestamp + "v2" + secret ;  sign = MD5(待签名串)
// param_json:业务参数 JSON,key 字典序升序、无多余空格。
const crypto = require("node:crypto");

// 递归按 key 升序,产出稳定 JSON 串(数组顺序保留)。
function stableSortedJson(params) {
  const sort = (v) => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = sort(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sort(params || {}));
}

function md5Sign(appKey, appSecret, method, paramJson, timestamp) {
  const raw = `${appSecret}app_key${appKey}method${method}param_json${paramJson}timestamp${timestamp}v2${appSecret}`;
  return crypto.createHash("md5").update(raw, "utf8").digest("hex");
}

// 组装抖店公共参数(含 sign)。timestamp 形如 'YYYY-MM-DD HH:mm:ss'。
function buildSignedParams({ appKey, appSecret, accessToken, method, params, timestamp }) {
  const paramJson = stableSortedJson(params);
  const sign = md5Sign(appKey, appSecret, method, paramJson, timestamp);
  return {
    app_key: appKey,
    access_token: accessToken || "",
    method,
    param_json: paramJson,
    timestamp,
    v: "2",
    sign,
  };
}

module.exports = { stableSortedJson, md5Sign, buildSignedParams };
