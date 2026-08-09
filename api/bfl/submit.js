function normalizeModel(model) {
  const value = String(model || "flux-dev").trim();

  if (value === "fal-ai/flux/dev" || value === "fal-ai/flux" || value === "flux") {
    return "flux-dev";
  }

  return value.replace(/^\/+/, "");
}

function getErrorMessage(payload) {
  if (typeof payload?.detail === "string") {
    return payload.detail;
  }

  if (Array.isArray(payload?.detail)) {
    return payload.detail
      .map((item) => item?.msg || item?.message)
      .filter(Boolean)
      .join("; ");
  }

  return payload?.message || payload?.error || "BFL 请求失败";
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

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({
      error: "Method Not Allowed"
    });
    return;
  }

  const body = request.body || {};
  const apiKey = process.env.BFL_API_KEY || body.apiKey;

  if (!apiKey) {
    response.status(400).json({
      error: "缺少 BFL API Key。请在 Vercel 环境变量设置 BFL_API_KEY，或在应用设置页填写 Key。"
    });
    return;
  }

  const payload = {
    prompt: String(body.prompt || ""),
    width: Number(body.width || 1024),
    height: Number(body.height || 1024),
    output_format: "jpeg",
    safety_tolerance: Number(body.safety_tolerance ?? 2)
  };

  if (body.seed !== undefined && body.seed !== null) {
    payload.seed = Number(body.seed);
  }

  try {
    const model = normalizeModel(body.model);
    const submitResponse = await fetch(`https://api.bfl.ai/v1/${model}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "x-key": apiKey
      },
      body: JSON.stringify(payload)
    });
    const submitPayload = await readJson(submitResponse);

    if (!submitResponse.ok) {
      response.status(submitResponse.status).json({
        error: getErrorMessage(submitPayload),
        detail: submitPayload
      });
      return;
    }

    response.status(200).json({
      requestId: submitPayload.id,
      pollingUrl: submitPayload.polling_url,
      model
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "BFL 提交请求失败"
    });
  }
}
