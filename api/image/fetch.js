function isSafeImageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:";
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

  const imageUrl = request.body?.imageUrl;
  if (!isSafeImageUrl(imageUrl)) {
    response.status(400).json({
      error: "图片 URL 无效"
    });
    return;
  }

  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      response.status(imageResponse.status).json({
        error: `图片下载失败：${imageResponse.status}`
      });
      return;
    }

    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      response.status(415).json({
        error: `远程地址不是图片：${contentType}`
      });
      return;
    }

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    response.status(200).json({
      imageBase64: buffer.toString("base64"),
      mimeType: contentType
    });
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : "图片代理下载失败"
    });
  }
}
