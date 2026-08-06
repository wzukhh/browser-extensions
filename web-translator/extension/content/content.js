// src/lib/granularity.js
var GRANULARITY = {
  WORD: "word",
  PHRASE: "phrase",
  SENTENCE: "sentence",
  PARAGRAPH: "paragraph"
};
function normalizeText(raw) {
  return (raw || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function detectGranularity(text) {
  const t = normalizeText(text);
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  if (words.length === 1) return GRANULARITY.WORD;
  if (words.length === 2) return GRANULARITY.PHRASE;
  const sentenceCount = (t.match(/[.!?…]+(\s|$)/g) || []).length + (t.includes("\n") ? 0 : 1);
  const isMultiLine = t.includes("\n");
  if (!isMultiLine && sentenceCount <= 4) return GRANULARITY.SENTENCE;
  return GRANULARITY.PARAGRAPH;
}

// src/lib/icons.js
var NS = "http://www.w3.org/2000/svg";
var COPY_ICON = [{ "d": "M209.728 0m128 0l558.272 0q128 0 128 128l0 644.64q0 128-128 128l-558.272 0q-128 0-128-128l0-644.64q0-128 128-128Z", "fill": "#2D6AEA" }, { "d": "M0 172.736m128 0l521.248 0q128 0 128 128l0 595.264q0 128-128 128l-521.248 0q-128 0-128-128l0-595.264q0-128 128-128Z", "fill": "#CEDBF8" }, { "d": "M259.072 577.152m32 0l193.472 0q32 0 32 32l0 0q0 32-32 32l-193.472 0q-32 0-32-32l0 0q0-32 32-32Z", "fill": "#FFFFFF" }, { "d": "M355.072 481.152m32 0l0 0q32 0 32 32l0 167.712q0 32-32 32l0 0q-32 0-32-32l0-167.712q0-32 32-32Z", "fill": "#FFFFFF" }];
var PIN_ICON = [{ "d": "M831.440849 448.719101a244.302622 244.302622 0 0 1-34.389014-2.556804l-118.891386 116.334582a413.339326 413.339326 0 0 1-97.797753 437.213483l-41.963545-48.579276-193.166542-211.57553L32.4396 1024H16.459575a15.980025 15.980025 0 0 1-15.980025-15.980025v-15.980025l286.969289-315.765293-246.284145-269.423221-18.313109-22.052435a413.658926 413.658926 0 0 1 438.779526-57.52809l115.31186-112.818976a246.188265 246.188265 0 0 1-1.086642-21.413233 255.232959 255.232959 0 0 1 88.401499-193.038702L671.640599 1.278402l351.560549 351.560549v6.07241a257.598002 257.598002 0 0 1-191.760299 89.80774zM663.394906 102.27216A185.65593 185.65593 0 0 0 639.680549 193.038702a183.067166 183.067166 0 0 0 7.254932 49.857678l-168.621224 166.192259a349.738826 349.738826 0 0 0-359.646442-12.464419L580.874057 899.036205a350.378027 350.378027 0 0 0 20.230712-354.117354l157.786766-175.460674a183.546567 183.546567 0 0 0 72.549314 15.340824 188.148814 188.148814 0 0 0 90.510861-23.970037z", "fill": "#6EA3E5" }];
var TRANSLATE_ICON = [{ "d": "M397.098798 9.33046l23.267096 42.164231c2.208603 4.015641 3.354241 7.629718 3.425106 10.865852 1.653499 114.80009-4.015641 232.316644 2.598356 346.289985 2.055063 35.668341-11.810709 64.793549-41.573696 87.399245-174.798492 1.33461-280.811415 1.33461-318.06239 0-40.98316-1.535392-57.518152-36.140769-58.344902-74.998001C6.684004 325.148816 6.365115 211.565228 7.463511 80.31282c0.472428-49.250656 25.747345-70.864253 75.234216-71.691003 104.725556-1.736174 209.521976-1.49996 314.401071 0.708643z m-99.446169 321.487496a6.259676 6.259676 0 0 1-1.889714-8.858032 326.022808 326.022808 0 0 0 50.667941-121.886515c0.82675-4.216423 3.791238-7.239965 6.968319-7.086426l16.180671 0.82675c5.598276 0.307078 9.212353 0.035432 10.865852-0.82675 27.637059-14.019311 30.518872-31.534593 8.621817-52.557654a15.731864 15.731864 0 0 0-10.393423-4.251855l-90.351923-2.716464a6.200622 6.200622 0 0 1-6.023462-6.023461c-0.625968-40.002871-18.023142-51.104937-52.203333-33.306199a11.125688 11.125688 0 0 0-5.669141 8.739924l-3.070784 25.274917a6.909265 6.909265 0 0 1-6.732104 6.023462l-89.052745 2.244035c-4.180991 0.070864-7.960418 1.417285-10.629638 3.779427-19.99553 17.397174-19.133348 33.778627 2.598356 49.132549 3.011731 2.066874 6.802968 3.188891 10.865852 3.188891l145.035505-0.118107c3.803048 0 7.393504 1.759796 9.590296 4.724283 2.208603 2.952677 2.716463 6.720293 1.393664 10.039103l-27.400845 68.14779a3.921155 3.921155 0 0 1-3.106216 2.385763 4.747905 4.747905 0 0 1-3.980209-1.322799c-30.235415-28.428376-49.368763-22.251376-57.400046 18.542813-0.519671 2.362142 0.708643 6.023462 3.306999 9.802888l12.283137 17.952278a5.078605 5.078605 0 0 1 0.49605 4.488069 7.558854 7.558854 0 0 1-3.33062 4.015641 298.314885 298.314885 0 0 1-90.233816 35.195913 12.176841 12.176841 0 0 0-8.621817 6.49589c-17.243635 36.613198 11.220173 50.667941 42.872873 43.699623 34.806159-7.724204 67.439148-21.696272 97.910777-41.928017a8.444657 8.444657 0 0 1 9.684781 0.118107 279.087051 279.087051 0 0 0 98.146991 41.80991c33.66052 7.204532 63.187293-12.046923 38.621018-48.069586a13.629558 13.629558 0 0 0-9.33046-5.66914 229.186806 229.186806 0 0 1-86.690603-32.007021z", "fill": "#6E80D5" }, { "d": "M397.098798 9.33046c62.596757-13.818529 99.682383 14.409065 99.80049 77.360143 0.236214 114.398526 0.200782 228.336435-0.118107 341.801916-0.236214 65.31322-54.919796 72.63586-111.965521 67.557254 29.762986-22.605697 43.628759-51.730905 41.573696-87.399245-6.613997-113.973341-0.944857-231.489894-2.598356-346.289985-0.070864-3.236134-1.216503-6.850211-3.425106-10.865852L397.098798 9.33046z", "fill": "#5169CC" }, { "d": "M940.391407 312.038929a884.102425 884.102425 0 0 1-65.077006 144.799291 2053.527955 2053.527955 0 0 1-69.092647-38.975339c-39.683982-23.385204-19.251455-76.887715 20.904954-66.258077 8.432846 2.279467 10.511531-0.401564 6.259676-8.031282-53.691483-95.513203-133.295661-157.247778-238.812534-185.191916a18.767216 18.767216 0 0 1-9.448567-5.905354c-23.148989-27.802409-17.786928-48.624689 16.062564-62.47865 3.366052-1.452717 7.287207-1.653499 11.102067-0.590536 128.665863 34.014842 226.293182 113.418237 292.90558 238.221999a3.779427 3.779427 0 0 0 6.613997 0.236214c4.724284-7.487989 14.255526-12.755566 28.581916-15.82635z", "fill": "#28D1B3" }, { "d": "M940.391407 312.038929c22.369483-2.291278 35.786448 9.047003 40.274517 34.014842 0.696832 3.67313 0.118107 7.653339-1.653499 11.33828-23.030882 48.305799-46.6523 130.62644-103.698024 99.446169a884.102425 884.102425 0 0 0 65.077006-144.799291z", "fill": "#22B69F" }, { "d": "M903.778209 530.418936c27.011091 16.298778 40.711514 40.428057 41.101267 72.399646 1.417285 118.343303 1.346421 236.722038-0.236214 355.148016-0.153539 14.798818-10.865852 33.66052-32.125128 56.573296-164.168854 4.16918-276.087131 4.086505-335.778454-0.236214-49.604977-3.66132-49.250656-73.462609-49.486871-107.359344a8150.865474 8150.865474 0 0 1 2.125928-270.465234c1.535392-62.47865 0.354321-106.650701 73.344502-107.359344 100.79259-0.873992 201.136372-0.436996 301.05497 1.299178z m-93.068386 164.523175l68.14779-1.181071a11.373713 11.373713 0 0 0 9.33046-4.960497c24.920596-38.502911 3.425106-60.352722-37.558054-59.880295-56.844942 0.708643-113.689884 1.015721-170.546636 0.944857-25.81821-0.082675-34.132949 17.007421-24.920596 51.258477 1.889713 7.00375 7.854121 11.905195 14.645279 12.046923l63.187292 1.653499a6.023462 6.023462 0 0 1 6.023462 5.905355 7340.473683 7340.473683 0 0 0 2.244035 190.742948c0.472428 21.412815 16.617667 27.82603 48.423906 19.251456a19.723884 19.723884 0 0 0 14.409065-18.897135l0.708642-190.861055a6.023462 6.023462 0 0 1 5.905355-6.023462z", "fill": "#F1EFF2" }, { "d": "M903.778209 530.418936c67.675362-4.842391 112.79227-1.771606 112.674163 77.005822 0 97.709995 0.236214 195.419989 0.708642 293.141795 0.354321 77.950679-9.684781 132.27994-104.64288 113.973341 21.259276-22.912775 31.971589-41.774477 32.125128-56.573296 1.582635-118.425978 1.653499-236.804713 0.236214-355.148016-0.389753-31.971589-14.090176-56.100867-41.101267-72.399646z", "fill": "#DDEBF0" }, { "d": "M223.599484 671.556908c-41.018592-37.168301-87.670892-63.187293-139.9569-78.068786 20.550633-66.13997 88.46221-15.590136 131.807511 10.039102 31.6527 18.66092 36.967519 42.518552 8.149389 68.029684z", "fill": "#22B69F" }, { "d": "M83.642584 593.488122c52.286008 14.881493 98.938308 40.900485 139.9569 78.068786l-28.109487 5.196712a4.216423 4.216423 0 0 0-3.070785 2.279466 3.944777 3.944777 0 0 0 0.118107 3.743995c50.47897 89.596038 124.331333 149.12201 221.568899 178.577918 27.282738 8.267496 51.022262 24.802489 34.251056 55.156011-9.365892 17.007421-23.385204 22.747425-42.046124 17.243635-132.587018-39.613118-228.182896-118.744867-286.764011-237.395249a4.369962 4.369962 0 0 0-6.850212-1.299178c-31.48735 28.263026-54.010372 23.101747-67.557254-15.472028a14.231904 14.231904 0 0 1 0.708642-11.102067l37.794269-74.998001z", "fill": "#28D1B3" }, { "d": "M297.652629 330.817956a229.186806 229.186806 0 0 0 86.690603 32.007021c3.921155 0.590535 7.299018 2.645599 9.33046 5.66914 24.566274 36.022662-4.960498 55.274118-38.621018 48.069586a279.087051 279.087051 0 0 1-98.146991-41.80991 8.444657 8.444657 0 0 0-9.684781-0.118107c-30.471629 20.231744-63.104618 34.203813-97.910777 41.928017-31.6527 6.968318-60.116508-7.086425-42.872873-43.699623 1.570824-3.283377 4.759716-5.692762 8.621817-6.49589a298.314885 298.314885 0 0 0 90.233816-35.195913 7.558854 7.558854 0 0 0 3.33062-4.015641 5.078605 5.078605 0 0 0-0.49605-4.488069l-12.283137-17.952278c-2.598356-3.779427-3.82667-7.440747-3.306999-9.802888 8.031282-40.794189 27.16463-46.971189 57.400046-18.542813 1.062964 1.039342 2.562924 1.535392 3.980209 1.322799a3.921155 3.921155 0 0 0 3.106216-2.385763l27.400845-68.14779a10.32256 10.32256 0 0 0-1.393664-10.039103c-2.196792-2.964488-5.787247-4.724284-9.590296-4.724283l-145.035505 0.118107c-4.062884 0-7.854121-1.122017-10.865852-3.188891-21.731704-15.353922-22.593886-31.735375-2.598356-49.132549 2.66922-2.362142 6.448647-3.708563 10.629638-3.779427l89.052745-2.244035a6.909265 6.909265 0 0 0 6.732104-6.023462l3.070784-25.274917a11.125688 11.125688 0 0 1 5.669141-8.739924c34.180192-17.798738 51.577366-6.696672 52.203333 33.306199 0.070864 3.247945 2.716463 5.905354 6.023462 6.023461l90.351923 2.716464c4.027452 0.153539 7.736014 1.66531 10.393423 4.251855 21.897054 21.023062 19.015241 38.538343-8.621817 52.557654-1.653499 0.862182-5.267576 1.133828-10.865852 0.82675l-16.180671-0.82675c-3.177081-0.153539-6.141569 2.870002-6.968319 7.086426a326.022808 326.022808 0 0 1-50.667941 121.886515 6.259676 6.259676 0 0 0 1.889714 8.858032z", "fill": "#F1EFF2" }, { "d": "M804.804468 700.965573l-0.708642 190.861055a19.723884 19.723884 0 0 1-14.409065 18.897135c-31.806239 8.574575-47.951478 2.16136-48.423906-19.251456a7340.473683 7340.473683 0 0 1-2.244035-190.742948 6.023462 6.023462 0 0 0-6.023462-5.905355l-63.187292-1.653499c-6.791158-0.141729-12.755566-5.043173-14.645279-12.046923-9.212353-34.251056-0.897614-51.341152 24.920596-51.258477 56.856753 0.070864 113.701695-0.236214 170.546636-0.944857 40.98316-0.472428 62.47865 21.377383 37.558054 59.880295a11.373713 11.373713 0 0 1-9.33046 4.960497l-68.14779 1.181071a6.023462 6.023462 0 0 0-5.905355 6.023462z", "fill": "#7A6D79" }];
function svgIcon(paths, size = 14) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 1024 1024");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("class", "wt-icon");
  svg.setAttribute("aria-hidden", "true");
  for (const p of paths) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", p.d);
    if (p.fill) path.setAttribute("fill", p.fill);
    svg.appendChild(path);
  }
  return svg;
}

// src/lib/renderer.js
var WIDTH = 380;
var BADGE_LABELS = {
  word: "\u5355\u8BCD",
  phrase: "\u77ED\u8BED",
  sentence: "\u53E5\u5B50",
  paragraph: "\u6BB5\u843D"
};
var STYLE = `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; }
.wt-card {
  width: ${WIDTH}px;
  max-height: 480px;
  overflow-y: auto;
  background: #ffffff;
  color: #1f2328;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.12);
  border: 1px solid rgba(0,0,0,.08);
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  line-height: 1.55;
}
.wt-card ::selection { background: #cfe4ff; }
.wt-header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  position: sticky; top: 0; background: #fff; border-radius: 12px 12px 0 0;
  z-index: 1; /* sticky \u65F6\u76D6\u4F4F\u6EDA\u52A8\u4E0A\u6765\u7684\u6B63\u6587\uFF0C\u907F\u514D\u6587\u5B57\u91CD\u53E0 */
  user-select: none; cursor: grab;
}
.wt-badge {
  font-size: 11px; font-weight: 600; color: #fff;
  background: #4a6cf7; border-radius: 4px; padding: 1px 6px;
  flex-shrink: 0;
}
.wt-src {
  flex: 1; font-size: 12px; color: #57606a;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wt-btn {
  border: none; background: transparent; cursor: pointer;
  font-size: 13px; color: #8b949e; padding: 2px 4px; border-radius: 4px;
  line-height: 1; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.wt-btn:hover { background: #f0f2f5; color: #1f2328; }
.wt-btn:focus-visible, .wt-more-btn:focus-visible { outline: 2px solid #4a6cf7; outline-offset: 1px; }
.wt-btn.wt-pinned { color: #4a6cf7; }
.wt-body { padding: 10px 12px 12px; }
.wt-loading { display: flex; align-items: center; gap: 10px; padding: 14px 0; color: #57606a; }
.wt-spinner {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid #e5e9f0; border-top-color: #4a6cf7;
  animation: wt-spin .8s linear infinite;
}
@keyframes wt-spin { to { transform: rotate(360deg); } }
.wt-error { color: #cf222e; padding: 6px 0; }
.wt-error .wt-retry { color: #4a6cf7; cursor: pointer; text-decoration: underline; margin-left: 8px; }

/* word */
.wt-phonetic { color: #6e7781; font-size: 12px; margin-bottom: 6px; }
.wt-pos-item { margin-bottom: 8px; }
.wt-pos-tag {
  display: inline-block; font-size: 11px; font-weight: 700; color: #4a6cf7;
  background: #eef1fe; border-radius: 4px; padding: 1px 5px; margin-right: 6px;
}
.wt-def { color: #1f2328; }
.wt-example { color: #57606a; font-size: 12px; font-style: italic; margin-top: 2px; }
.wt-example b { font-weight: 700; color: #4a6cf7; font-style: normal; }
.wt-example-zh { color: #24292f; font-style: normal; }

/* phrase / sentence */
.wt-translation { font-size: 15px; font-weight: 600; color: #0b1220; margin-bottom: 8px; }
.wt-explanation { color: #24292f; margin-bottom: 8px; }

/* lists */
.wt-section { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e5e9f0; }
.wt-section-title {
  font-size: 11px; font-weight: 700; color: #8b949e;
  text-transform: uppercase; letter-spacing: .4px; margin-bottom: 4px;
}
.wt-ul { list-style: none; }
.wt-ul li { padding: 3px 0 3px 14px; position: relative; color: #24292f; }
.wt-ul li::before {
  content: "\u2022"; position: absolute; left: 2px; color: #4a6cf7; font-weight: 700;
}
.wt-vocab { display: flex; gap: 8px; align-items: baseline; }
.wt-vocab .w { font-weight: 600; color: #0b1220; flex-shrink: 0; }
.wt-vocab .ph { color: #6e7781; font-size: 12px; flex-shrink: 0; }

/* paragraph */
.wt-bg-note {
  background: #fff8e6; border-radius: 6px; padding: 6px 8px;
  color: #7a5b00; font-size: 12px; line-height: 1.5;
}

/* more / collapse */
.wt-more-btn {
  display: block; width: 100%; margin-top: 10px; padding: 6px 0;
  border: none; background: #f6f8fa; color: #4a6cf7;
  border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;
}
.wt-more-btn:hover { background: #eef1fe; }
.wt-more { display: none; }
.wt-more.wt-open { display: block; }

/* footer */
.wt-footer {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  padding: 6px 12px; border-top: 1px solid #f0f0f0;
  color: #8b949e; font-size: 11px;
}
.wt-copy-result.wt-copy-ok { color: #1a7f37; }
.wt-copy-result.wt-copy-err { color: #cf222e; }

/* \u5E95\u90E8\u6E10\u9690\uFF1A\u5185\u5BB9\u53EF\u6EDA\u52A8\u4E14\u672A\u6EDA\u5230\u5E95\u65F6\u63D0\u793A\u4E0B\u65B9\u8FD8\u6709\u5185\u5BB9 */
.wt-fade {
  position: sticky; bottom: -1px; height: 22px; margin-top: -22px;
  background: linear-gradient(to bottom, rgba(255,255,255,0), #fff);
  pointer-events: none; opacity: 0; transition: opacity .2s;
}
.wt-fade.wt-fade-on { opacity: 1; }
`;
var TRIGGER_STYLE = `
:host { all: initial; display: inline-block; }
.wt-trigger {
  display: flex; align-items: center; gap: 6px;
  width: max-content; /* \u5BBD\u5EA6=\u5185\u5BB9\u5BBD\uFF0C\u907F\u514D\u5757\u7EA7\u6309\u94AE\u6491\u6EE1\u6574\u884C\u5BFC\u81F4 offsetWidth \u6D4B\u6210\u6574\u9875\u5BBD */
  padding: 7px 14px;
  background: #4a6cf7; color: #fff;
  border: none;
  border-radius: 999px;
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px; font-weight: 600; line-height: 1;
  box-shadow: 0 4px 16px rgba(0,0,0,.22), 0 1px 4px rgba(0,0,0,.12);
  cursor: pointer; user-select: none; white-space: nowrap;
  transition: background .15s, transform .12s ease, box-shadow .15s;
}
.wt-trigger:hover { background: #3b5de7; }
.wt-trigger:active { transform: scale(.96); box-shadow: 0 2px 8px rgba(0,0,0,.18); }
.wt-trigger:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
`;
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== void 0 && text !== null) node.textContent = text;
  return node;
}
function section(title, ...children) {
  const s = el("div", "wt-section");
  s.appendChild(el("div", "wt-section-title", title));
  for (const c of children) s.appendChild(c);
  return s;
}
function ulList(rows) {
  const ul = el("ul", "wt-ul");
  for (const row of rows) {
    const li = document.createElement("li");
    if (typeof row === "string") {
      li.textContent = row;
    } else {
      if (row.cls) li.className = row.cls;
      for (const part of row.parts || []) {
        if (part.sep) li.appendChild(document.createTextNode(part.sep));
        const node = part.bold ? document.createElement("b") : document.createElement("span");
        if (part.cls) node.className = part.cls;
        if (part.text !== void 0) node.textContent = part.text;
        li.appendChild(node);
      }
    }
    ul.appendChild(li);
  }
  return ul;
}
function createTrigger({ onClick }) {
  const host = document.createElement("div");
  host.id = "wt-trigger-host";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = TRIGGER_STYLE;
  shadow.appendChild(style);
  const btn = el("button", "wt-trigger");
  btn.type = "button";
  btn.setAttribute("aria-label", "\u7FFB\u8BD1\u9009\u4E2D\u7684\u6587\u672C");
  btn.appendChild(svgIcon(TRANSLATE_ICON, 16));
  btn.appendChild(el("span", null, "\u7FFB\u8BD1"));
  shadow.appendChild(btn);
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.();
  });
  return { root: host, el: btn };
}
function createCard(opts) {
  const host = document.createElement("div");
  host.id = "wt-card-host";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLE;
  shadow.appendChild(style);
  const card2 = el("div", "wt-card");
  shadow.appendChild(card2);
  const { sourceText, onClose, onPin, onRetry, onMove } = opts;
  let granularity = opts.granularity;
  const header = el("div", "wt-header");
  header.appendChild(el("span", "wt-badge", BADGE_LABELS[granularity] || ""));
  const srcEl = el("span", "wt-src", sourceText);
  srcEl.title = sourceText;
  header.appendChild(srcEl);
  const pinBtn = el("button", "wt-btn wt-pin");
  pinBtn.type = "button";
  pinBtn.title = "\u56FA\u5B9A";
  pinBtn.setAttribute("aria-label", "\u56FA\u5B9A\u5361\u7247");
  pinBtn.appendChild(svgIcon(PIN_ICON, 14));
  const copyBtn = el("button", "wt-btn wt-copy-btn");
  copyBtn.type = "button";
  copyBtn.title = "\u590D\u5236\u8BD1\u6587";
  copyBtn.setAttribute("aria-label", "\u590D\u5236\u8BD1\u6587");
  copyBtn.appendChild(svgIcon(COPY_ICON, 14));
  const closeBtn = el("button", "wt-btn wt-close", "\u2715");
  closeBtn.type = "button";
  closeBtn.title = "\u5173\u95ED (Esc)";
  closeBtn.setAttribute("aria-label", "\u5173\u95ED\u5361\u7247");
  header.append(pinBtn, copyBtn, closeBtn);
  const body = el("div", "wt-body");
  const fade = el("div", "wt-fade");
  const footer = el("div", "wt-footer");
  footer.appendChild(el("span", null, "\u5212\u8BCD\u7FFB\u8BD1"));
  const copyResult = el("span", "wt-copy-result");
  footer.appendChild(copyResult);
  const author = el("span", "wt-author", "\u4F5C\u8005 wzukhh | wzukhh@163.com");
  if (opts.showAuthor === false) author.style.display = "none";
  footer.appendChild(author);
  card2.append(header, body, fade, footer);
  function updateFade() {
    const scrollable = card2.scrollHeight > card2.clientHeight + 4;
    const atBottom = card2.scrollTop + card2.clientHeight >= card2.scrollHeight - 8;
    fade.classList.toggle("wt-fade-on", scrollable && !atBottom);
  }
  card2.addEventListener("scroll", updateFade, { passive: true });
  let pinned2 = false;
  let lastData = null;
  const setPinned = (force) => {
    pinned2 = typeof force === "boolean" ? force : !pinned2;
    pinBtn.classList.toggle("wt-pinned", pinned2);
    onPin?.(pinned2);
  };
  closeBtn.addEventListener("click", () => onClose?.());
  pinBtn.addEventListener("click", () => setPinned());
  copyBtn.addEventListener("click", async () => {
    const clear = () => {
      copyResult.textContent = "";
      copyResult.className = "wt-copy-result";
    };
    try {
      await navigator.clipboard.writeText(
        buildCardMarkdown(sourceText, lastData?.type || granularity, lastData)
      );
      copyResult.textContent = "\u5DF2\u590D\u5236";
      copyResult.classList.add("wt-copy-ok");
    } catch {
      copyResult.textContent = "\u590D\u5236\u5931\u8D25";
      copyResult.classList.add("wt-copy-err");
    }
    setTimeout(clear, 1500);
  });
  let dragState = null;
  header.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".wt-btn")) return;
    const r = host.getBoundingClientRect();
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: r.left,
      origTop: r.top
    };
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragState) return;
    const x = Math.max(
      0,
      Math.min(
        dragState.origLeft + e.clientX - dragState.startX,
        window.innerWidth - host.offsetWidth
      )
    );
    const y = Math.max(
      0,
      Math.min(
        dragState.origTop + e.clientY - dragState.startY,
        window.innerHeight - host.offsetHeight
      )
    );
    host.style.left = `${x}px`;
    host.style.top = `${y}px`;
    onMove?.();
  });
  window.addEventListener("mouseup", () => {
    dragState = null;
  });
  return {
    root: host,
    el: card2,
    /** 切换页脚作者信息显示 */
    setShowAuthor(show) {
      author.style.display = show ? "" : "none";
    },
    /** 更新粒度与原文（复用卡片时调用） */
    setContext(g, source) {
      granularity = g;
      lastData = null;
      card2.querySelector(".wt-badge").textContent = BADGE_LABELS[g] || "";
      srcEl.textContent = source;
      srcEl.title = source;
    },
    updateLoading() {
      lastData = null;
      body.replaceChildren();
      const loading = el("div", "wt-loading");
      loading.appendChild(el("div", "wt-spinner"));
      loading.appendChild(el("span", null, "\u6B63\u5728\u7FFB\u8BD1\u2026"));
      body.appendChild(loading);
      updateFade();
    },
    renderResult(data) {
      lastData = data;
      const type = normalizeType(data?.type, granularity);
      card2.querySelector(".wt-badge").textContent = BADGE_LABELS[type] || "";
      const frag = renderByGranularity(type, data);
      body.replaceChildren(frag);
      updateFade();
    },
    renderError(message) {
      body.replaceChildren();
      const err = el("div", "wt-error");
      err.appendChild(document.createTextNode(`\u26A0\uFE0F ${message}`));
      const retry = el("span", "wt-retry", "\u91CD\u8BD5");
      retry.addEventListener("click", () => onRetry?.());
      err.appendChild(retry);
      body.appendChild(err);
      updateFade();
    }
  };
}
function normalizeType(type, fallback) {
  const valid = [GRANULARITY.WORD, GRANULARITY.PHRASE, GRANULARITY.SENTENCE];
  if (valid.includes(type)) return type;
  if (valid.includes(fallback)) return fallback;
  return GRANULARITY.SENTENCE;
}
function renderByGranularity(granularity, d) {
  const wrap = document.createElement("div");
  if (granularity === GRANULARITY.WORD) return renderWord(wrap, d);
  if (granularity === GRANULARITY.PHRASE) return renderPhrase(wrap, d);
  if (granularity === GRANULARITY.SENTENCE) return renderSentence(wrap, d);
  return wrap;
}
function renderWord(wrap, d) {
  if (d.phonetic) wrap.appendChild(el("div", "wt-phonetic", d.phonetic));
  for (const item of d.pos || []) {
    const row = el("div", "wt-pos-item");
    row.appendChild(el("span", "wt-pos-tag", item.pos || ""));
    row.appendChild(el("span", "wt-def", item.def || ""));
    if (item.example) {
      const ex = el("div", "wt-example");
      ex.appendChild(document.createTextNode("e.g. "));
      appendFormatted(ex, item.example);
      if (item.exampleZh) {
        ex.appendChild(document.createTextNode(" \u2014\u2014 "));
        ex.appendChild(el("span", "wt-example-zh", item.exampleZh));
      }
      row.appendChild(ex);
    }
    wrap.appendChild(row);
  }
  const extra = [];
  if (d.roots) extra.push(section("\u8BCD\u6839\u8BCD\u7F00", el("div", null, d.roots)));
  if (d.memory) extra.push(section("\u8BB0\u5FC6\u70B9", el("div", null, d.memory)));
  appendMore(wrap, extra);
  return wrap;
}
function renderPhrase(wrap, d) {
  wrap.appendChild(el("div", "wt-translation", d.translation || ""));
  if (d.explanation)
    wrap.appendChild(el("div", "wt-explanation", d.explanation));
  const extra = [];
  if (d.examples?.length) extra.push(section("\u4F8B\u53E5", ulList(d.examples)));
  if (d.usage) extra.push(section("\u4F7F\u7528\u573A\u666F", el("div", null, d.usage)));
  appendMore(wrap, extra);
  return wrap;
}
function renderSentence(wrap, d) {
  wrap.appendChild(el("div", "wt-translation", d.translation || ""));
  if (d.tone) wrap.appendChild(el("div", "wt-explanation", d.tone));
  const extra = [];
  if (d.grammar?.length) extra.push(section("\u8BED\u6CD5\u6279\u6CE8", ulList(d.grammar)));
  if (d.vocab?.length) {
    extra.push(
      section(
        "\u751F\u8BCD",
        ulList(
          d.vocab.map((v) => ({
            cls: "wt-vocab",
            parts: [
              { cls: "w", text: v.word || "" },
              ...v.phonetic ? [{ cls: "ph", text: v.phonetic }] : [],
              { sep: " \u2014 ", text: v.meaning || "" }
            ]
          }))
        )
      )
    );
  }
  const phrases = d.phrases?.length ? d.phrases : d.idioms;
  if (phrases?.length) {
    extra.push(
      section(
        "\u77ED\u8BED\u642D\u914D",
        ulList(
          phrases.map((p) => ({
            parts: [
              { bold: true, text: p.phrase || "" },
              { sep: " \u2014 ", text: p.meaning || "" }
            ]
          }))
        )
      )
    );
  }
  if (d.background) {
    extra.push(
      section("\u80CC\u666F\u77E5\u8BC6", el("div", "wt-bg-note", `\u{1F4A1} ${d.background}`))
    );
  }
  appendMore(wrap, extra);
  return wrap;
}
function appendMore(wrap, sections) {
  if (!sections?.length) return;
  const btn = el("button", "wt-more-btn", "\u6536\u8D77 \u25B4");
  const more = el("div", "wt-more wt-open");
  for (const s of sections) more.appendChild(s);
  btn.addEventListener("click", () => {
    const open = more.classList.toggle("wt-open");
    btn.textContent = open ? "\u6536\u8D77 \u25B4" : "\u66F4\u591A \u25BE";
  });
  wrap.appendChild(btn);
  wrap.appendChild(more);
}
function appendFormatted(parent, text) {
  const parts = String(text || "").split(/\*\*(.+?)\*\*/g);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    if (i % 2 === 1) {
      const b = document.createElement("b");
      b.textContent = part;
      parent.appendChild(b);
    } else {
      parent.appendChild(document.createTextNode(part));
    }
  }
}
function buildCardMarkdown(sourceText, granularity, d) {
  const badge = BADGE_LABELS[granularity] || "";
  const lines = [`# ${badge} \xB7 ${sourceText}`];
  if (!d) return lines.join("\n");
  if (granularity === GRANULARITY.WORD) {
    if (d.phonetic) lines.push(`
**\u97F3\u6807**\uFF1A${d.phonetic}`);
    for (const item of d.pos || []) {
      lines.push(`
**${item.pos || ""}** ${item.def || ""}`);
      if (item.example) {
        lines.push(
          `> \u4F8B\uFF1A${item.example}${item.exampleZh ? ` \u2014\u2014 ${item.exampleZh}` : ""}`
        );
      }
    }
    if (d.roots) lines.push(`
**\u8BCD\u6839\u8BCD\u7F00**\uFF1A${d.roots}`);
    if (d.memory) lines.push(`
**\u8BB0\u5FC6\u70B9**\uFF1A${d.memory}`);
  } else if (granularity === GRANULARITY.PHRASE) {
    lines.push(`
**\u542B\u4E49**\uFF1A${d.translation || ""}`);
    if (d.explanation) lines.push(`**\u89E3\u91CA**\uFF1A${d.explanation}`);
    if (d.examples?.length) {
      lines.push("\n**\u4F8B\u53E5**\uFF1A");
      for (const e of d.examples) lines.push(`- ${e}`);
    }
    if (d.usage) lines.push(`
**\u4F7F\u7528\u573A\u666F**\uFF1A${d.usage}`);
  } else if (granularity === GRANULARITY.SENTENCE) {
    lines.push(`
**\u7FFB\u8BD1**\uFF1A${d.translation || ""}`);
    if (d.tone) lines.push(`**\u8BED\u6C14**\uFF1A${d.tone}`);
    if (d.grammar?.length) {
      lines.push("\n**\u8BED\u6CD5\u6279\u6CE8**\uFF1A");
      for (const g of d.grammar) lines.push(`- ${g}`);
    }
    if (d.vocab?.length) {
      lines.push("\n**\u751F\u8BCD**\uFF1A");
      for (const v of d.vocab)
        lines.push(
          `- **${v.word || ""}**${v.phonetic ? ` ${v.phonetic}` : ""} \u2014 ${v.meaning || ""}`
        );
    }
    const phrasesList = d.phrases?.length ? d.phrases : d.idioms;
    if (phrasesList?.length) {
      lines.push("\n**\u77ED\u8BED\u642D\u914D**\uFF1A");
      for (const p of phrasesList)
        lines.push(`- **${p.phrase || ""}** \u2014 ${p.meaning || ""}`);
    }
    if (d.background) lines.push(`
**\u80CC\u666F\u77E5\u8BC6**\uFF1A\u{1F4A1} ${d.background}`);
  }
  return lines.join("\n");
}

// src/content/content.js
var MIN_LEN = 2;
var MAX_LEN = 2e3;
var card = null;
var trigger = null;
var pinned = false;
var dragged = false;
var lastRect = null;
var currentText = null;
var requestId = 0;
var showAuthor = true;
if (chrome?.storage?.local) {
  chrome.storage.local.get({ showAuthor: true }, (cfg) => {
    showAuthor = !!cfg.showAuthor;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !("showAuthor" in changes)) return;
    showAuthor = !!changes.showAuthor.newValue;
    card?.setShowAuthor(showAuthor);
  });
}
function onMouseUp(event) {
  if (card && event.composedPath().includes(card.root)) return;
  if (trigger && event.composedPath().includes(trigger.root)) return;
  setTimeout(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const raw = sel.toString();
    const text = normalizeText(raw);
    if (text.length < MIN_LEN || text.length > MAX_LEN) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const granularity = detectGranularity(text);
    if (!granularity) return;
    currentText = text;
    lastRect = rect;
    showTrigger(rect);
  }, 10);
}
function showTrigger(rect) {
  if (!trigger) {
    trigger = createTrigger({
      onClick: () => {
        hideTrigger();
        if (!currentText || !lastRect) return;
        showCard(currentText, detectGranularity(currentText), lastRect);
      }
    });
    document.documentElement.appendChild(trigger.root);
  }
  positionTrigger(rect);
}
function hideTrigger() {
  if (trigger) {
    trigger.root.remove();
    trigger = null;
  }
}
function positionTrigger(rect) {
  const margin = 8;
  const w = trigger.el.offsetWidth || 74;
  const h = trigger.el.offsetHeight || 27;
  const xMin = rect.left;
  const xMax = rect.right;
  let x = (xMin + xMax) / 2 - w / 2;
  let y = rect.top - h - margin;
  if (y < margin) y = rect.bottom + margin;
  x = Math.max(margin, Math.min(x, window.innerWidth - w - margin));
  y = Math.max(margin, Math.min(y, window.innerHeight - h - margin));
  trigger.root.style.position = "fixed";
  trigger.root.style.left = `${x}px`;
  trigger.root.style.top = `${y}px`;
  trigger.root.style.zIndex = "2147483647";
}
function showCard(text, granularity, rect) {
  if (!card) {
    card = createCard({
      granularity,
      sourceText: text,
      showAuthor,
      onClose: hideCard,
      onPin: (p) => {
        pinned = p;
      },
      onRetry: () => requestTranslate(currentText),
      onMove: () => {
        dragged = true;
      }
    });
    document.documentElement.appendChild(card.root);
  }
  dragged = false;
  card.setContext(granularity, text);
  positionCard(rect);
  requestTranslate(text);
}
function requestTranslate(text) {
  if (!card) return;
  if (!chrome?.runtime?.sendMessage) {
    card.renderError(
      "\u65E0\u6CD5\u8C03\u7528\u6269\u5C55\u540E\u53F0\uFF1A\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5\uFF08\u82E5\u521A\u91CD\u8F7D\u8FC7\u6269\u5C55\uFF0C\u5237\u65B0\u9875\u9762\u5373\u53EF\uFF09"
    );
    return;
  }
  const id = ++requestId;
  card.updateLoading();
  positionCard(lastRect);
  const granularity = detectGranularity(text);
  chrome.runtime.sendMessage(
    { type: "translate", text, granularity },
    (resp) => {
      if (id !== requestId) return;
      if (chrome.runtime.lastError) {
        card.renderError(chrome.runtime.lastError.message);
      } else if (!resp?.ok) {
        card.renderError(resp?.error || "\u7FFB\u8BD1\u5931\u8D25");
      } else {
        card.renderResult(resp.data);
      }
      positionCard(lastRect);
    }
  );
}
function positionCard(rect) {
  if (dragged) return;
  const margin = 12;
  const w = card.el.offsetWidth || 380;
  const h = card.el.offsetHeight || 200;
  let x = (window.innerWidth - w) / 2;
  let y = (window.innerHeight - h) / 2;
  x = Math.max(margin, Math.min(x, window.innerWidth - w - margin));
  y = Math.max(margin, Math.min(y, window.innerHeight - h - margin));
  card.root.style.position = "fixed";
  card.root.style.left = `${x}px`;
  card.root.style.top = `${y}px`;
  card.root.style.zIndex = "2147483647";
}
function hideCard() {
  if (card) {
    card.root.remove();
    card = null;
  }
  pinned = false;
  dragged = false;
}
function hideAll() {
  hideTrigger();
  hideCard();
}
document.addEventListener("mouseup", onMouseUp);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && (card || trigger)) hideAll();
});
document.addEventListener("mousedown", (e) => {
  if (card && e.composedPath().includes(card.root)) return;
  if (trigger && e.composedPath().includes(trigger.root)) return;
  hideTrigger();
  if (!pinned) hideCard();
});
window.addEventListener(
  "scroll",
  () => {
    hideTrigger();
  },
  true
);
window.addEventListener("pagehide", hideAll);
