import _ from "lodash";

import Request from "@/lib/request/Request.ts";
import { generateVideo } from "@/api/controllers/video.ts";
import { tokenSplit } from "@/api/controllers/core.ts";
import util from "@/lib/util.ts";

export default {
  prefix: "/v1/video",

  post: {
    "/generations": async (request: Request) => {
      request
        .validate("body.prompt", _.isString)
        .validate("body.imageUri", v => _.isString(v) && v.length > 0)
        .validate("body.width", v => _.isUndefined(v) || _.isFinite(v))
        .validate("body.height", v => _.isUndefined(v) || _.isFinite(v))
        .validate("body.fps", v => _.isUndefined(v) || _.isFinite(v))
        .validate("body.duration", v => _.isUndefined(v) || _.isFinite(v))
        .validate("body.model", v => _.isUndefined(v) || _.isString(v))
        .validate("body.seed", v => _.isUndefined(v) || _.isFinite(v))
        .validate("body.response_format", v => _.isUndefined(v) || _.isString(v))
        .validate("headers.authorization", _.isString);
      // refresh_token切分
      const tokens = tokenSplit(request.headers.authorization);
      // 随机挑选一个refresh_token
      const token = _.sample(tokens);
      const {
        prompt,
        imageUri,
        width,
        height,
        fps,
        duration,
        model,
        seed,
        response_format,
      } = request.body;
      const responseFormat = _.defaultTo(response_format, "url");
      const videoUrl = await generateVideo(model,prompt, imageUri, {
        width,
        height,
        fps,
        duration,
        seed,
      }, token);
      let data;
      if (responseFormat == "b64_json") {
        const b64 = await util.fetchFileBASE64(videoUrl);
        data = { b64_json: b64 };
      } else {
        data = { url: videoUrl };
      }
      return {
        created: util.unixTimestamp(),
        data,
      };
    },
  },
};