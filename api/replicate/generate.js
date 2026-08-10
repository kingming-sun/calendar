const DEFAULT_MODEL = "black-forest-labs/flux-schnell";

function normalizeModel(model) {
  return String(model || DEFAULT_MODEL).trim().replace(/^\/+/, "");
}

function getErrorMessage(payload) {
  if (typeof payload?.detail === "string") {
    return payload.detail;
  }

  if (typeof payload?.error === "string") {
    return payload.error;
  }

  if (typeof payload?.message === "string") {
    return payload.message;
  }

  return "Replicate 请求失败";
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

function getAspectRatio(width, height) {
  const ratio = width / height;

  if (Math.abs(ratio - 1) < 0.08) {
    return "1:1";
  }

  if (ratio > 1) {
    return ratio > 1.5 ? "16:9" : "4:3";
  }

  return ratio < 0.7 ? "9:16" : "3:4";
}

function findOutputUrl(output) {
  if (!output) {
    return undefined;
  }

  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    return output.map(findOutputUrl).find(Boolean);
  }

  if (typeof output === "object") {
    return output.url || output.image || output[0];
  }

  return undefined;
}

function getCreateRequest(model, input) {
  if (/^[a-f0-9]{32,}$/i.test(model) || model.includes(":")) {
    const version = model.includes(":") ? model.split(":").at(-1) : model;

    return {
      url: "https://api.replicate.com/v1/predictions",
      body: {
        version,
        input
      }
    };
  }

  const [owner, name] = model.split("/");
  if (!owner || !name) {
    throw new Error("Replicate 模型格式应为 owner/model，或填写具体 version hash。");
  }

  return {
    url: `https://api.replicate.com/v1/models/${encodeURIComponent(owner)}/${encodeURIComponent(
      name
    )}/predictions`,
    body: {
      input
    }
  };
}

async function pollPrediction(getUrl, apiKey) {
  const startedAt = Date.now();
  const timeoutMs = 180_000;

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const response = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    const payload = await readJson(response);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        payload
      };
    }

    if (payload.status === "succeeded" || findOutputUrl(payload.output)) {
      return {
        ok: true,
        payload
      };
    }

    if (payload.status === "failed" || payload.status === "canceled") {
      return {
        ok: false,
        status: 502,
        payload
      };
    }
  }

  return {
    ok: false,
    status: 504,
    payload: {
      error: "Replicate 生成超时"
    }
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
  const apiKey = process.env.REPLICATE_API_TOKEN || body.apiKey;

  if (!apiKey) {
    response.status(400).json({
      error:
        "缺少 Replicate API Token。请在 Vercel 环境变量设置 REPLICATE_API_TOKEN，或在应用设置页填写 Token。"
    });
    return;
  }

  const model = normalizeModel(body.model);
  const width = Number(body.width || 1024);
  const height = Number(body.height || 1024);
  const input = {
    prompt: String(body.prompt || ""),
    aspect_ratio: getAspectRatio(width, height),
    output_format: "jpg",
    output_quality: 90,
    num_outputs: 1
  };

  if (body.seed !== undefined && body.seed !== null) {
    input.seed = Number(body.seed);
  }

  if (body.negativePrompt) {
    input.negative_prompt = String(body.negativePrompt);
  }

  try {
    const createRequest = getCreateRequest(model, input);
    const createResponse = await fetch(createRequest.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Prefer: "wait=60"
      },
      body: JSON.stringify(createRequest.body)
    });
    const createPayload = await readJson(createResponse);

    if (!createResponse.ok) {
      response.status(createResponse.status).json({
        error: getErrorMessage(createPayload),
        detail: createPayload
      });
      return;
    }

    let finalPayload = createPayload;
    if (!findOutputUrl(finalPayload.output) && finalPayload.urls?.get) {
      const pollResult = await pollPrediction(finalPayload.urls.get, apiKey);
      if (!pollResult.ok) {
        response.status(pollResult.status || 502).json({
          error: getErrorMessage(pollResult.payload),
          detail: pollResult.payload
        });
        return;
      }
      finalPayload = pollResult.payload;
    }

    const imageUrl = findOutputUrl(finalPayload.output);
    if (!imageUrl) {
      response.status(502).json({
        error: "Replicate 响应中没有图片地址",
        detail: finalPayload
      });
      return;
    }

    response.status(200).json({
      imageUrl,
      model,
      predictionId: finalPayload.id,
      status: finalPayload.status,
      metrics: finalPayload.metrics
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Replicate 代理请求失败"
    });
  }
}
