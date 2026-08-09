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

function isAllowedPollingUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith("bfl.ai");
  } catch {
    return false;
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

  if (!isAllowedPollingUrl(body.pollingUrl)) {
    response.status(400).json({
      error: "非法 pollingUrl"
    });
    return;
  }

  try {
    const resultResponse = await fetch(body.pollingUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-key": apiKey
      }
    });
    const payload = await readJson(resultResponse);

    if (!resultResponse.ok) {
      response.status(resultResponse.status).json({
        error: getErrorMessage(payload),
        detail: payload
      });
      return;
    }

    if (payload.status === "Ready") {
      response.status(200).json({
        status: payload.status,
        imageUrl: payload.result?.sample,
        seed: payload.result?.seed
      });
      return;
    }

    if (payload.status === "Error" || payload.status === "Failed") {
      response.status(502).json({
        status: payload.status,
        error: getErrorMessage(payload)
      });
      return;
    }

    response.status(200).json({
      status: payload.status || "Pending"
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "BFL 轮询请求失败"
    });
  }
}
