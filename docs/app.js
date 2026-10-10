// 太陽光・蓄電池ニュースの画面処理（CSPでページ内スクリプトを禁止するため index.html から切り出し）
const PAGE = 10;  // 全記事の表示件数（「続きを読む」で10件ずつ追加）
const state = { cat: "all", topic: null, rel: false, q: "", shown: PAGE, items: [], topics: [], storageTopics: [] };
// 細分類は分野ごとに別の項目に入っている（太陽光=topic、蓄電池=storage_topic）
const topicKey = () => state.cat === "storage" ? "storage_topic" : "topic";
const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const WD = ["日","月","火","水","木","金","土"];
const DAY = 864e5;

const pad = n => String(n).padStart(2, "0");
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const dayKey = iso => iso.slice(0,10);
const within = days => { const t = Date.now() - days * DAY; return state.items.filter(it => new Date(it.published).getTime() >= t); };
function dayLabel(key){
  const [y,m,d] = key.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((today - dt) / DAY);
  const base = `${m}月${d}日 ${WD[dt.getDay()]}曜日`;
  return diff === 0 ? `本日　${base}` : diff === 1 ? `昨日　${base}` : base;
}
function kicker(it){
  const k = el("span", "kicker " + (it.categories.length > 1 ? "" : it.categories[0]));
  k.textContent = it.categories.map(c => c === "solar" ? "太陽光" : "蓄電池").join("・") + [it.topic, it.storage_topic].filter(t => t && t !== "その他").map(t => `｜${t}`).join("");
  return k;
}
function when(iso){
  const d = new Date(iso), diff = (Date.now() - d) / 36e5;
  if (diff < 1) return "1時間以内";
  if (diff < 24) return `${Math.floor(diff)}時間前`;
  return `${d.getMonth()+1}月${d.getDate()}日`;
}
function link(it, cls){
  const a = el("a", "hl " + (cls || "")); a.href = it.link; a.target = "_blank"; a.rel = "noopener"; return a;
}

const isFiltered = () => state.cat !== "all" || state.topic || state.rel || state.q.trim();

/* 一面 */
const FRONT_N = 7;  // 一面に載せる本数（トップ1＋準トップ6）
function shuffle(a){ for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// 今日（JST）配信の記事か
const isToday = it => dayKey(it.published) === keyOf(new Date());
// 今日の記事なら NEW の印を返す（append に展開して使う）
const newMark = it => isToday(it) ? [el("span", "new", "NEW")] : [];
// 一面の記事を選ぶ：当日のニュースを優先して前に置き、足りない分は前日、その前の日…から補う。
// 各日の中ではランダムに並べ、同じ媒体が続かないよう媒体の重複をできるだけ避ける
function pickFront(){
  const news = state.items.filter(it => it.type === "news" && it.title.length >= 16);
  const byDay = {};
  for (const it of news) (byDay[dayKey(it.published)] ||= []).push(it);
  const today = keyOf(new Date());
  const days = Object.keys(byDay).filter(k => k <= today).sort().reverse();
  const picks = [], seen = new Set();
  for (const k of days){
    if (picks.length >= FRONT_N) break;
    const pool = shuffle([...byDay[k]]);
    for (const it of pool) if (picks.length < FRONT_N && !seen.has(it.source)){ picks.push(it); seen.add(it.source); }
    for (const it of pool) if (picks.length < FRONT_N && !picks.includes(it)){ picks.push(it); seen.add(it.source); }
  }
  // 見出しの日付は、一面に載せた中で一番新しい日（今日の記事があれば「今日の一面」）
  return { day: days[0] || null, picks };
}
function renderFront(){
  const { day, picks } = pickFront();
  const used = new Set();
  if (day){
    const [, m, d] = day.split("-").map(Number);
    $("#frontTitle").textContent = day === keyOf(new Date()) ? "今日の一面" : `${m}月${d}日の一面`;
  }
  const lead = picks[0];
  const leadA = $("#lead"); leadA.textContent = "";
  if (lead){
    used.add(lead.id);
    leadA.href = lead.link;
    leadA.append(kicker(lead), ...newMark(lead), el("h3", "t", lead.title));
    // Googleニュースの要約は「見出し＋媒体名」なので、見出しの繰り返しなら出さない
    if (lead.summary && !lead.summary.startsWith(lead.title.slice(0, 12))) leadA.append(el("p", "dek", lead.summary.slice(0, 90) + (lead.summary.length > 90 ? "…" : "")));
    leadA.append(el("div", "meta", `${lead.source}　${when(lead.published)}`));
  }
  const secs = $("#seconds"); secs.textContent = "";
  for (const it of picks.slice(1)){
    used.add(it.id);
    const a = link(it); a.append(kicker(it), ...newMark(it), el("span", "t", it.title), el("span", "small-meta", `${it.source}　${when(it.published)}`));
    secs.append(a);
  }
  const flash = $("#flash"); flash.textContent = "";
  state.items.filter(it => !used.has(it.id)).slice(0, 9).forEach(it => {
    used.add(it.id);
    const li = el("li"), a = link(it);
    const tm = el("time"); tm.dateTime = it.published;
    if (dayKey(it.published) === keyOf(new Date())) tm.textContent = it.published.slice(11,16);
    else { tm.append(it.published.slice(11,16)); tm.append(el("small", null, `${Number(it.published.slice(5,7))}/${Number(it.published.slice(8,10))}`)); }
    const t = el("span", "t"); t.append(...newMark(it), it.title);
    a.append(tm, t);
    li.append(a); flash.append(li);
  });
  for (const [cat, box] of [["solar", "#colSolar"], ["storage", "#colStorage"]]){
    const c = $(box); c.textContent = "";
    // 分野別の欄は一面・速報との重複を気にせず、その分野の最新5件を配信時刻の新しい順に出す
    state.items.filter(it => it.categories.includes(cat)).slice(0, 5).forEach(it => {
      used.add(it.id);
      const a = link(it, "brief");
      if (it.topic || it.storage_topic) a.append(kicker(it));
      const rel = it.type === "release" ? `　プレスリリース${it.company ? `　${it.company}` : ""}` : "";
      a.append(...newMark(it), el("span", "t", it.title), el("span", "small-meta", `${it.source}　${when(it.published)}${rel}`));
      c.append(a);
    });
  }
}

/* 記事数の推移 */
function renderChart(){
  const days = [];
  for (let i = 13; i >= 0; i--){ const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i); days.push(d); }
  const agg = Object.fromEntries(days.map(d => [keyOf(d), { s: 0, b: 0 }]));
  for (const it of state.items){ const a = agg[dayKey(it.published)]; if (!a) continue;
    if (it.categories.includes("solar")) a.s++; if (it.categories.includes("storage")) a.b++; }
  const max = Math.max(1, ...Object.values(agg).map(a => a.s + a.b));
  const ch = $("#chart"), cx = $("#chartX"); ch.textContent = ""; cx.textContent = "";
  days.forEach((d, i) => {
    const a = agg[keyOf(d)], last = i === 13;
    const col = el("div", "col");
    col.title = `${d.getMonth()+1}/${d.getDate()}　太陽光 ${a.s}件・蓄電池 ${a.b}件`;
    const s = el("i", "s"), b = el("i", "b");
    s.style.height = (a.s / max * 100) + "%"; b.style.height = (a.b / max * 100) + "%";
    col.append(s, b);
    if (a.s + a.b){ const n = el("b", null, a.s + a.b); n.style.bottom = ((a.s + a.b) / max * 100) + "%"; col.append(n); }
    ch.append(col);
    cx.append(el("span", last ? "today" : null, last ? "今日" : `${d.getMonth()+1}/${d.getDate()}`));
  });
}

/* メニューの分類索引・媒体ランキング */
function renderIndex(){
  const recent = within(30);
  const rc = {}, sc2 = {}; let solarN = 0, storageN = 0;
  for (const it of recent){
    if (it.topic){ rc[it.topic] = (rc[it.topic] || 0) + 1; }
    if (it.storage_topic){ sc2[it.storage_topic] = (sc2[it.storage_topic] || 0) + 1; }
    if (it.categories.includes("solar")) solarN++;
    if (it.categories.includes("storage")) storageN++;
  }
  const row = (label, n, pressed, onClick, cls) => {
    const li = el("li", cls), b = el("button");
    b.setAttribute("aria-pressed", pressed);
    b.append(el("span", "n", label), el("span", "c", n));
    b.onclick = () => { onClick(); closeMenu(); jump(); };
    li.append(b); return li;
  };
  const ix = $("#index"); ix.textContent = "";
  ix.append(row("すべての太陽光", solarN, state.cat === "solar" && !state.topic, () => setCat("solar"), "all"));
  for (const t of state.topics) if (rc[t]) ix.append(row(t, rc[t], state.cat === "solar" && state.topic === t, () => setTopic(t, "solar")));
  const is = $("#indexStorage"); is.textContent = "";
  is.append(row("すべての蓄電池", storageN, state.cat === "storage" && !state.topic, () => setCat("storage"), "all"));
  for (const t of state.storageTopics) if (sc2[t]) is.append(row(t, sc2[t], state.cat === "storage" && state.topic === t, () => setTopic(t, "storage")));

  const sc = {}; for (const it of recent) sc[it.source] = (sc[it.source] || 0) + 1;
  const ul = $("#srcs"); ul.textContent = "";
  Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([s, n]) => {
    const li = el("li"); li.append(el("span", null, s), el("span", "c", `${n}件`)); ul.append(li);
  });
}

/* 全記事 */
function filtered(){
  const q = state.q.trim().toLowerCase();
  return state.items.filter(it =>
    (state.cat === "all" || it.categories.includes(state.cat)) &&
    (!state.topic || it[topicKey()] === state.topic) &&
    (!state.rel || it.type === "release") &&
    (!q || (it.title + " " + it.source + " " + (it.summary||"")).toLowerCase().includes(q)));
}
function render(){
  const f = !!isFiltered();
  $("#frontWrap").hidden = f;
  $("#listTitle").textContent = f ? "絞り込み結果" : "全記事";
  $("#listSub").textContent = f ? "" : "過去90日分";
  const list = $("#list"); list.textContent = "";
  const all = filtered();
  const label = [state.cat === "solar" ? "太陽光" : state.cat === "storage" ? "蓄電池" : "", state.topic, state.rel ? "プレスリリース" : "", state.q.trim() ? `「${state.q.trim()}」` : ""].filter(Boolean).join(" › ");
  $("#result").textContent = state.items.length ? `${all.length}件` + (label ? `　${label}` : "") : "";
  if (!all.length){
    list.append(el("p", "empty", state.items.length ? "条件に合う記事はありません。絞り込みを変えてください。" : "まだ記事がありません。初回の自動更新後に表示されます。"));
    return;
  }
  const perDay = {}; for (const it of all){ const k = dayKey(it.published); perDay[k] = (perDay[k] || 0) + 1; }
  const now = Date.now();
  let ul = null, cur = null;
  for (const it of all.slice(0, state.shown)){
    const k = dayKey(it.published);
    if (k !== cur){
      cur = k;
      const head = el("div", "day"); head.append(el("h3", null, dayLabel(k)), el("small", null, `${perDay[k]}件`));
      ul = el("ul", "list"); list.append(head, ul);
    }
    const li = el("li", "entry");
    const body = el("div");
    const a = link(it); a.append(el("span", "t", it.title));
    const meta = el("div", "meta");
    meta.append(kicker(it));
    if (isToday(it)) meta.append(el("span", "new", "NEW"));
    meta.append(el("span", null, it.source));
    if (it.type === "release"){
      meta.append(el("span", "rel", "プレスリリース"));
      if (it.company) meta.append(el("span", "company", it.company));
    }
    body.append(a, meta); li.append(body); ul.append(li);
  }
  if (all.length > state.shown){
    const w = el("div", "more-wrap");
    const b = el("button", "more", `続きを読む（残り${all.length - state.shown}件）`);
    b.onclick = () => { state.shown += PAGE; render(); };
    w.append(b); list.append(w);
  }
}
function renderTopics(){
  const box = $("#topics"); box.textContent = "";
  box.hidden = state.cat === "all";
  if (box.hidden) return;
  box.className = "subtabs " + state.cat;
  box.setAttribute("aria-label", state.cat === "solar" ? "太陽光の分類" : "蓄電池の分類");
  const key = topicKey(), list = state.cat === "solar" ? state.topics : state.storageTopics;
  const counts = {}; let total = 0;
  for (const it of state.items) if (it[key]){ counts[it[key]] = (counts[it[key]] || 0) + 1; total++; }
  const mk = (label, topic, n) => {
    const b = el("button"); b.setAttribute("aria-pressed", state.topic === topic);
    b.append(label, el("span", "c", n)); b.onclick = () => setTopic(topic, state.cat); return b;
  };
  box.append(mk("すべて", null, total));
  for (const t of list) if (counts[t]) box.append(mk(t, t, counts[t]));
}
function refresh(){ state.shown = PAGE; syncTabs(); renderTopics(); renderIndex(); render(); }
function syncTabs(){ document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.cat === state.cat)); }
function setCat(cat){ state.cat = cat; state.topic = null; refresh(); }
function setTopic(t, cat){ state.topic = t; if (cat) state.cat = cat; refresh(); }
// 操作バーが画面の一番上に来る位置へ移動（一面を隠したときは結果がすぐ下に出る）
function jump(){ window.scrollTo({ top: $(".ticker").getBoundingClientRect().bottom + scrollY, behavior: "smooth" }); }

/* メニュー */
const drawer = $("#drawer"), scrim = $("#scrim"), menuBtn = $("#menuBtn");
function openMenu(){
  drawer.classList.add("open"); scrim.classList.add("open");
  drawer.setAttribute("aria-hidden", "false"); menuBtn.setAttribute("aria-expanded", "true");
  setTimeout(() => $("#menuClose").focus(), 50);
}
function closeMenu(){
  if (!drawer.classList.contains("open")) return;
  drawer.classList.remove("open"); scrim.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true"); menuBtn.setAttribute("aria-expanded", "false");
  menuBtn.focus({ preventScroll: true });
}
menuBtn.addEventListener("click", openMenu);
$("#menuClose").addEventListener("click", closeMenu);
scrim.addEventListener("click", closeMenu);
document.addEventListener("keydown", e => { if (e.key === "Escape"){ closeMenu(); const g = $("#iosGuide"); if (g) g.hidden = true; } });

function header(updated){
  const n = new Date();
  $("#today").textContent = `${n.getFullYear()}年${n.getMonth()+1}月${n.getDate()}日（${WD[n.getDay()]}）`;
  $("#updated").textContent = updated ? `最終更新 ${updated.slice(11,16)}　毎日7時・11時・14時・17時更新` : "まだ更新されていません";
  const today = keyOf(n), week = within(7);
  $("#stToday").innerHTML = `${state.items.filter(it => dayKey(it.published) === today).length}<small>件</small>`;
  $("#stSolar").innerHTML = `${week.filter(it => it.categories.includes("solar")).length}<small>件</small>`;
  $("#stStorage").innerHTML = `${week.filter(it => it.categories.includes("storage")).length}<small>件</small>`;
  $("#stSrc").innerHTML = `${new Set(state.items.map(it => it.source)).size}<small>媒体</small>`;
}

document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => setCat(b.dataset.cat)));
document.querySelectorAll("[data-jump]").forEach(b => b.addEventListener("click", () => { setCat(b.dataset.jump); jump(); }));
$("#relOnly").addEventListener("click", e => { state.rel = !state.rel; e.currentTarget.setAttribute("aria-pressed", state.rel); refresh(); });
let timer; $("#q").addEventListener("input", e => {
  clearTimeout(timer); timer = setTimeout(() => { state.q = e.target.value; state.shown = PAGE; render(); }, 150);
});

// 記事データを読み込む。最終更新（updated_at）が前回と同じなら何もしない
let lastUpdated = null;
function loadData(){
  return fetch("data.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.json()).then(d => {
    if (lastUpdated !== null && d.updated_at === lastUpdated) return;
    lastUpdated = d.updated_at || "";
    // 取得した時刻ではなく、配信（リリース）時刻の新しい順に並べ直す
    state.items = (d.items || []).sort((x, y) => new Date(y.published) - new Date(x.published));
    state.topics = d.solar_topics || [...new Set(state.items.map(it => it.topic).filter(Boolean))];
    state.storageTopics = d.storage_topics || [...new Set(state.items.map(it => it.storage_topic).filter(Boolean))];
    header(d.updated_at); renderFront(); renderChart(); renderTopics(); renderIndex(); render();
  }).catch(() => {
    if (lastUpdated === null) $("#updated").textContent = "データを読み込めませんでした。時間をおいて再読み込みしてください。";
  });
}
loadData();
// ホーム画面のアプリは開き直しても前の画面のまま残るため、
// 画面に戻ったときと5分ごとに data.json を確かめ、更新があればその場で差し替える
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadData(); });
window.addEventListener("focus", () => loadData());
setInterval(() => { if (document.visibilityState === "visible") loadData(); }, 5 * 60 * 1000);

/* アプリとして追加（①メニューの一番下 ②一面と全記事の間のお知らせ） */
const store = {
  get(k){ try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch {} },
};
const isStandalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isPhone = /android|iphone|ipod/i.test(navigator.userAgent) || matchMedia("(max-width: 700px)").matches;
let installEvent = null;

function refreshInstall(){
  const can = !isStandalone && (installEvent || isIOS);
  $("#installMenu").hidden = !can;
  // お知らせはスマホで表示し、×を押した人には次から出さない
  $("#installCard").hidden = !(can && isPhone && !store.get("installDismissed"));
}
async function install(){
  if (installEvent){
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;  // 一度使った確認画面は再利用できない
    refreshInstall();
  } else if (isIOS){
    closeMenu();
    $("#iosGuide").hidden = false;
  }
}
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvent = e; refreshInstall(); });
window.addEventListener("appinstalled", () => { installEvent = null; store.set("installDismissed", "1"); refreshInstall(); });
document.querySelectorAll("[data-install]").forEach(b => b.addEventListener("click", install));
$("#installDismiss").addEventListener("click", () => { store.set("installDismissed", "1"); refreshInstall(); });
$("#iosGuideClose").addEventListener("click", () => { $("#iosGuide").hidden = true; });
$("#iosGuide").addEventListener("click", e => { if (e.target.id === "iosGuide") $("#iosGuide").hidden = true; });
refreshInstall();

// ホーム画面アプリ用の補助スクリプト
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
