// 自动模式下的节点参数自动选择:用户零操作,素材从库里随机轮换(每次生成有变化)。
// 图片节点 → 随机选一张模特图(node41);视频节点 → 随机选一段参考视频(node161)。
// 库为空时返回空参数:模板兜底路径照跑;真实 API 路径会以明确报错落到审核中心,提示先传素材。
const modelImageRepo = require("../repositories/model-image.repo");
const refVideoRepo = require("../repositories/reference-video.repo");

function pickRandom(list) {
  if (!list?.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

async function autoParamsForNode(node) {
  if (node.kind === "image") {
    const m = pickRandom(await modelImageRepo.list());
    return m ? { modelImageId: m.id } : {};
  }
  if (node.kind === "video") {
    const rv = pickRandom(await refVideoRepo.list());
    return rv ? { referenceVideoId: rv.id } : {};
  }
  return {};
}

module.exports = { autoParamsForNode };
