const DEFAULT_SETTINGS = {
  endpoint: "https://llm-prod.tne.tn.corp:13600/api/v1/chat/generate",
  token: "",
  authHeaderName: "Authorization",
  authPrefix: "Bearer ",
  model: "qwen-main",
  modelId: 5,
  mode: "llm",
  temperature: 0.01,
  maxOutputTokens: 16394,
  maxContextChars: 15000,
  requestTimeoutMs: 90000,
  panelFontSize: 12
};

const form = document.getElementById("settings-form");
const status = document.getElementById("status");

init();

async function init() {
  const saved = await browser.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const settings = { ...DEFAULT_SETTINGS, ...saved };

  for (const [key, value] of Object.entries(settings)) {
    if (form.elements[key]) form.elements[key].value = value;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);

  const settings = {
    endpoint: String(data.get("endpoint") || "").trim(),
    token: String(data.get("token") || "").trim(),
    authHeaderName: String(data.get("authHeaderName") || "Authorization").trim(),
    authPrefix: String(data.get("authPrefix") ?? "Bearer "),
    model: String(data.get("model") || "qwen-main").trim(),
    modelId: Number(data.get("modelId") || 5),
    mode: "llm",
    temperature: Number(data.get("temperature") || 0.01),
    maxOutputTokens: Number(data.get("maxOutputTokens") || 16394),
    maxContextChars: Math.min(Number(data.get("maxContextChars") || 15000), 15000),
    requestTimeoutMs: Number(data.get("requestTimeoutMs") || 90000)
  };

  await browser.storage.local.set(settings);
  status.textContent = "Настройки сохранены.";
  setTimeout(() => (status.textContent = ""), 1800);
});
