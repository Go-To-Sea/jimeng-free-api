import _ from "lodash";

import APIException from "@/lib/exceptions/APIException.ts";
import EX from "@/api/consts/exceptions.ts";
import util from "@/lib/util.ts";
import { getCredit, receiveCredit, request } from "./core.ts";
import logger from "@/lib/logger.ts";

const DEFAULT_ASSISTANT_ID = "513695";
const DRAFT_VERSION = "3.0.2";
export const DEFAULT_MODEL = "jimeng-image-2.0-pro";
const MODEL_MAP = {
  "jimeng-image-2.0-pro": "high_aes_general_v20_L:general_v2.0_L"
};

export function getModel(model: string) {
  return MODEL_MAP[model] || MODEL_MAP[DEFAULT_MODEL];
}

export async function generateReferenceImages(
  _model: string,
  prompt: string,
  imageUri: string,
  {
    width = 1024,
    height = 1024,
    sampleStrength = 0.5,
  }: {
    width?: number;
    height?: number;
    sampleStrength?: number;
  },
  refreshToken: string
) {
  const model = getModel(_model);
  logger.info(`使用模型: ${_model} 映射模型: ${model} ${width}x${height} 精细度: ${sampleStrength}`);

  const { totalCredit } = await getCredit(refreshToken);
  if (totalCredit <= 0)
    await receiveCredit(refreshToken);

  const componentId = util.uuid();
  const { aigc_data } = await request(
    "post",
    "/mweb/v1/aigc_draft/generate",
    refreshToken,
    {
      params: {
        babi_param: encodeURIComponent(
          JSON.stringify({
            scenario: "image_video_generation",
            feature_key: "to_image_referenceimage_generate",
            feature_entrance: "to_image",
            feature_entrance_detail: "to_image-referenceimage-byte_edit"
          })
        ),
      },
      data: {
        extend: {
          root_model: model,
          template_id: "",
        },
        submit_id: util.uuid(),
        draft_content: JSON.stringify({
          type: "draft",
          id: util.uuid(),
          min_version: DRAFT_VERSION,
          min_features: [],
          is_from_tsn: true,
          version: "3.1.1",
          main_component_id: componentId,
          component_list: [
            {
              type: "image_base_component",
              id: componentId,
              min_version: DRAFT_VERSION,
              generate_type: "blend",
              aigc_mode: "workbench",
              abilities: {
                type: "",
                id: util.uuid(),
                blend: {
                  type: "",
                  id: util.uuid(),
                  core_param: {
                    type: "",
                    id: util.uuid(),
                    model,
                    prompt: "##" + prompt,
                    sample_strength: sampleStrength,
                    image_ratio: 1,
                    large_image_info: {
                      type: "",
                      id: util.uuid(),
                      height,
                      width,
                    },
                  },
                  ability_list: [
                    {
                      type: "",
                      id: util.uuid(),
                      name: "byte_edit",
                      image_uri_list: [imageUri],
                      image_list: [
                        {
                          type: "image",
                          id: util.uuid(),
                          source_from: "upload",
                          platform_type: 1,
                          name: "",
                          image_uri: imageUri,
                          width: 0,
                          height: 0,
                          format: "",
                          uri: imageUri,
                        },
                      ],
                      strength: sampleStrength,
                    },
                  ],
                  history_option: {
                    type: "",
                    id: util.uuid(),
                  },
                  prompt_placeholder_info_list: [
                    {
                      type: "",
                      id: util.uuid(),
                      ability_index: 0,
                    },
                  ],
                  postedit_param: {
                    type: "",
                    id: util.uuid(),
                    generate_type: 0,
                  },
                },
              },
            },
          ],
        }),
        http_common_info: {
          aid: Number(DEFAULT_ASSISTANT_ID),
        },
      },
    }
  );
  logger.info(`请求URL: /mweb/v1/aigc_draft/generate`);
  logger.info(`请求参数: ${JSON.stringify({
    params: {
      babi_param: {
        scenario: "image_video_generation",
        feature_key: "to_image_referenceimage_generate",
        feature_entrance: "to_image",
        feature_entrance_detail: "to_image-referenceimage-byte_edit"
      }
    },
    data: {
      extend: { root_model: model, template_id: "" },
      submit_id: util.uuid(),
      draft_content: {
        type: "draft",
        id: util.uuid(),
        min_version: DRAFT_VERSION,
        min_features: [],
        is_from_tsn: true,
        version: "3.1.1",
        main_component_id: componentId,
        component_list: [{
          type: "image_base_component",
          id: componentId,
          min_version: DRAFT_VERSION,
          generate_type: "blend",
          aigc_mode: "workbench",
          abilities: {
            type: "",
            id: util.uuid(),
            blend: {
              type: "",
              id: util.uuid(),
              core_param: {
                type: "",
                id: util.uuid(),
                model,
                prompt: "##" + prompt,
                sample_strength: sampleStrength,
                image_ratio: 1,
                large_image_info: {
                  type: "",
                  id: util.uuid(),
                  height,
                  width,
                },
              },
              ability_list: [{
                type: "",
                id: util.uuid(),
                name: "byte_edit",
                image_uri_list: [imageUri],
                image_list: [{
                  type: "image",
                  id: util.uuid(),
                  source_from: "upload",
                  platform_type: 1,
                  name: "",
                  image_uri: imageUri,
                  width: 0,
                  height: 0,
                  format: "",
                  uri: imageUri,
                }],
                strength: sampleStrength,
              }],
              history_option: {
                type: "",
                id: util.uuid(),
              },
              prompt_placeholder_info_list: [{
                type: "",
                id: util.uuid(),
                ability_index: 0,
              }],
              postedit_param: {
                type: "",
                id: util.uuid(),
                generate_type: 0,
              },
            },
          },
        }],
      },
      http_common_info: { aid: DEFAULT_ASSISTANT_ID }
    }
  }, null, 2)}`);
  const historyId = aigc_data.history_record_id;
  if (!historyId)
    throw new APIException(EX.API_IMAGE_GENERATION_FAILED, "记录ID不存在");
  let status = 20, failCode, item_list = [];
  while (status === 20) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const result = await request("post", "/mweb/v1/get_history_by_ids", refreshToken, {
      data: {
        history_ids: [historyId],
        image_info: {
          width: 2048,
          height: 2048,
          format: "webp",
          image_scene_list: [
            {
              scene: "normal",
              width: 2400,
              height: 2400,
              uniq_key: "2400",
              format: "webp",
            },
            {
              scene: "normal",
              width: 1080,
              height: 1080,
              uniq_key: "1080",
              format: "webp",
            },
          ],
        },
        http_common_info: {
          aid: Number(DEFAULT_ASSISTANT_ID),
        },
      },
    });
    if (!result[historyId])
      throw new APIException(EX.API_IMAGE_GENERATION_FAILED, "记录不存在");
    status = result[historyId].status;
    failCode = result[historyId].fail_code;
    item_list = result[historyId].item_list;
  }
  if (status === 30) {
    if (failCode === '2038')
      throw new APIException(EX.API_CONTENT_FILTERED);
    else
      throw new APIException(EX.API_IMAGE_GENERATION_FAILED);
  }
  return item_list.map((item) => {
    if(!item?.image?.large_images?.[0]?.image_url)
      return item?.common_attr?.cover_url || null;
    return item.image.large_images[0].image_url;
  });
}

export default {
  generateReferenceImages,
};