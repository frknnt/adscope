import { checkUrl, getSite, normalizeSite } from "./shared.js";

const $ = (id) => document.getElementById(id);

async function init() {
  const site = await getSite();
  if (site) $("site").value = site;
  if (!site || new URLSearchParams(location.search).has("ayar")) {
    $("settings").open = true;
    $("site-msg").textContent = site ? "" : "Başlamak için AdScope adresini kaydet.";
  }
}

$("site-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const site = normalizeSite($("site").value);
  if (!site) {
    $("site-msg").textContent = "Geçerli bir https adresi yaz.";
    return;
  }
  await chrome.storage.sync.set({ site });
  $("site").value = site;
  $("site-msg").textContent = "Kaydedildi.";
});

$("check").addEventListener("submit", async (e) => {
  e.preventDefault();
  const site = await getSite();
  if (!site) {
    $("settings").open = true;
    $("check-msg").textContent = "Önce Ayarlar bölümünden AdScope adresini kaydet.";
    $("site").focus();
    return;
  }
  const text = $("text").value.trim();
  if (text.length < 10) {
    $("check-msg").textContent = "Reklam metnini yaz (en az 10 karakter).";
    return;
  }
  await chrome.tabs.create({ url: checkUrl(site, { text, headline: $("headline").value }) });
  window.close();
});

init();
