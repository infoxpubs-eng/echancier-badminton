/* Test hors-ligne : exempts ronde suisse (n impair) + conservation du défilement */
const fs = require("fs");
const vm = require("vm");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier-offline.md"), "utf8");
const m = src.match(/<script>\n([\s\S]*?)<\/script>\s*<\/body>/);
let code = m[1];
const el = {};
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? "OK  " : "ÉCHEC") + " " + name + (extra !== undefined ? " [" + extra + "]" : "")); if (!cond) fails++; };
el.__html = "";
Object.defineProperty(el, "innerHTML", { get() { return this.__h || ""; }, set(v) { this.__h = v; } });
const win = { scrollY: 0, scrollTo: function (x, y) { this.scrollY = y; } };
const sandbox = {
  el, document: { getElementById: () => el, body: { classList: { toggle: () => {} } } },
  window: win, console, ok,
  Infinity, Math, Number, String, Object, Array, Date, RegExp, JSON, Map, Set, isNaN, parseInt, parseFloat,
};
code += `
;(function tests() {
  const T = (o) => Object.assign({ disc: "SM", classement: "Série 1", nb: 9, qualifs: 2, jour: "samedi" }, o);
  // exempts : n=9 impair, rondes auto = 4 → 1 exempt par ronde, tous différents
  let b = buildTab(T({ format: "suisse" }), 0);
  ok("moteur : n=9 → 4 exempts (un par ronde)", b.exempts.length === 4);
  ok("moteur : rondes des exempts = 0,1,2,3", b.exempts.map((e) => e.r).join(",") === "0,1,2,3");
  const js = b.exempts.map((e) => e.j);
  ok("moteur : jamais le même exempt deux fois", new Set(js).size === 4);
  ok("moteur : exempt absent des matchs de sa ronde", b.exempts.every((e) => b.poolMs.filter((mm) => mm.round === e.r).every((mm) => mm.aK !== b.tid + ":" + e.j && mm.bK !== b.tid + ":" + e.j)));
  b = buildTab(T({ format: "suisse", nb: 8 }), 0);
  ok("moteur : n=8 pair → aucun exempt", b.exempts.length === 0);
  // UI : liste des exempts dans le détail tableau
  App.setTab(0, "format", "suisse");
  App.generer();
  App.setVueTab("t0");
  ok("détail tableau : liste « Exempts : Ronde 1 → »", el.__h.indexOf("Exempts :") >= 0 && el.__h.indexOf("Ronde 1 → Joueur") >= 0);
  App.setVueTab("t1");
  ok("détail tableau : exemts pour tab suisse seulement", el.__h.indexOf("Exempts :") < 0);
  // défilement : saisie formulaire → position conservée ; changement de vue → haut
  App.backToConfig();
  window.scrollY = 480;
  App.setTabNum(0, "nb", "9");
  ok("défilement : saisie conservée (480)", window.scrollY === 480);
  window.scrollY = 480;
  App.generer();
  ok("défilement : génération → retour en haut (0)", window.scrollY === 0);
  window.scrollY = 480;
  App.setVueTab("planning");
  ok("défilement : changement de vue → retour en haut (0)", window.scrollY === 0);
})();
`;
vm.runInNewContext(code, sandbox);
console.log(fails === 0 ? "TOUS LES TESTS EXEMPTS + DÉFILEMENT SONT OK" : fails + " ÉCHEC(S)");
process.exit(fails === 0 ? 0 : 1);
