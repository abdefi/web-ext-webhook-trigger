const normalizeUrlForCompare = (url) => {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return url || "";
  }
};

const closeChatLightbox = async (tabId) => {
  const closed = await executeTabFunction(tabId, () => {
    const closeBtn = document.querySelector('button svg[data-testid="close-lightbox-icon"]')?.closest("button")
      || document.querySelector('[data-testid="close-lightbox-icon"]')
      || document.querySelector('[data-testid*="close"]')?.closest("button");
    if (!closeBtn) return false;
    closeBtn.scrollIntoView({ block: "center", inline: "center" });
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
      closeBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
    return true;
  });

  if (!closed) return;

  await executeTabFunction(tabId, () => {
    return new Promise((resolve) => {
      const maxWait = 5000;
      const interval = 300;
      let elapsed = 0;
      const check = () => {
        const confirmBtn = Array.from(document.querySelectorAll("button")).find((btn) => {
          const text = (btn.textContent || "").trim();
          return text === "Ja, verwerfen";
        });
        if (confirmBtn) {
          ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
            confirmBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
          });
          resolve(true);
          return;
        }
        elapsed += interval;
        if (elapsed >= maxWait) return resolve(false);
        setTimeout(check, interval);
      };
      setTimeout(check, 400);
    });
  });

  await executeTabFunction(tabId, () => {
    return new Promise((resolve) => {
      const maxWait = 5000;
      const interval = 300;
      let elapsed = 0;
      const check = () => {
        const lightbox = document.querySelector('[data-testid="lightbox-header"], [role="dialog"], [class*="lightbox"]');
        if (!lightbox) return resolve(true);
        elapsed += interval;
        if (elapsed >= maxWait) return resolve(false);
        setTimeout(check, interval);
      };
      setTimeout(check, 400);
    });
  });
};

const clickNextProfileSwitcherAndExtract = async (tabId) => {
  const clickResult = await executeTabFunction(tabId, () => {
    const nextBtn = document.querySelector('button[data-testid="switchNext"]');
    if (!nextBtn) return { clicked: false, reason: "not-found" };

    const isDisabled =
      nextBtn.disabled ||
      nextBtn.getAttribute("disabled") === "" ||
      nextBtn.getAttribute("aria-disabled") === "true" ||
      nextBtn.getAttribute("aria-disabled") === true;

    const style = window.getComputedStyle(nextBtn);
    const isEffectivelyDisabled = isDisabled || parseFloat(style.opacity) < 0.4 || style.pointerEvents === "none";

    if (isEffectivelyDisabled) {
      return { clicked: false, reason: "disabled" };
    }

    const h1 = document.querySelector("h1");
    const currentName = h1?.textContent?.trim() || "";
    const currentUrl = window.location.href;

    nextBtn.scrollIntoView({ block: "center", inline: "center" });
    nextBtn.focus?.();

    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
      nextBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });

    return { clicked: true, currentName, currentUrl };
  });

  if (!clickResult || !clickResult.clicked) {
    console.log("Profile switcher click failed:", clickResult?.reason);
    return null;
  }

  const updated = await executeTabFunction(tabId, (prevName, prevUrl) => {
    return new Promise((resolve) => {
      const maxWait = 20000;
      const interval = 500;
      let elapsed = 0;
      let stableRounds = 0;

      const check = () => {
        const h1 = document.querySelector("h1");
        const newName = h1?.textContent?.trim() || "";
        const newUrl = window.location.href;
        const bodyText = document.body?.innerText || "";

        const changed = (newName && newName !== prevName) || (newUrl !== prevUrl);
        const hasContent = bodyText.length > 300;

        if (changed && hasContent) {
          if (stableRounds < 2) {
            stableRounds++;
            setTimeout(check, interval);
            return;
          }
          const name = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() || "";
          const url = window.location.href;
          resolve({ name, url });
          return;
        }

        elapsed += interval;
        if (elapsed >= maxWait) return resolve(null);
        setTimeout(check, interval);
      };

      setTimeout(check, 600);
    });
  }, [clickResult.currentName, clickResult.currentUrl]);

  if (!updated || !updated.url) return null;

  try {
    const parsed = new URL(updated.url);
    return {
      id: parsed.pathname,
      name: updated.name || "Candidate",
      url: updated.url,
      source: "xing-profile-switcher",
    };
  } catch {
    return null;
  }
};

const clickNextPageAndExtract = async (tabId, portal, existingIds) => {
  const clickResult = await executeTabFunction(tabId, () => {
    const pagination = document.querySelector('ol[data-wry="Pagination"], ol#pagination, [data-testid="pagination"], nav[aria-label*="page"]');
    if (!pagination) return { clicked: false };

    const current = pagination.querySelector('[data-testid="current-page-item"], [aria-current="page"]');
    const currentNum = current ? parseInt(current.textContent, 10) : null;

    const firstCard = document.querySelector('[data-testid="candidateCard"]');
    const firstHref = firstCard?.querySelector('a[data-testid="candidateFullName"]')?.getAttribute("href") || "";

    const items = Array.from(pagination.querySelectorAll("li, button, a"));
    const nextArrow = items.find((el) => {
      if (el.disabled || el.getAttribute("disabled") === "") return false;
      const svg = el.querySelector("svg");
      if (!svg) return false;
      const testId = svg.getAttribute("data-testid") || "";
      return testId.includes("arrow-right") || testId.includes("next");
    });

    let clicked = false;
    if (nextArrow) {
      nextArrow.click();
      clicked = true;
    } else if (currentNum && !Number.isNaN(currentNum)) {
      for (const el of items) {
        const num = parseInt(el.textContent, 10);
        if (num === currentNum + 1) {
          el.click();
          clicked = true;
          break;
        }
      }
    }

    if (!clicked) return { clicked: false };
    return { clicked: true, prevPageNum: currentNum, firstHref };
  });

  if (!clickResult || !clickResult.clicked) return [];

  const navigated = await executeTabFunction(tabId, (prevPageNum, prevFirstHref) => {
    return new Promise((resolve) => {
      const maxWait = 15000;
      const interval = 600;
      let elapsed = 0;

      const check = () => {
        const pagination = document.querySelector('ol[data-wry="Pagination"], ol#pagination, [data-testid="pagination"], nav[aria-label*="page"]');
        const current = pagination?.querySelector('[data-testid="current-page-item"], [aria-current="page"]');
        const newNum = current ? parseInt(current.textContent, 10) : null;

        if (newNum && !Number.isNaN(newNum) && newNum !== prevPageNum) {
          return resolve(true);
        }

        const firstCard = document.querySelector('[data-testid="candidateCard"]');
        const newFirstHref = firstCard?.querySelector('a[data-testid="candidateFullName"]')?.getAttribute("href") || "";
        if (newFirstHref && newFirstHref !== prevFirstHref) {
          return resolve(true);
        }

        elapsed += interval;
        if (elapsed >= maxWait) return resolve(false);
        setTimeout(check, interval);
      };

      setTimeout(check, 1000);
    });
  }, [clickResult.prevPageNum, clickResult.firstHref]);

  if (!navigated) return [];

  await new Promise((r) => setTimeout(r, 2000));

  const candidates = await executeTabFunction(tabId, (inputPortal, seenIds) => {
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const isRenderable = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    };

    const seen = new Set(seenIds || []);
    const candidates = [];

    const addCandidate = (name, url) => {
      if (!name || name.length < 2 || !url) return false;
      try {
        const parsed = new URL(url);
        if (seen.has(parsed.pathname)) return false;
        seen.add(parsed.pathname);
        candidates.push({ id: parsed.pathname, name, url, source: `${inputPortal || "xing"}-visible-list` });
        return true;
      } catch (_) {
        return false;
      }
    };

    if (inputPortal === "xing") {
      const cards = Array.from(document.querySelectorAll('[data-testid="candidateCard"]'));
      for (const card of cards) {
        if (!isRenderable(card)) continue;
        const nameAnchor = card.querySelector('a[data-testid="candidateFullName"]');
        if (!nameAnchor) continue;
        const href = nameAnchor.getAttribute("href") || "";
        if (!href || href.startsWith("javascript:")) continue;
        const url = new URL(href, window.location.href).toString();
        const name = (nameAnchor.textContent || "").replace(/\s+/g, " ").trim();
        addCandidate(name, url);
      }
    }

    const allAnchors = Array.from(document.querySelectorAll('a[href]'));
    const profileAnchors = allAnchors.filter((a) => {
      const href = a.getAttribute("href") || "";
      return href && !href.startsWith("javascript:") && /\/(in|pub|profile)\//.test(href);
    });
    for (const anchor of profileAnchors) {
      if (!isVisible(anchor)) continue;
      const rawHref = anchor.getAttribute("href") || "";
      const url = new URL(rawHref, window.location.href).toString();
      const name = (anchor.textContent || "").replace(/\s+/g, " ").trim();
      addCandidate(name, url);
    }

    return candidates;
  }, [portal, existingIds]);

  return Array.isArray(candidates) ? candidates : [];
};

const handlePagination = async (run) => {
  if (!run || !run.tabId || !run.listUrl) return null;

  const currentTab = await browser.tabs.get(run.tabId).catch(() => null);
  const listPath = normalizeUrlForCompare(run.listUrl);
  const isOnListPage = currentTab && normalizeUrlForCompare(currentTab.url).startsWith(listPath);

  await saveAutomationRun({
    ...run,
    status: "running",
    currentCandidate: null,
    message: "Loading next page...",
  });

  if (!isOnListPage) {
    await browser.tabs.update(run.tabId, { url: run.listUrl });
    await waitForTabLoad(run.tabId);
    await new Promise((r) => setTimeout(r, 2000));
  }

  const existingIds = Array.isArray(run.candidates) ? run.candidates.map((c) => c.id) : [];
  const newCandidates = await clickNextPageAndExtract(run.tabId, run.portal, existingIds);

  if (!newCandidates.length) {
    return null;
  }

  const normalized = newCandidates.map((c, i) => ({
    id: c?.id || `candidate-${run.candidates.length + i + 1}`,
    name: String(c?.name || "").trim() || `Candidate ${run.candidates.length + i + 1}`,
    url: String(c?.url || "").trim(),
    source: c?.source || `${run.portal}-visible-list`,
  })).filter((c) => c.url);

  if (!normalized.length) return null;

  const updatedCandidates = [...run.candidates, ...normalized];
  return {
    ...run,
    candidates: updatedCandidates,
    total: updatedCandidates.length,
    status: "running",
    message: `Loaded ${normalized.length} more candidates from next page.`,
  };
};
