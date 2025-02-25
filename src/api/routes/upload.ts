import _ from "lodash";

import Request from "@/lib/request/Request.ts";
import { uploadImage } from "@/api/controllers/upload.ts";
import { tokenSplit } from "@/api/controllers/core.ts";
import util from "@/lib/util.ts";

export default {
  prefix: "/v1/upload",

  post: {
    "/image": async (request: Request) => {
      request
        .validate("body", v => {
          // 如果是表单上传
          if (request.files && _.isArray(request.files)) {
            if (request.files.length === 0) return "文件数组为空或格式不正确";
            const file = request.files[0];
            // 验证文件是否存在且包含必要属性
            if (!file || !file.buffer || !file.originalname || !file.size) return "文件格式不正确或缺少必要属性";
            // 验证文件类型
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.mimetype)) return "不支持的文件类型";
            // 验证文件大小（最大10MB）
            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) return "文件大小超过限制（最大10MB）";
            return true;
          }
          // 如果是二进制上传
          if (Buffer.isBuffer(v)) {
            // 验证文件大小（最大10MB）
            const maxSize = 10 * 1024 * 1024;
            if (v.length > maxSize) return "文件大小超过限制（最大10MB）";
            // 验证Content-Type
            const contentType = request.headers['content-type'];
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(contentType)) return "不支持的文件类型";
            return true;
          }
          return "无效的文件上传格式";
        }, "文件验证失败")
        .validate("headers.authorization", _.isString, "缺少授权信息");
      // refresh_token切分
      const tokens = tokenSplit(request.headers.authorization);
      // 随机挑选一个refresh_token
      const token = _.sample(tokens);
      
      let file;
      if (_.isArray(request.files)) {
        // 处理表单上传的文件
        const uploadFile = request.files[0];
        file = {
          buffer: uploadFile.buffer,
          originalname: uploadFile.originalname,
          size: uploadFile.size,
          mimetype: uploadFile.mimetype
        };
      } else {
        // 处理二进制上传的文件
        const fileSize = Buffer.isBuffer(request.body) ? request.body.length : 0;
        file = {
          buffer: request.body,
          originalname: request.headers['x-file-name'] || 'upload.png',
          size: fileSize,
          mimetype: request.headers['content-type']
        };
      }
      
      // 上传文件
      const imageUrl = await uploadImage(file, token);
      return {
        created: util.unixTimestamp(),
        url: imageUrl
      };
    },
  },
};