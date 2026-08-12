const DEFAULT_MODEL = "gpt-image-2";
const DEFAULT_BASE_URL = "https://bajie-api.com/v1";

function normalizeModel(model) {
  return String(model || DEFAULT_MODEL).trim().replace(/^\/+/, "");
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
}

function getImageSize(width, height) {
  const ratio = width / height;

  if (Math.abs(ratio - 1) < 0.08) {
    return "1024x1024";
  }

  return ratio > 1 ? "1536x1024" : "1024x1536";
}

function getErrorMessage(payload) {
  if (typeof payload?.error?.message === "string") {
    return payload.error.message;
  }

  if (typeof payload?.error === "string") {
    return payload.error;
  }

  if (typeof payload?.message === "string") {
    return payload.message;
  }

  return "Bajie API 请求失败";
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

function findImage(payload) {
  const image = payload?.data?.[0] || payload?.images?.[0] || payload?.output?.[0];

  if (typeof image === "string") {
    return {
      imageUrl: image
    };
  }

  return {
    imageBase64: image?.b64_json || image?.base64 || image?.image_base64,
    imageUrl: image?.url || image?.image_url
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
  const apiKey = process.env.BAJIE_API_KEY || body.apiKey;

  if (!apiKey) {
    response.status(400).json({
      error:
        "缺少 Bajie API Key。请在 Vercel 环境变量设置 BAJIE_API_KEY，或在应用设置页填写 Key。"
    });
    return;
  }

  const baseUrl = normalizeBaseUrl(process.env.BAJIE_BASE_URL || body.baseUrl);
  const model = normalizeModel(body.model);

  try {
    const providerResponse = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt: String(body.prompt || ""),
        n: 1,
        size: getImageSize(Number(body.width || 1024), Number(body.height || 1024)),
        quality: "medium"
      })
    });
    const payload = await readJson(providerResponse);

    if (!providerResponse.ok) {
      response.status(providerResponse.status).json({
        error: getErrorMessage(payload),
        detail: payload
      });
      return;
    }

    const image = findImage(payload);
    if (!image.imageBase64 && !image.imageUrl) {
      response.status(502).json({
        error: "Bajie API 响应中没有图片数据",
        detail: payload
      });
      return;
    }

    response.status(200).json({
      ...image,
      mimeType: "image/png",
      model,
      usage: payload.usage
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Bajie API 代理请求失败"
    });
  }
}
