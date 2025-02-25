import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { Credentials } from '@aws-sdk/types';

/**
 * AWS签名工具类
 * 用于生成AWS API请求所需的签名
 */
export default class AwsSignature {
  private readonly region: string;
  private readonly service: string;
  private readonly credentials: Credentials;
  private readonly signer: SignatureV4;

  /**
   * 构造函数
   * 
   * @param region AWS区域
   * @param service AWS服务名称
   * @param accessKey 访问密钥ID
   * @param secretKey 秘密访问密钥
   * @param sessionToken 会话令牌（可选）
   */
  constructor(region?: string, service?: string, accessKey?: string, secretKey?: string, sessionToken?: string) {
    if (!region || !service || !accessKey || !secretKey) {
      throw new Error('必须提供region、service、accessKey和secretKey参数');
    }
    this.region = region;
    this.service = service;
    this.credentials = {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      sessionToken: sessionToken || ''
    };

    this.signer = new SignatureV4({
      credentials: this.credentials,
      region: this.region,
      service: this.service,
      sha256: Sha256
    });
  }

  public async sign(params: {
    method: string;
    host: string;
    path: string;
    queryParams?: Record<string, any>;
    headers?: Record<string, string>;
    body?: any;
  }): Promise<string> {
    const { method, host, path, queryParams = {}, headers = {}, body } = params;

    const queryString = Object.entries(queryParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    const request = new HttpRequest({
      method,
      hostname: host,
      path: path + (queryString ? `?${queryString}` : ''),
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const signedRequest = await this.signer.sign(request);
    const signatureValue = signedRequest.headers['authorization'].split('Signature=')[1];
    return signatureValue;
  }

  /**
   * 生成AWS请求签名
   * 
   * @param method HTTP方法
   * @param url 请求URL
   * @param headers 请求头
   * @param body 请求体
   * @returns 签名后的请求头
   */
  public async generateSignedHeaders(method: string, url: string, headers: Record<string, string>, body?: any): Promise<Record<string, string>> {
    const urlParts = new URL(url);
    const request = new HttpRequest({
      method,
      hostname: urlParts.hostname,
      path: urlParts.pathname + urlParts.search,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const signedRequest = await this.signer.sign(request);
    return signedRequest.headers as Record<string, string>;
  }
}
