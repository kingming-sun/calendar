const DEFAULT_MODEL = "flux-dev";
const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 180000;

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function normalizeModel(model) {
  const value = String(model || DEFAULT_MODEL).trim();

  if (value === "fal-ai/flux/dev" || value === "fal-ai/flux" || value === "flux") {
    return DEFAULT_MODEL;
  }

  return value.replace(/^\/+/, "");
}

function getErrorMessage(payload) {
  if (!payload) {
    return "BFL 请求失败";
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  if (Array.isArray(payload.detail)) {
    return payload.detail
      .map((item) => item?.msg || item?.message)
      .filter(Boolean)
      .join("; ");
  }

  return payload.message || payload.error || "BFL 请求失败";
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

async function pollResult(pollingUrl, apiKey, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(DEFAULT_POLL_INTERVAL_MS);

    const response = await fetch(pollingUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-key": apiKey
      }
    });
    const payload = await readJson(response);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: getErrorMessage(payload)
      };
    }

    if (payload.status === "Ready") {
      const imageUrl = payload.result?.sample;

      if (!imageUrl) {
        return {
          ok: false,
          status: 502,
          message: "BFL 结果已就绪，但响应中没有 result.sample 图片 URL"
        };
      }

      return {
        ok: true,
        imageUrl,
        seed: payload.result?.seed,
        rawStatus: payload.status
      };
    }

    if (payload.status === "Error" || payload.status === "Failed") {
      return {
        ok: false,
        status: 502,
        message: getErrorMessage(payload) || `BFL 生成失败：${payload.status}`
      };
    }
  }

  return {
    ok: false,
    status: 504,
    message: "BFL 生成超时，请稍后重试或降低并发"
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
  const apiKey = process.env.BFL_API_KEY || body.apiKey;

  if (!apiKey) {
    response.status(400).json({
      error: "缺少 BFL API Key。请在 Vercel 环境变量设置 BFL_API_KEY，或在应用设置页填写 Key。"
    });
    return;
  }

  const model = normalizeModel(body.model);
  const width = Number(body.width || 1024);
  const height = Number(body.height || 1024);
  const payload = {
    prompt: String(body.prompt || ""),
    width,
    height,
    output_format: "jpeg",
    safety_tolerance: Number(body.safety_tolerance ?? 2)
  };

  if (body.seed !== undefined && body.seed !== null) {
    payload.seed = Number(body.seed);
  }

  try {
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

    if (!submitPayload.polling_url) {
      response.status(502).json({
        error: "BFL 未返回 polling_url",
        detail: submitPayload
      });
      return;
    }

    const result = await pollResult(
      submitPayload.polling_url,
      apiKey,
      Number(body.timeoutMs || DEFAULT_TIMEOUT_MS)
    );

    if (!result.ok) {
      response.status(result.status).json({
        error: result.message
      });
      return;
    }

    response.status(200).json({
      imageUrl: result.imageUrl,
      providerJobId: submitPayload.id,
      seed: result.seed,
      model
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "BFL 代理请求失败"
    });
  }
}
