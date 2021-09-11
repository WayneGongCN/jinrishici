#!/root/.nvm/versions/node/v14.17.3/bin/node
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// constant
const TOKEN_FILE_NAME = ".token";
const TOKEN_CHARSET = "utf-8";
const GET_TOKEN_URL = "https://v2.jinrishici.com/token";
const GET_SENTENCE_URL = "https://v2.jinrishici.com/sentence";

// argv
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const argv = yargs(hideBin(process.argv)).argv;
const { mode = "dev" } = argv;

// logger
const log4js = require("log4js");
log4js.configure({
  appenders: {
    stdout: { type: "console" },
    file: { type: "file", filename: `jinrishici.${mode}.log` },
  },
  categories: { default: { appenders: ["stdout", "file"], level: "debug" } },
});
const logger = log4js.getLogger("default");
logger.info("argv: ", argv);

// dotenv
require("dotenv").config();
const { PROD_BOOT_URL, DEV_BOOT_URL } = process.env;
const BOOT_URL = mode === "prod" ? PROD_BOOT_URL : DEV_BOOT_URL;

// 消息模板
const template = ({ content, fullContent, title, dynasty, author }) =>
  `> ${content}\n\n\n「${
    Array.isArray(fullContent) && fullContent.length
      ? `[${title}](${encodeURI(
          `https://jinrishici.waynegong.cn?content=${fullContent.join("\n")}&title=${title}&author=${author}`
        )})`
      : title
  }」 ${dynasty}·${author}\n\n`;

/**
 * 获取 TOKEN 并保存在本地文件中
 * @returns
 */
function fetchToken(force = false) {
  const tokenPath = path.join(__dirname, TOKEN_FILE_NAME);
  const tokenExists = fs.existsSync(tokenPath);
  const needFetchToken = !force && tokenExists;

  if (needFetchToken) {
    logger.debug("TOKEN 已存在");
    const token = fs.readFileSync(tokenPath, TOKEN_CHARSET);
    return Promise.resolve(token);
  } else {
    logger.debug("重新获取 TOKEN");
    return axios
      .get(GET_TOKEN_URL)
      .then((res) => {
        if (res.status === 200 && res.data && res.data.status === "success") {
          logger.debug(`TOKEN 获取成功`);
          return res.data.data;
        } else {
          logger.error(`TOKEN 获取失败 ${JSON.stringify(res.data)}`);
          return Promise.reject(
            new Error(`获取 TOKEN 失败 ${JSON.stringify(res.data)}`)
          );
        }
      })
      .then((token) => {
        logger.debug(`写入 TOKEN 到 ${tokenPath}`);
        fs.writeFileSync(tokenPath, token, TOKEN_CHARSET);
        return token;
      });
  }
}

/**
 * 获取今日诗词
 * @param {*} token
 * @returns
 */
function fetchCentence(token) {
  logger.debug("获取诗词内容");
  if (!token) return Promise.reject(new Error("token is required."));
  const authHeader = { "X-User-Token": token };

  return axios.get(GET_SENTENCE_URL, { headers: authHeader }).then((res) => {
    if (res.status === 200 && res.data && res.data.status === "success") {
      return res.data.data;
    } else {
      return Promise.reject(res.data);
    }
  });
}

/**
 * 发送企业微信消息（仅支持 markdown 格式）
 * @param {*} param0
 * @param {*} type
 * @returns
 */
function sendMsg({ content }, type = "markdown") {
  const postData = {};
  if (type === "markdown") {
    postData.msgtype = "markdown";
    postData.markdown = { content };
  }

  return axios.post(BOOT_URL, postData).then((res) => {
    if (res.status === 200 && res?.data?.errcode === 0) {
      logger.info("企业微信推送成功");
      return res.data;
    }
    return Promise.reject(res.data);
  });
}

/**
 * 重试（默认三次）
 * @param {*} cb
 * @param {*} count
 * @param {*} i
 */
async function retry(cb, count = 3, i = 0) {
  try {
    await cb(i > 0);
  } catch (e) {
    if (i >= count) throw new Error("Retry end.");
    logger.error(e);
    logger.warn(`Retry ${++i} ...`);
    retry(cb, count, i);
  }
}

/**
 * 主流程
 */
async function main(isRetry = false) {
  const token = await fetchToken(isRetry);
  if (!token) return;

  const centence = await fetchCentence(token);
  if (!centence) return;
  logger.info("centence: ", JSON.stringify(centence));

  const {
    content,
    origin: { content: fullContent, title, dynasty, author },
  } = centence;
  const msgContent = template({ content, fullContent, title, dynasty, author });

  await sendMsg({ content: msgContent });
}

retry(main);
