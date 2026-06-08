async function updateIcon(status) {
  try {
    const badgeColors = {
      none: "#9ca3af",
      match: "#22c55e",
      mismatch: "#ef4444",
    };
    const badgeTexts = {
      none: "X",
      match: "✓",
      mismatch: "!",
    };
    if (browser.action) {
      await browser.action.setBadgeBackgroundColor({ color: badgeColors[status] || "#9ca3af" });
      await browser.action.setBadgeText({ text: badgeTexts[status] || "" });
    } else if (browser.browserAction) {
      await browser.browserAction.setBadgeBackgroundColor({ color: badgeColors[status] || "#9ca3af" });
      await browser.browserAction.setBadgeText({ text: badgeTexts[status] || "" });
    }
  } catch (error) {
    console.debug("Failed to update icon:", error);
  }
}

async function checkActiveTab() {
  try {
    if (typeof computeCurrentJobpostingState !== "function") {
      console.debug("computeCurrentJobpostingState helper not available");
      return;
    }
    const state = await computeCurrentJobpostingState(browser);
    await updateIcon(state.current.status);
    await browser.storage.local.set({
      [CURRENT_TAB_JOBPOSTING_STORAGE_KEY]: state.current,
    });
  } catch (error) {
    console.debug("Failed to check active tab:", error);
  }
}

if (browser.tabs) {
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" || changeInfo.url) {
      await checkActiveTab();
    }
    if (changeInfo.status === "complete") {
      try {
        const run = await getAutomationRun();
        if (run?.status === "preparing" && run.tabId === tabId && run.currentCandidate) {
          await prepareAutomationCandidate(run);
        }
      } catch (error) {
        console.error("Failed to continue portal automation after tab update:", error);
      }
    }
  });

  browser.tabs.onActivated.addListener(async () => {
    await checkActiveTab();
  });
}

if (browser.windows) {
  browser.windows.onFocusChanged.addListener(async () => {
    await checkActiveTab();
  });
}
