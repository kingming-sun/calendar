const DEFAULT_MODEL = "gemini-2.5-flash-image-preview";

function normalizeModel(model) {
  return String(model || DEFAULT_MODEL).trim().replace(/^\/+/, "");
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

  const model = normalizeModel(body.model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  try {
    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: String(body.prompt || "")
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      })
    });
    const payload = await readJson(geminiResponse);

    if (!geminiResponse.ok) {
      response.status(geminiResponse.status).json({
        error: getErrorMessage(payload),
        detail: payload
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
