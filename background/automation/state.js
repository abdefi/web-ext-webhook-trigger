const preparingRuns = new Set();

const getAutomationRun = async () => {
  const key = typeof PORTAL_AUTOMATION_STORAGE_KEY !== "undefined"
    ? PORTAL_AUTOMATION_STORAGE_KEY
    : "portal_automation_run";
  const stored = await browser.storage.local.get(key);
  return stored[key] || null;
};

const saveAutomationRun = async (run) => {
  const key = typeof PORTAL_AUTOMATION_STORAGE_KEY !== "undefined"
    ? PORTAL_AUTOMATION_STORAGE_KEY
    : "portal_automation_run";
  await browser.storage.local.set({
    [key]: {
      ...run,
      updatedAt: new Date().toISOString(),
    },
  });
};

const stopAutomation = async () => {
  const run = await getAutomationRun();
  if (!run) return null;
  const updated = {
    ...run,
    status: "stopped",
    message: "Automation stopped.",
  };
  await saveAutomationRun(updated);
  return updated;
};

const resetAutomation = async () => {
  const key = typeof PORTAL_AUTOMATION_STORAGE_KEY !== "undefined"
    ? PORTAL_AUTOMATION_STORAGE_KEY
    : "portal_automation_run";
  await browser.storage.local.remove(key);
  return null;
};
