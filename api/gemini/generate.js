const DEFAULT_MODEL = "auto";
const LEGACY_IMAGE_MODELS = new Set([
  "gemini-2.5-flash-image-preview",
  "gemini-2.0-flash-exp-image-generation"
]);
const PREFERRED_IMAGE_MODELS = [
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash-exp-image-generation"
];

function normalizeModel(model) {
  const value = String(model || DEFAULT_MODEL).trim().replace(/^\/+/, "");

  if (!value || LEGACY_IMAGE_MODELS.has(value)) {
    return DEFAULT_MODEL;
  }

  return value;
}

function getErrorMessage(payload) {
  if (typeof payload?.error?.message === "string") {
    return payload.error.message;
  }

  if (typeof payload?.message === "string") {
    return payload.message;
  }

  return "Gemini 请求失败";
}

async function readJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text
    };
  }
}

function findImagePart(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];

  return parts.find((part) => part.inlineData?.data || part.inline_data?.data);
}

async function listGeminiModels(apiKey) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
    headers: {
      "x-goog-api-key": apiKey
    }
  });
  const payload = await readJson(response);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      payload,
      models: []
    };
  }

  return {
    ok: true,
    payload,
    models: payload.models || []
  };
}

function getModelId(model) {
  return String(model?.name || "").replace(/^models\//, "");
}

function supportsGenerateContent(model) {
  return (model?.supportedGenerationMethods || []).includes("generateContent");
}

function isImageModel(model) {
  const id = getModelId(model);
  return supportsGenerateContent(model) && id.includes("image");
}

function pickImageModel(models, requestedModel) {
  const imageModels = models.filter(isImageModel);

  if (requestedModel !== DEFAULT_MODEL) {
    const requested = imageModels.find((model) => getModelId(model) === requestedModel);
    if (requested) {
      return getModelId(requested);
    }
  }

  for (const preferredModel of PREFERRED_IMAGE_MODELS) {
    const match = imageModels.find((model) => getModelId(model) === preferredModel);
    if (match) {
      return getModelId(match);
    }
  }

  return getModelId(imageModels[0]);
}

function buildGenerateBody(prompt) {
  return {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  };
}

async function generateWithModel(model, apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(buildGenerateBody(prompt))
  });

  return {
    response,
    payload: await readJson(response)
  };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({
      error: "Method Not Allowed"
    });
    return;
  }

  const body = request.body || {};
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || body.apiKey;

  if (!apiKey) {
    response.status(400).json({
      error:
        "缺少 Gemini API Key。请在 Vercel 环境变量设置 GEMINI_API_KEY，或在应用设置页填写 Key。"
    });
    return;
  }

  const requestedModel = normalizeModel(body.model);

  try {
    const modelList = await listGeminiModels(apiKey);
    if (!modelList.ok) {
      response.status(modelList.status || 502).json({
        error: `无法获取 Gemini 可用模型列表：${getErrorMessage(modelList.payload)}`,
        detail: modelList.payload
      });
      return;
    }

    const model = pickImageModel(modelList.models, requestedModel);
    if (!model) {
      response.status(400).json({
        error:
          "当前 Gemini API Key 没有可用于图片生成的 generateContent 模型。请在 AI Studio 确认项目是否开放 Gemini 图片模型，或改用 Replicate/BFL。",
        detail: {
          availableGenerateContentModels: modelList.models
            .filter(supportsGenerateContent)
            .map(getModelId)
        }
      });
      return;
    }

    const { response: geminiResponse, payload } = await generateWithModel(
      model,
      apiKey,
      String(body.prompt || "")
    );

    if (!geminiResponse.ok) {
      response.status(geminiResponse.status).json({
        error: getErrorMessage(payload),
        detail: {
          requestedModel,
          selectedModel: model,
          response: payload
        }
      });
      return;
    }

    const imagePart = findImagePart(payload);
    const inlineData = imagePart?.inlineData || imagePart?.inline_data;

    if (!inlineData?.data) {
      response.status(502).json({
        error: "Gemini 响应中没有图片数据",
        detail: {
          finishReason: payload?.candidates?.[0]?.finishReason,
          responseKeys: Object.keys(payload || {})
        }
      });
      return;
    }

    response.status(200).json({
      imageBase64: inlineData.data,
      mimeType: inlineData.mimeType || inlineData.mime_type || "image/png",
      model,
      responseId: payload.responseId,
      usageMetadata: payload.usageMetadata
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Gemini 代理请求失败"
    });
  }
}
