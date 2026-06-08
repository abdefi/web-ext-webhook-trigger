const getPortalDisplayName = (portal) => {
  if (portal === "linkedin") return "LinkedIn";
  return "XING";
};

const extractPortalCandidateProfile = async (run, candidate, portal) => {
  if (!run || run.status === "stopped" || run.status === "complete") {
    return candidate;
  }

  const portalLabel = getPortalDisplayName(portal);
  return normalizeCandidate(await executeTabFunction(run.tabId, async (inputCandidate, inputPortal) => {
    const portalName = inputPortal || "xing";
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const getProfileContentText = () => {
      const clean = (root) => {
        root.querySelectorAll("script, style, noscript, iframe, svg, nav, aside, header, footer, [role='navigation'], [role='banner'], [role='menubar']").forEach((el) => el.remove());
      };
      const contentSelectors = [
        "#tab-content",
        "#main-region",
        '[data-testid="profile-content"]',
        '[data-testid="profile-main"]',
        "article",
        'section[class*="profile"]',
        'div[class*="profile-content"]',
      ];
      for (const selector of contentSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const clone = el.cloneNode(true);
          clean(clone);
          clone.querySelectorAll('[id*="lightbox"], [id*="message"], [id*="conversation"], [class*="lightbox"], [class*="modal"], [data-testid*="conversation"]').forEach((e) => e.remove());
          const text = clone.innerText.trim();
          if (text.length > 100) return text;
        }
      }
      const body = document.body;
      if (!body) return "";
      const clone = body.cloneNode(true);
      clean(clone);
      clone.querySelectorAll('#navigation-region, #app-banner, [id*="lightbox"], [id*="message"], [id*="conversation"]').forEach((e) => e.remove());
      return clone.innerText.trim();
    };
    const waitForProfileReady = async (timeoutMs = 20000) => {
      const startedAt = Date.now();
      let lastLength = 0;
      let stableRounds = 0;
      while (Date.now() - startedAt < timeoutMs) {
        const text = getProfileContentText();
        const length = text.length;
        if (length > 200) {
          if (Math.abs(length - lastLength) <= 10) {
            stableRounds++;
            if (stableRounds >= 3) return text;
          } else {
            stableRounds = 0;
          }
          lastLength = length;
        } else {
          stableRounds = 0;
          lastLength = 0;
        }
        await sleep(400);
      }
      const finalText = getProfileContentText();
      return finalText.length > 200 ? finalText : null;
    };
    const profileText = await waitForProfileReady();
    if (!profileText) {
      throw new Error(`Timed out waiting for ${portalLabel} profile content.`);
    }
    const cleanProfileText = String(profileText)
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 20000);
    const titleName = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
    return {
      ...inputCandidate,
      name: titleName || inputCandidate.name,
      profileText: cleanProfileText,
      extractedAt: new Date().toISOString(),
      portal: portalName,
    };
  }, [candidate, portal]) || candidate);
};
