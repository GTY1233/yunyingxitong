// 抖店真实 HTTP 调用占位。办好 key 后,这里实现:签名(sign.js)+ POST openapi-fxg + 错误码映射。
// 现在 real 模式调用会抛 NOT_IMPLEMENTED —— 明确可见、绝不假成功。详见 docs/13 §4.3/§6-B。
async function callShopApi(method, _params, _creds) {
  const e = new Error(
    `真实抖店调用「${method}」待接入:办好 app_key/店铺授权后,在 shop-client 实现签名+POST`
  );
  e.code = "NOT_IMPLEMENTED";
  e.retryable = false;
  throw e;
}

async function refreshAccessToken(_refreshToken, _creds) {
  const e = new Error("真实 token 刷新待接入");
  e.code = "NOT_IMPLEMENTED";
  throw e;
}

module.exports = { callShopApi, refreshAccessToken };
