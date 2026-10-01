/* Test du tableau de bord statistique (statsSummary, v1.9) — vérifie
   les chiffres restitués par le bouton « Statistiques » sur deux
   configurations : la référence par défaut (25 tableaux de 9, 28 min,
   alignée sur tests/metrics.js : 350 matchs, att60=75, attMax=112,
   attMoy=51) et la reproduction ITB7 (23 tableaux, créneaux 34 min,
   alignée sur tests/itb7-test.js : 187 matchs samedi + 121 dimanche).
   Invariants : cohérence interne de la structure (somme des paliers =
   attentes mesurées, somme des jours = total, somme des disciplines =
   total), ventilation H/F des inscrits, occupation des terrains. */
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier.md"), "utf8");
const lines = src.split("\n");
const markerIdx = lines.findIndex((l) => l.includes("Composant principal"));
let engine = lines.slice(25, markerIdx - 1).join("\n");
engine = engine.replace(/function AttBadge\(\{ att, phase \}\) \{[\s\S]*?\n\}/, "function AttBadge({ att, type }) { return att === null || att === undefined ? (type !== null && type !== undefined ? type : null) : att; }");

/* configuration ITB7 (mêmes effectifs que tests/itb7-test.js) */
const EXPECT = [
  ["SM", "P10-NC", 18, 1, "samedi"], ["SM", "D8-D9", 18, 1, "samedi"], ["SM", "N2-N3", 9, 2, "samedi"],
  ["SM", "R4-R5", 12, 1, "samedi"], ["SM", "R6-D7", 12, 1, "samedi"], ["SD", "P10-NC", 12, 1, "samedi"],
  ["SD", "D8-D9", 6, 2, "samedi"], ["SD", "R4-R5", 4, 0, "samedi"], ["SD", "R6-D7", 4, 0, "samedi"],
  ["DX", "R6-D7", 12, 1, "samedi"], ["DX", "D8-D9", 12, 1, "samedi"], ["DX", "N2-N3", 5, 0, "samedi"],
  ["DX", "P10-NC", 12, 1, "samedi"], ["DX", "R4-R5", 4, 0, "samedi"],
  ["DM", "P10-NC", 18, 1, "dimanche"], ["DM", "D8-D9", 18, 1, "dimanche"], ["DM", "R4-R5", 8, 2, "dimanche"],
  ["DM", "R6-D7", 12, 1, "dimanche"], ["DM", "N2-N3", 4, 0, "dimanche"],
  ["DD", "D8-D9", 12, 1, "dimanche"], ["DD", "R6-D7", 6, 2, "dimanche"],
  ["DD", "P10-NC", 6, 2, "dimanche"], ["DD", "R4-R5", 4, 0, "dimanche"],
];

const harness = engine + `

const out = [];
const ok = (name, cond, dbg) => out.push([name, !!cond, dbg]);
const fmt = (t) => String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(Math.round(t % 60)).padStart(2, "0");
const sum = (a) => a.reduce((x, y) => x + y, 0);

const D = { samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50", dureeMatch: "", marge: "", finalesFin: false }, dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00", dureeMatch: "", marge: "", finalesFin: false } };

/* cohérence interne commune : paliers = attentes mesurées, jours et
   disciplines = total, occupation dans [0, 100], attentes joueurs/paires
   cohérentes avec les badges de matchs */
const coherence = (name, plan, jours, st) => {
  ok(name + " : somme des paliers = attentes mesurées", sum(st.attentes.paliers.map((p) => p.n)) === st.attentes.n,
     sum(st.attentes.paliers.map((p) => p.n)) + " vs " + st.attentes.n);
  ok(name + " : somme des jours = total des matchs", sum(st.jours.map((j) => j.nb)) === st.total,
     sum(st.jours.map((j) => j.nb)) + " vs " + st.total);
  ok(name + " : somme des disciplines = total des matchs", sum(Object.keys(st.byDisc).map((d) => st.byDisc[d])) === st.total);
  ok(name + " : occupation des terrains entre 0 et 100 %", st.jours.every((j) => j.occupation >= 0 && j.occupation <= 100),
     st.jours.map((j) => j.occupation).join(","));
  ok(name + " : attentes joueurs/paires ≤ attentes matchs (max)", st.attentesJoueurs.max <= st.attentes.max,
     st.attentesJoueurs.max + " vs " + st.attentes.max);
  ok(name + " : temps de jeu total > 0 et moyenne par engagement > 0", st.jeu.totalH > 0 && st.jeu.moyenneParEngagement > 0,
     st.jeu.totalH + " h, " + st.jeu.moyenneParEngagement + " min");
  ok(name + " : exempts et W.O. comptés", st.tableaux.exempts >= 0 && st.tableaux.wo === plan.forfaits.length);
};

/* ---------- 1. configuration de référence (25 tableaux de 9, 28 min) ---------- */
const p0 = computePlan(baseTabs(), D, 28, 0, false, false);
const s0 = statsSummary(p0, D, 28, 0);
ok("réf. : 350 matchs planifiés (gardes-fous v1.6)", s0.total === 350, s0.total);
ok("réf. : 25 tableaux, tous en poules", s0.tableaux.total === 25 && s0.tableaux.formats.poules === 25,
   s0.tableaux.total + " tabs, " + s0.tableaux.formats.poules + " poules");
ok("réf. : joueurs estimés 180 H", s0.inscrits.joueursH === 180, s0.inscrits.joueursH);
ok("réf. : joueuses estimées 180 F", s0.inscrits.joueusesF === 180, s0.inscrits.joueusesF);
ok("réf. : paires estimées 135 (45 H, 45 F, 45 mixtes)",
   s0.inscrits.paires === 135 && s0.inscrits.pairesM === 45 && s0.inscrits.pairesF === 45 && s0.inscrits.pairesX === 45,
   s0.inscrits.paires + " (" + s0.inscrits.pairesM + "/" + s0.inscrits.pairesF + "/" + s0.inscrits.pairesX + ")");
ok("réf. : 90 simples + 135 paires = 225 engagements d'unités, 360 engagements de joueurs",
   s0.inscrits.simples === 90 && s0.inscrits.engagements === 360, s0.inscrits.simples + " / " + s0.inscrits.engagements);
ok("réf. : attentes alignées sur metrics.js (moy 51, max 112, 75 ≥ 1h)",
   s0.attentes.moy === 51 && s0.attentes.max === 112 && s0.attentes.sup60 === 75,
   s0.attentes.moy + "/" + s0.attentes.max + "/" + s0.attentes.sup60);
coherence("réf.", p0, D, s0);
out.push(["INFO", true, "réf. : jours = " + s0.jours.map((j) => j.day + " " + j.nb + " matchs, occupation " + j.occupation + " %, fin " + j.fin + ", marge réelle " + j.margeReelle + " min").join(" · ")]);

/* ---------- 2. reproduction ITB7 (23 tableaux, créneaux 34 min) ---------- */
const T7 = ${JSON.stringify(EXPECT)};
const tabs7 = T7.map((e) => ({ disc: e[0], classement: e[1], nb: e[2], qualifs: e[3], jour: e[4] }));
const D7 = { samedi: { actif: true, terrains: 8, debut: "08:45", fin: "23:00" }, dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "19:30" } };
const p7 = computePlan(tabs7, D7, 34, 0, false, false);
const s7 = statsSummary(p7, D7, 34, 0);
ok("ITB7 : 308 matchs planifiés (187 samedi + 121 dimanche)",
   s7.total === 308 && s7.jours[0].nb === 187 && s7.jours[1].nb === 121,
   s7.total + " (" + s7.jours.map((j) => j.nb).join(" + ") + ")");
ok("ITB7 : joueurs estimés 234 H (69 SM + 2×60 DM + 45 DX)", s7.inscrits.joueursH === 234, s7.inscrits.joueursH);
ok("ITB7 : joueuses estimées 127 F (26 SD + 2×28 DD + 45 DX)", s7.inscrits.joueusesF === 127, s7.inscrits.joueusesF);
ok("ITB7 : paires estimées 133 (60 DM + 28 DD + 45 DX)", s7.inscrits.paires === 133, s7.inscrits.paires);
ok("ITB7 : engagements de joueurs 361 (95 simples + 2×133 paires)", s7.inscrits.engagements === 361, s7.inscrits.engagements);
ok("ITB7 : 23 tableaux", s7.tableaux.total === 23, s7.tableaux.total);
coherence("ITB7", p7, D7, s7);
out.push(["INFO", true, "ITB7 : attentes moy " + s7.attentes.moy + " min, max " + s7.attentes.max + " min, " + s7.attentes.sup60 + " ≥ 1h · jeu total " + s7.jeu.totalH + " h"]);

/* ---------- 3. W.O. : comptés dans le dashboard (forfaits en direct) ---------- */
const woKey = p0.sched[0].key;
const p1 = computePlan(baseTabs(), D, 28, 0, false, false, new Set([woKey]));
const s1 = statsSummary(p1, D, 28, 0);
ok("W.O. : total réduit de 1 et W.O. comptés", s1.total === 349 && s1.tableaux.wo === 1, s1.total + " matchs, " + s1.tableaux.wo + " W.O.");
coherence("W.O.", p1, D, s1);

let fails = out.filter((o) => !o[1]);
out.forEach((o) => { if (o[0] === "INFO") console.log(o[2]); else console.log((o[1] ? "OK   " : "FAIL ") + o[0] + (o[1] && o[2] === undefined ? "" : "  [" + o[2] + "]")); });
if (fails.length) { console.log("ÉCHECS : " + fails.length); process.exit(1); }
console.log("TOUS LES TESTS STATS-SUMMARY SONT OK");
`;

eval(harness);
