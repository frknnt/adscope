import { checkUrl, getSite } from "./shared.js";

const MENU_TEXT = "adscope-check-selection";
const MENU_PAGE = "adscope-check-page";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_TEXT, title: "Seçili metni AdScope ile kontrol et", contexts: ["selection"] });
    chrome.contextMenus.create({
      id: MENU_PAGE,
      title: "Bu sayfayı açılış sayfası olarak kontrol et",
      contexts: ["page"],
      documentUrlPatterns: ["https://*/*", "http://*/*"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const site = await getSite();
  if (!site) {
    // Not configured yet: open the popup page in a tab so the user can enter the site address.
    await chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?ayar=1") });
    return;
  }
  let url = null;
  if (info.menuItemId === MENU_TEXT && info.selectionText) url = checkUrl(site, { text: info.selectionText });
  if (info.menuItemId === MENU_PAGE && tab?.url) url = checkUrl(site, { landing: tab.url });
  if (url) await chrome.tabs.create({ url, index: tab ? tab.index + 1 : undefined });
});
