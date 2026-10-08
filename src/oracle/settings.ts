const KEY = "shijie-suanfa/model";

export type ModelLink = {
  baseUrl: string;
  model: string;
  apiKey: string;
};

const empty: ModelLink = { baseUrl: "", model: "", apiKey: "" };

export function readModel(): ModelLink {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const data = JSON.parse(raw) as Partial<ModelLink>;
    return {
      baseUrl: typeof data.baseUrl === "string" ? data.baseUrl : "",
      model: typeof data.model === "string" ? data.model : "",
      apiKey: typeof data.apiKey === "string" ? data.apiKey : "",
    };
  } catch {
    return empty;
  }
}

export function writeModel(next: ModelLink) {
  localStorage.setItem(KEY, JSON.stringify({
    baseUrl: next.baseUrl.trim(),
    model: next.model.trim(),
    apiKey: next.apiKey.trim(),
  }));
}
