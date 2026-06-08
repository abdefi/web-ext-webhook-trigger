const executeTabFunction = async (tabId, func, args = []) => {
  if (browser.scripting && typeof browser.scripting.executeScript === "function") {
    const results = await browser.scripting.executeScript({
      target: { tabId },
      func,
      args,
    });
    const item = results?.[0];
    if (item?.error) {
      throw new Error(item.error);
    }
    return item?.result;
  }
  throw new Error("Script function execution is unavailable.");
};

const waitForTabLoad = async (tabId, timeoutMs = 15000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const t = await browser.tabs.get(tabId).catch(() => null);
    if (t && t.status === "complete") return t;
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
};

const getActiveTab = async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0] || null;
};
