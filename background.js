// Background script entry point

if (typeof browser === "undefined" && typeof chrome !== "undefined") {
  globalThis.browser = chrome;
} else if (typeof browser !== "undefined" && typeof chrome === "undefined") {
  globalThis.chrome = browser;
}

try {
  importScripts("utils/jobposting.js");
} catch (error) {
  console.error("Failed to load utils/jobposting.js", error);
}

try {
  importScripts("utils/portal-automation.js");
} catch (error) {
  console.error("Failed to load utils/portal-automation.js", error);
}

importScripts("background/tabs.js");
importScripts("background/jobposting.js");
importScripts("background/automation/state.js");
importScripts("background/automation/extraction.js");
importScripts("background/automation/navigation.js");
importScripts("background/automation/core.js");

if (browser.runtime) {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handleMessage = async () => {
      switch (message.type) {
        case "GET_PORTAL_AUTOMATION_STATUS": {
          const activeTab = await getActiveTab();
          const run = await getAutomationRun();
          return {
            success: true,
            portal: detectPortalFromUrl(activeTab?.url),
            tab: activeTab ? { id: activeTab.id, url: activeTab.url, title: activeTab.title } : null,
            run,
          };
        }

        case "START_PORTAL_AUTOMATION": {
          const run = await startPortalAutomation({
            tabId: message.tabId,
            webhookId: message.webhookId,
            portal: message.portal,
          });
          return { success: true, run };
        }

        case "STOP_PORTAL_AUTOMATION": {
          const run = await stopAutomation();
          return { success: true, run };
        }

        case "RESET_PORTAL_AUTOMATION": {
          const run = await resetAutomation();
          return { success: true, run };
        }

        case "COMPLETE_CURRENT_AUTOMATION_CANDIDATE": {
          const run = await completeCurrentAutomationCandidate();
          return { success: true, run };
        }

        case "RETRY_CURRENT_AUTOMATION_CANDIDATE": {
          const run = await retryCurrentAutomationCandidate();
          return { success: true, run };
        }
      }
    };

    handleMessage().then((response) => {
      sendResponse(response);
    }).catch((error) => {
      console.error("Error handling message:", error);
      sendResponse({ success: false, error: error.message });
    });

    return true;
  });
}

checkActiveTab();
