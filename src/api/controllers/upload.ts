import _, { isNull } from "lodash";
import APIException from "@/lib/exceptions/APIException.ts";
import EX from "@/api/consts/exceptions.ts";
import util from "@/lib/util.ts";
import { request } from "./core.ts";
import logger from "@/lib/logger.ts";
import AwsSignature from "@/lib/aws/AwsSignature.ts";

/**
 * 处理预检请求
 * 
 * @param url 请求URL
 * @returns 预检响应
 */
export async function handleOptionsRequest(url: string) {
  // 返回预检响应，允许实际请求
  return {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Length, X-File-Name',
      'Access-Control-Max-Age': '86400'
    }
  };
}

/**
 * 上传图片到TOS服务器
 * 
 * @param file 文件对象
 * @param refreshToken 用于刷新access_token的refresh_token
 * @returns 图片URL
 */
export async function uploadImage(file: any, refreshToken: string) {
  if (!file || !file.buffer)
    throw new APIException(EX.API_REQUEST_PARAMS_INVALID, "文件不存在");

  // 第一步：获取上传Token
  const tokenResponse = await request(
    "POST",
    "https://jimeng.jianying.com/mweb/v1/get_upload_token",
    refreshToken,
    {
      params: {
        aid: "513695"
      }
    }
  );

  logger.info(`获取上传Token响应: ${JSON.stringify(tokenResponse)}`);

  if (tokenResponse?.session_token === null) {
    throw new APIException(EX.API_REQUEST_FAILED, "获取上传Token失败");
  }

  const securityToken = tokenResponse.session_token;
  const accessKeyId = tokenResponse.access_key_id;
  const secretAccessKey = tokenResponse.secret_access_key;
  const currentTime = new Date();
  const dateStamp = currentTime.toISOString().split('T')[0].replace(/-/g, '');
  const region = 'cn-north-1';
  const service = 'imagex';
  
  const awsSignature = new AwsSignature(
    region,
    service,
    accessKeyId,
    secretAccessKey,
    securityToken
  );
  const amzDate = new Date().toISOString().replace(/[:-]|\.\./g, "");
  const signature = await awsSignature.sign({
    method: 'GET',
    host: 'imagex.bytedanceapi.com',
    path: '/',
    queryParams: {
      Action: 'ApplyImageUpload',
      Version: '2018-08-01',
      ServiceId: 'tb4s082cfz',
      FileSize: file.size
    },
    headers: {
      'x-amz-date': amzDate,
      'x-amz-security-token': securityToken
    }
  });
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request, SignedHeaders=x-amz-date;x-amz-security-token, Signature=${signature}`;

  logger.info(`securityToken: ${securityToken}`);
  logger.info(`authorization: ${authorization}`);


  // 第二步：获取上传凭证
  const applyResponse = await request(
    "GET",
    "https://imagex.bytedanceapi.com",
    refreshToken,
    {
      headers: {
        "x-amz-date": new Date().toISOString().replace(/[:-]|\.\./g, ""),
        "x-amz-security-token": securityToken,
        "Authorization": authorization
      },
      params: {
        Action: "ApplyImageUpload",
        Version: "2018-08-01",
        ServiceId: "tb4s082cfz",
        FileSize: file.size
      }
    }
  );

  logger.info(`获取上传凭证响应: ${JSON.stringify(applyResponse)}`);

  if (!applyResponse?.Result?.UploadAddress?.StoreInfos?.[0]) {
    throw new APIException(EX.API_REQUEST_FAILED, "获取上传凭证失败");
  }

  const { StoreUri, Auth, UploadID } = applyResponse.Result.UploadAddress.StoreInfos[0];
  const uploadHost = applyResponse.Result.UploadAddress.UploadHosts[0];

  logger.info(`开始上传图片: ${file.originalname} 大小: ${file.size} 字节`);

  // 第二步：上传文件
  const uploadUrl = `https://${uploadHost}/upload/v1/${StoreUri}`;
  logger.info(`开始上传文件到: ${uploadUrl}`);

  const response = await request(
    "post",
    uploadUrl,
    refreshToken,
    {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.originalname}"`,
        "Content-Length": file.size,
        "Authorization": Auth
      },
      data: file.buffer,
    }
  );

  logger.info(`上传响应数据: ${JSON.stringify(response)}`);
  const { aigc_data } = response;
  
  if (!aigc_data?.url)
    throw new APIException(EX.API_REQUEST_FAILED, "上传失败");

  return aigc_data.url;
}

export default {
  uploadImage,
};