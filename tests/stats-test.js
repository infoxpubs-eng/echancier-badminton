/* Test de la vue « Statistiques » (v1.9) — computeStats(tabs, jours, plan)
   doit agréger sans erreur les indicateurs de restitution : inscrits
   (positions de jeu H/F — estimation sans noms), paires, matchs prévus
   (poules / tableau final / exempts / W.O.), durées et temps de jeu par
   jour, occupation des terrains, fin et marge réelles, attentes (tous
   matchs et joueurs de poules) et distribution par tranches.
   Le scénario de référence est ITB7 (reproduction BadNet : 23 tableaux,
   187 + 121 matchs, 34 min) ; un second passage vérifie la cohérence
   interne sur la configuration de base (baseTabs). */
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier.md"), "utf8");
const lines = src.split("\n");
const markerIdx = lines.findIndex((l) => l.includes("Composant principal"));
let engine = lines.slice(25, markerIdx - 1).join("\n");
engine = engine.replace(/function AttBadge\(\{ att, phase \}\) \{[\s\S]*?\n\}/, "function AttBadge({ att, type }) { return att === null || att === undefined ? (type !== null && type !== undefined ? type : null) : att; }");

/* les 3 sources livrées exposent la vue Statistiques */
["badminton-echancier.md", "badminton-echancier-offline.md", "badminton-echancier-web.md"].forEach((f) => {
  const s = fs.readFileSync(require("path").join(__dirname, "..", "src", f), "utf8");
  if (!s.includes("computeStats") || !s.includes("Statistiques")) { console.log("FAIL " + f + " : vue Statistiques absente"); process.exit(1); }
  console.log("OK   " + f + " : computeStats + vue Statistiques présents");
});

/* configuration ITB7 (identique à itb7-test.js) */
const EXPECT = [
  ["SM", "P10-NC", 18], ["SM", "D8-D9", 18], ["SM", "N2-N3", 9], ["SM", "R4-R5", 12], ["SM", "R6-D7", 12],
  ["SD", "P10-NC", 12], ["SD", "D8-D9", 6], ["SD", "R4-R5", 4], ["SD", "R6-D7", 4],
  ["DX", "R6-D7", 12], ["DX", "D8-D9", 12], ["DX", "N2-N3", 5], ["DX", "P10-NC", 12], ["DX", "R4-R5", 4],
  ["DM", "P10-NC", 18], ["DM", "D8-D9", 18], ["DM", "R4-R5", 8], ["DM", "R6-D7", 12], ["DM", "N2-N3", 4],
  ["DD", "D8-D9", 12], ["DD", "R6-D7", 6], ["DD", "P10-NC", 6], ["DD", "R4-R5", 4],
];
const QUALIFS = { "SM N2-N3": 2, "SD D8-D9": 2, "DM R4-R5": 2, "DD R6-D7": 2, "DD P10-NC": 2 };

const harness = engine + `

const out = [];
const ok = (name, cond, dbg) => out.push([name, !!cond, dbg]);
const fmt = (t) => String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(Math.round(t % 60)).padStart(2, "0");

const EXPECT = ${JSON.stringify(EXPECT)};
const QUALIFS = ${JSON.stringify(QUALIFS)};
const tabs = EXPECT.map((e) => ({ disc: e[0], classement: e[1], nb: e[2], qualifs: QUALIFS[e[0] + " " + e[1]] || 1, jour: e[0] === "DM" || e[0] === "DD" ? "dimanche" : "samedi" }));
const jours = {
  samedi:   { actif: true, terrains: 8, debut: "08:45", fin: "23:00" },
  dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "19:30" },
};

/* ---------- 1. scénario ITB7 : agrégats attendus ---------- */
const plan = computePlan(tabs, jours, 34, 0, false, false);
const st = computeStats(tabs, jours, plan);
ok("23 tableaux bâtis", plan.built.length === 23, plan.built.length);
ok("inscrits estimés : 234 H", Math.round(st.inscrits.H) === 234, st.inscrits.H);
ok("inscrits estimés : 127 F", Math.round(st.inscrits.F) === 127, st.inscrits.F);
ok("paires engagées : 133", st.inscrits.paires === 133, st.inscrits.paires);
ok("inscrits total : 361 (toutes disciplines)", st.inscrits.total === 361, st.inscrits.total);
ok("total inscrits = somme des disciplines", st.inscrits.parDisc.reduce((a, d) => a + d.inscrits, 0) === st.inscrits.total, "");
ok("total paires = DM+DD+DX+DI", st.inscrits.parDisc.reduce((a, d) => a + (d.key === "SM" || d.key === "SD" || d.key === "SI" ? 0 : d.inscrits), 0) / 2 === st.inscrits.paires, "");
ok("matchs planifiés : 308", st.matchs.total === 308, st.matchs.total);
ok("matchs de poule : 247", st.matchs.poules === 247, st.matchs.poules);
ok("matchs de tableau final : 61", st.matchs.finales === 61, st.matchs.finales);
ok("exempts : 10", st.matchs.exempts === 10, st.matchs.exempts);
ok("W.O. : 0", st.matchs.wo === 0, st.matchs.wo);
ok("poules + finales = total", st.matchs.poules + st.matchs.finales === st.matchs.total, "");

/* par jour : effectifs, durées, temps de jeu, occupation, fins réelles */
const js = st.matchs.parJour[0], jd = st.matchs.parJour[1];
ok("parJour : 2 jours", st.matchs.parJour.length === 2, st.matchs.parJour.length);
ok("samedi : 187 matchs à 34 min", js.nb === 187 && js.duree === 34, js.nb + " / " + js.duree);
ok("dimanche : 121 matchs à 34 min", jd.nb === 121 && jd.duree === 34, jd.nb + " / " + jd.duree);
ok("temps de jeu : 187×34 = " + js.jeu + " min (samedi)", js.jeu === 187 * 34 && jd.jeu === 121 * 34, js.jeu + " / " + jd.jeu);
ok("occupation terrains : 0–100 % et non nulle", [js, jd].every((j) => j.occupation > 0 && j.occupation <= 100), js.occupation + " % / " + jd.occupation + " %");
ok("occupation samedi = jeu ÷ (8 terrains × 855 min) = 93 %", js.occupation === Math.round(100 * js.jeu / (8 * (toMin("23:00") - toMin("08:45")))), js.occupation + " %");
ok("fin réelle samedi 22:41 (marge +19 min)", js.finReelle === toMin("22:41") && js.margeReelle === 19, fmt(js.finReelle) + " / +" + js.margeReelle);
ok("fin réelle dimanche 18:34 (marge +56 min)", jd.finReelle === toMin("18:34") && jd.margeReelle === 56, fmt(jd.finReelle) + " / +" + jd.margeReelle);
ok("fermeture = horaire officiel du jour", js.fermeture === toMin("23:00") && jd.fermeture === toMin("19:30"), "");

/* attentes : tous matchs (badges) et joueurs/paires de poules */
const ws = plan.sched.map((m) => m.att).filter((w) => w !== null && w !== undefined);
ok("attentes « tous » : n = matchs mesurables (" + st.attentes.tous.n + ")", st.attentes.tous.n === ws.length, st.attentes.tous.n + " vs " + ws.length);
ok("attente max : 136 min", st.attentes.tous.max === 136, st.attentes.tous.max);
ok("attentes ≥ 1 h : 89", st.attentes.tous.att60 === 89, st.attentes.tous.att60);
ok("attentes ≥ 1 h 30 cohérentes (≤ att60)", st.attentes.tous.att90 <= st.attentes.tous.att60, st.attentes.tous.att90);
ok("moyenne « tous » cohérente avec le plan (" + st.attentes.tous.moy + " min)", st.attentes.tous.moy === Math.round(ws.reduce((a, b) => a + b, 0) / ws.length), "");
ok("attentes poules : n = plan.attentes (" + st.attentes.poules.n + ")", st.attentes.poules.n === plan.attentes.length, st.attentes.poules.n + " vs " + plan.attentes.length);
ok("poules : max 136 min, moyenne 55 min, att60 89",
   st.attentes.poules.max === 136 && st.attentes.poules.moy === 55 && st.attentes.poules.att60 === 89,
   st.attentes.poules.max + " / " + st.attentes.poules.moy + " / " + st.attentes.poules.att60);
ok("distribution : 5 tranches dont la somme = tous.n",
   st.attentes.tranches.length === 5 && st.attentes.tranches.reduce((a, t) => a + t.n, 0) === st.attentes.tous.n,
   st.attentes.tranches.reduce((a, t) => a + t.n, 0) + " vs " + st.attentes.tous.n);

/* ---------- 2. sanity : configuration de base (baseTabs) ---------- */
const D = { samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50" }, dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00" } };
const pb = computePlan(baseTabs(), D, 28, 0, false, false);
const sb = computeStats(baseTabs(), D, pb);
const noNaN = (o) => (typeof o === "number" ? !Number.isNaN(o) : typeof o !== "object" || o === null || Object.keys(o).every((k) => noNaN(o[k])));
ok("base : agrégats sans NaN", noNaN(sb), "");
ok("base : parDisc.matchs sommé = total (" + sb.matchs.total + ")", sb.inscrits.parDisc.reduce((a, d) => a + d.matchs, 0) === sb.matchs.total, "");
ok("base : inscrits H/F/paires ≥ 0", sb.inscrits.H >= 0 && sb.inscrits.F >= 0 && sb.inscrits.paires >= 0, sb.inscrits.H + "/" + sb.inscrits.F + "/" + sb.inscrits.paires);
ok("base : tranches sommées = tous.n", sb.attentes.tranches.reduce((a, t) => a + t.n, 0) === sb.attentes.tous.n, "");
ok("base : chaque jour a occupation 0–100 %", sb.matchs.parJour.every((j) => j.occupation >= 0 && j.occupation <= 100), sb.matchs.parJour.map((j) => j.occupation).join("/"));

let fails = out.filter((o) => !o[1]);
out.forEach((o) => console.log((o[1] ? "OK   " : "FAIL ") + o[0] + (o[1] && o[2] === undefined || o[2] === "" ? "" : "  [" + o[2] + "]")));
if (fails.length) { console.log("ÉCHECS : " + fails.length); process.exit(1); }
console.log("TOUS LES TESTS STATS SONT OK");
`;

eval(harness);
