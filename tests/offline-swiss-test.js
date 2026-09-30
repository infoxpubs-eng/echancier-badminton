/* Test ronde suisse dans la version hors-ligne : moteur + rendu UI */
const fs = require("fs");
const vm = require("vm");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier-offline.md"), "utf8");
const m = src.match(/<script>\n([\s\S]*?)<\/script>\s*<\/body>/);
let code = m[1];
const el = {};
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? "OK  " : "ÉCHEC") + " " + name + (extra !== undefined ? " [" + extra + "]" : "")); if (!cond) fails++; };
const sandbox = {
  el, document: { getElementById: () => el, body: { classList: { toggle: () => {} } } },
  window: { scrollTo: () => {} }, console, ok,
  Infinity, Math, Number, String, Object, Array, Date, RegExp, JSON, Map, Set, isNaN, parseInt, parseFloat,
};
el.__html = "";
Object.defineProperty(el, "innerHTML", { get() { return this.__h || ""; }, set(v) { this.__h = v; } });
code += `
;(function tests() {
  const T = (o) => Object.assign({ disc: "SM", classement: "Série 1", nb: 9, qualifs: 2, jour: "samedi" }, o);
  const D1 = { samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50", dureeMatch: "", marge: "", finalesFin: false } };
  let b = buildTab(T({ format: "suisse" }), 0);
  ok("moteur : 4 rondes × 4 matchs = 16, pas de tableau final", b.suisse === true && b.rondes === 4 && b.poolMs.length === 16 && b.playedFinals.length === 0);
  const p = computePlan([T({ format: "suisse" })], D1, 28, 0, false, false);
  ok("moteur : 16 planifiés, ordre strict, labels « Ronde n »", p.sched.length === 16 && p.sched.every((mm) => tourLabel(mm, p.built[mm.tid]) === "Ronde " + (mm.round + 1)));
  b = buildTab(T({ format: "suisse-elim", qualifs: 4 }), 0);
  ok("moteur : suisse-elim Q=4 → 3 matchs de tableau final", b.playedFinals.length === 3 && qualLabel(b.finals[0].a) === "1er ronde suisse");
  // UI config
  ok("config : sélecteur Format présent", el.__h.indexOf("Ronde suisse + élim. directe") >= 0 && el.__h.indexOf("Ronde suisse seule") >= 0);
  ok("config : champ Rondes absent en poules", el.__h.indexOf(">Rondes<") < 0);
  App.setTab(0, "format", "suisse-elim");
  ok("config : champ Rondes visible en suisse-elim", el.__h.indexOf(">Rondes<") >= 0);
  ok("config : libellé « Qualifiés élim. »", el.__h.indexOf("Qualifiés élim.") >= 0);
  App.setTabNum(0, "qualifs", "4");
  ok("config : description ronde suisse + 4 qualifiés", el.__h.indexOf("ronde suisse : 4 rondes × 4 matchs") >= 0 && el.__h.indexOf("4 qualifié(s) → élimination directe (3 matchs de tableau final)") >= 0);
  App.setTab(0, "rondes", "3");
  ok("config : rondes réglables → 12 matchs", el.__h.indexOf("ronde suisse : 3 rondes × 4 matchs (1 exempt par ronde · 12 matchs au total)") >= 0);
  App.setTab(0, "rondes", "");
  App.setTab(0, "format", "suisse");
  ok("config : qualifiés désactivés en ronde suisse seule", el.__h.indexOf("disabled ") >= 0 && el.__h.indexOf("classement final aux victoires puis départages") >= 0);
  // UI génération
  App.generer();
  const pl = computePlan(state.tabs, state.jours, state.dureeMatch, state.marge);
  const b0 = pl.built[0];
  ok("plan : tab 0 suisse, 16 matchs", b0.suisse && pl.sched.filter((mm) => mm.tid === 0).length === 16);
  ok("structure : « ronde suisse (4) »", el.__h.indexOf("ronde suisse (4)") >= 0);
  ok("structure : « classement final »", el.__h.indexOf("classement final") >= 0);
  App.setVueTab("planning");
  ok("planning : étiquettes « Ronde 1 »", el.__h.indexOf("Ronde 1") >= 0);
  App.setVueTab("t0");
  ok("détail tableau : encadré ronde suisse", el.__h.indexOf("ronde suisse : 4 rondes · 1 exempt par ronde · classement final aux victoires") >= 0);
  // retour au format par défaut : rien n'a changé
  App.setTab(0, "format", "");
  App.setTabNum(0, "qualifs", "2");
  App.backToConfig();
  ok("retour poules : base 350 matchs intacte", computePlan(state.tabs, state.jours, state.dureeMatch, state.marge).sched.length === 350);
})();
`;
vm.runInNewContext(code, sandbox);
console.log(fails === 0 ? "TOUS LES TESTS RONDE SUISSE HORS-LIGNE SONT OK" : fails + " ÉCHEC(S)");
process.exit(fails === 0 ? 0 : 1);
