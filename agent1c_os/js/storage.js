import { SAVED_APPS_KEY } from "./constants.js";

export function loadSavedApps(){
  try{
    const raw = localStorage.getItem(SAVED_APPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(x => x && typeof x.name === "string" && typeof x.url === "string")
      .map(x => ({ name: x.name.trim(), url: x.url.trim() }))
      .filter(x => x.name && x.url);
  } catch {
    return [];
  }
}

export function saveSavedApps(list){
  localStorage.setItem(SAVED_APPS_KEY, JSON.stringify(list));
}

export function normalizeUrl(url){
  const u = (url || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return "https://" + u;
}

export function upsertSavedApp(name, url){
  const n = (name || "").trim();
  const u = normalizeUrl(url);
  if (!n || !u) return false;

  const list = loadSavedApps();
  const idxByUrl = list.findIndex(x => x.url.toLowerCase() === u.toLowerCase());

  if (idxByUrl >= 0){
    list[idxByUrl].name = n;
    list[idxByUrl].url = u;
  } else {
    let finalName = n;
    const taken = new Set(list.map(x => x.name.toLowerCase()));
    if (taken.has(finalName.toLowerCase())){
      let i = 2;
      while (taken.has((finalName + " " + i).toLowerCase())) i++;
      finalName = finalName + " " + i;
    }
    list.push({ name: finalName, url: u });
  }

  saveSavedApps(list);
  return true;
}
