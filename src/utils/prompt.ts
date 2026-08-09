export interface PromptContext {
  setIndex: number;
  imageIndex: number;
  theme?: string;
  subject?: string;
  style?: string;
  environment?: string;
}

const tokenMap: Record<string, keyof PromptContext> = {
  set_index: "setIndex",
  image_index: "imageIndex",
  theme: "theme",
  subject: "subject",
  style: "style",
  environment: "environment"
};

export function renderPrompt(template: string, context: PromptContext): string {
  return template.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (match, token) => {
    const key = tokenMap[token];
    if (!key) {
      return match;
    }

    const value = context[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function findUnknownPromptTokens(template: string): string[] {
  const tokens = new Set<string>();

  for (const match of template.matchAll(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g)) {
    if (!tokenMap[match[1]]) {
      tokens.add(match[1]);
    }
  }

  return Array.from(tokens);
}
