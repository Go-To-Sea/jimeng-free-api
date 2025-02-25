import _ from "lodash";

import APIException from "@/lib/exceptions/APIException.ts";
import EX from "@/api/consts/exceptions.ts";
import util from "@/lib/util.ts";
import { getCredit, receiveCredit, request } from "./core.ts";
import logger from "@/lib/logger.ts";

const DEFAULT_ASSISTANT_ID = "513695";
export const DEFAULT_MODEL = "jimeng-video-s2.0";
const MODEL_MAP = {
  "jimeng-video-s2.0": 2
};

export function getModel(model: string) {
  return MODEL_MAP[model] || MODEL_MAP[DEFAULT_MODEL];
}

export async function generateVideo(
  _model: string,
  prompt: string,
  imageUri: string,
  {
    width = 1024,
    height = 1024,
    fps = 24,
    duration = 5000,
    seed = Math.floor(Math.random() * 100000000) + 2500000000,
  }: {
    width?: number;
    height?: number;
    fps?: number;
    duration?: number;
    seed?: number;
  },
  refreshToken: string
) {
  const modelId = getModel(_model);
  logger.info(`生成视频参数: ${width}x${height} FPS: ${fps} 时长: ${duration}ms 模型: ${modelId}`);

  const { totalCredit } = await getCredit(refreshToken);
  if (totalCredit <= 0)
    await receiveCredit(refreshToken);

  const { aigc_data } = await request(
    "post",
    "/mweb/v1/generate_video",
    refreshToken,
    {
      params: {
        babi_param: encodeURIComponent(
          JSON.stringify({
            scenario: "image_video_generation",
            feature_key: "image_to_video",
            feature_entrance: "to_image",
            feature_entrance_detail: "to_image-image_to_video",
          })
        ),
        aid: DEFAULT_ASSISTANT_ID,
        device_platform: "web",
        region: "CN",
        web_id: "7473380759261890111",
        a_bogus: "Df4Qvc2KMsm1Pcy-T7kz97Cjcom0YW4ngZENesG9etLz"
      },
      data: {
        submit_id: util.uuid(),
        task_extra: JSON.stringify({
          promptSource: "custom",
          originSubmitId: util.uuid(),
          isDefaultSeed: 1,
          originTemplateId: "",
          imageNameMapping: {},
          isUseAiGenPrompt: false,
          batchNumber: 1
        }),
        http_common_info: {
          aid: Number(DEFAULT_ASSISTANT_ID),
        },
        input: {
          seed,
          video_gen_inputs: [
            {
              prompt,
              first_frame_image: {
                width,
                height,
                image_uri: imageUri,
                format: "jpeg",
                aigc_image: {
                  item_id: util.uuid()
                }
              },
              fps,
              duration_ms: duration,
              video_mode: modelId,
              template_id: ""
            }
          ],
          priority: 0,
          model_req_key: "dreamina_ic_generate_video_model_vgfm_lite"
        },
        mode: "workbench",
        history_option: {},
        commerce_info: {
          resource_id: "generate_video",
          resource_id_type: "str",
          resource_sub_type: "aigc",
          benefit_type: "basic_video_operation_vgfm_lite"
        },
        client_trace_data: {}
      },
    }
  );
  logger.info(`请求URL: /mweb/v1/generate_video`);
  logger.info(`请求参数: ${JSON.stringify({
    params: {
      babi_param: {
        scenario: "image_video_generation",
        feature_key: "image_to_video",
        feature_entrance: "to_image",
        feature_entrance_detail: "to_image-image_to_video"
      }
    },
    data: {
      submit_id: util.uuid(),
      task_extra: {
        promptSource: "custom",
        originSubmitId: util.uuid(),
        isDefaultSeed: 1,
        originTemplateId: "",
        imageNameMapping: {},
        isUseAiGenPrompt: false,
        batchNumber: 1
      },
      http_common_info: { aid: DEFAULT_ASSISTANT_ID },
      input: {
        seed,
        video_gen_inputs: [{
          prompt,
          first_frame_image: {
            width,
            height,
            image_uri: imageUri,
            format: "jpeg",
            aigc_image: { item_id: util.uuid() }
          },
          fps,
          duration_ms: duration,
          video_mode: modelId,
          template_id: ""
        }],
        priority: 0,
        model_req_key: "dreamina_ic_generate_video_model_vgfm_lite"
      },
      mode: "workbench",
      history_option: {},
      commerce_info: {
        resource_id: "generate_video",
        resource_id_type: "str",
        resource_sub_type: "aigc",
        benefit_type: "basic_video_operation_vgfm_lite"
      },
      client_trace_data: {}
    }
  }, null, 2)}`);

  const taskId = aigc_data.task_id;
  if (!taskId)
    throw new APIException(EX.API_IMAGE_GENERATION_FAILED, "任务ID不存在");

  let status = "PENDING", videoUrl;
  while (status === "PENDING" || status === "RUNNING") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const result = await request("get", "/mweb/v1/get_task_status", refreshToken, {
      params: {
        task_id: taskId,
        http_common_info: JSON.stringify({
          aid: Number(DEFAULT_ASSISTANT_ID),
        }),
      },
    });

    status = result.status;
    if (status === "SUCCESS") {
      videoUrl = result.result?.video_url;
      break;
    } else if (status === "FAILED") {
      throw new APIException(EX.API_IMAGE_GENERATION_FAILED, "视频生成失败");
    }
  }

  if (!videoUrl)
    throw new APIException(EX.API_IMAGE_GENERATION_FAILED, "视频URL不存在");

  return videoUrl;
}

export default {
  generateVideo,
};