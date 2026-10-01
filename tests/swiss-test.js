/* Tests moteur du format « ronde suisse » (suisse et suisse-elim) :
   - ronde suisse seule : n impair → rondes = R × ⌊n/2⌋ matchs, 1 exempt/ronde,
     pas de tableau final, ordre des rondes strict, repos ≥ 20 min, clés uniques
   - ronde suisse + élimination : qualifiés Q (2 ou plus), bracket puissance de 2
   - rondes réglables (champ « rondes »), plafonnées au max sans re-pairage
   - W.O. sur un match de ronde
   - régression : format par défaut (poules) → 350 matchs sur la base 25 tableaux */
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier.md"), "utf8");
const lines = src.split("\n");
const markerIdx = lines.findIndex((l) => l.includes("Composant principal"));
let engine = lines.slice(25, markerIdx - 1).join("\n");
engine = engine.replace(/function AttBadge\(\{ att, phase \}\) \{[\s\S]*?\n\}/, "function AttBadge({ att, type }) { return att === null || att === undefined ? (type !== null && type !== undefined ? type : null) : att; }");
const D = { samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50", dureeMatch: "", marge: "", finalesFin: false }, dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00", dureeMatch: "", marge: "", finalesFin: false } };
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? "OK  " : "ÉCHEC") + " " + name + (extra !== undefined ? " [" + extra + "]" : "")); if (!cond) fails++; };
eval(engine + `
const T = (o) => Object.assign({ disc: "SM", classement: "Série 1", nb: 9, qualifs: 2, jour: "samedi" }, o);
const D1 = { samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50", dureeMatch: "", marge: "", finalesFin: false } };
// --- ronde suisse seule, 9 joueurs, rondes auto (⌈log2 9⌉ = 4, min 3) ---
let b = buildTab(T({ format: "suisse" }), 0);
ok("suisse seule : 4 rondes auto", b.suisse === true && b.rondes === 4, b.rondes);
ok("suisse seule : 16 matchs (4 × 4)", b.poolMs.length === 16, b.poolMs.length);
ok("suisse seule : pas de tableau final", b.playedFinals.length === 0 && b.Q === 0);
ok("suisse seule : exempt chaque ronde (9 impair)", b.poolMs.filter((m) => m.round === 0).length === 4);
// chaque joueur joue exactement une fois par ronde, pas de doublon d'adversaire
const perJ = {};
let doublons = 0, parRondeBad = 0;
b.poolMs.forEach((m) => {
  const ka = m.aK.split(":")[1], kb = m.bK.split(":")[1];
  perJ[ka] = (perJ[ka] || 0); perJ[kb] = (perJ[kb] || 0);
});
for (let r = 0; r < b.rondes; r++) {
  const cnt = {};
  b.poolMs.filter((m) => m.round === r).forEach((m) => {
    const ka = m.aK.split(":")[1], kb = m.bK.split(":")[1];
    cnt[ka] = (cnt[ka] || 0) + 1; cnt[kb] = (cnt[kb] || 0) + 1;
  });
  for (const k of Object.keys(cnt)) if (cnt[k] !== 1) parRondeBad++;
}
const vus = new Set();
b.poolMs.forEach((m) => { const p = [m.aK.split(":")[1], m.bK.split(":")[1]].sort().join("|"); if (vus.has(p)) doublons++; vus.add(p); });
ok("suisse : un match par joueur et par ronde", parRondeBad === 0, parRondeBad);
ok("suisse : aucun adversaire rejoué", doublons === 0, doublons);
// planification : ordre des rondes strict + repos
const p = computePlan([T({ format: "suisse" })], D1, 28, 0, false, false);
ok("suisse seule : 16 matchs planifiés", p.sched.length === 16 && p.unscheduled.length === 0, p.sched.length);
let ordreBad = 0, reposBad = 0;
const finParJ = {}, doneRonde = {};
p.sched.forEach((m) => {
  const b0 = p.built[m.tid];
  if (m.phase === "poule" && m.suisse) {
    doneRonde[m.round] = (doneRonde[m.round] || 0) + 1;
    if (m.round > 0 && (doneRonde[m.round - 1] || 0) < b0.parRonde) ordreBad++;
    [m.aK, m.bK].forEach((k) => {
      if (finParJ[k] !== undefined && m.time < finParJ[k] + 20) reposBad++;
      finParJ[k] = Math.max(finParJ[k] === undefined ? -1e9 : finParJ[k], m.time + m.duree);
    });
  }
});
ok("suisse : rondes planifiées dans l'ordre", ordreBad === 0, ordreBad);
ok("suisse : repos ≥ 20 min respecté", reposBad === 0, reposBad);
ok("suisse : étiquettes « Ronde n »", p.sched.every((m) => /^Ronde [0-9]+$/.test(tourLabel(m, p.built[m.tid]))));
// --- ronde suisse + élimination directe : 9 joueurs, 4 qualifiés ---
b = buildTab(T({ format: "suisse-elim", qualifs: 4 }), 0);
ok("suisse-elim : Q=4 → 3 matchs de tableau final (2 demis + finale)", b.playedFinals.length === 3, b.playedFinals.length);
ok("suisse-elim : qualifiés étiquetés", qualLabel(b.finals[0].a) === "1er ronde suisse" || qualLabel(b.finals[0].a) === "2e ronde suisse");
const p2 = computePlan([T({ format: "suisse-elim", qualifs: 4 })], D1, 28, 0, false, false);
ok("suisse-elim : 19 matchs planifiés (16 + 3)", p2.sched.length === 19 && p2.unscheduled.length === 0, p2.sched.length);
ok("suisse-elim : demis après la fin des rondes", p2.sched.filter((m) => m.phase !== "poule").every((m) => m.time >= Math.max(...p2.sched.filter((x) => x.suisse).map((x) => x.time + x.duree))));
// 6 qualifiés → bracket de 8 (2 exempts) : 2 matchs en 1/4, 2 demis, 1 finale
b = buildTab(T({ format: "suisse-elim", qualifs: 6 }), 0);
ok("suisse-elim : Q=6 → bracket 8 (5 matchs)", b.playedFinals.length === 5, b.playedFinals.length);
// --- rondes réglables ---
b = buildTab(T({ format: "suisse", rondes: 3 }), 0);
ok("rondes réglables : 3 rondes → 12 matchs", b.rondes === 3 && b.poolMs.length === 12, b.poolMs.length);
b = buildTab(T({ format: "suisse", rondes: 99 }), 0);
ok("rondes plafonnées au max sans re-pairage (9 → 9)", b.rondes === 9, b.rondes);
b = buildTab(T({ format: "suisse", nb: 12, rondes: 99 }), 0);
ok("rondes plafonnées (12 → 11)", b.rondes === 11, b.rondes);
// n pair : chaque joueur joue exactement une fois par ronde, sans exempt
const parJ12 = {};
b.poolMs.filter((m) => m.round === 0).forEach((m) => { parJ12[m.aK] = 1; parJ12[m.bK] = 1; });
ok("12 joueurs : 6 matchs/ronde, aucun exempt", Object.keys(parJ12).length === 12 && b.poolMs.filter((m) => m.round === 0).length === 6);
// --- W.O. sur un match de ronde suisse ---
const m0 = buildTab(T({ format: "suisse" }), 0).poolMs[0];
const key = "P0-" + m0.pool + "-" + m0.round + "-" + m0.aK.split(":")[1] + "-" + m0.bK.split(":")[1];
const setW = new Set([key]);
const pW = computePlan([T({ format: "suisse" })], D1, 28, 0, false, false, setW);
ok("W.O. ronde suisse : 15 matchs joués + 1 W.O.", pW.sched.length === 15 && pW.forfaits.length === 1, pW.sched.length + "/" + pW.forfaits.length);
// --- régression : base défaut (poules) inchangée ---
const pBase = computePlan(baseTabs(), ${JSON.stringify(D)}, 28, 0, false, false);
ok("régression base défaut : 350 matchs", pBase.sched.length === 350, pBase.sched.length);
ok("régression : aucun tableau suisse par défaut", pBase.built.every((x) => !x.suisse));
// --- mélange : moitié poules, moitié ronde suisse, 2 jours ---
const mix = baseTabs().map((t, i) => i % 2 === 0 ? { ...t, format: "suisse" } : t);
const pMix = computePlan(mix, ${JSON.stringify(D)}, 28, 0, false, false);
ok("mixte poules/suisse : tout planifié", pMix.unscheduled.length === 0, pMix.sched.length);
const swissTabs = pMix.built.filter((x) => x.suisse);
const poolTabs = pMix.built.filter((x) => !x.suisse);
ok("mixte : 13 tableaux suisses, 12 en poules", swissTabs.length === 13 && poolTabs.length === 12, swissTabs.length + "/" + poolTabs.length);
let reposMix = 0;
for (const day of pMix.days) {
  const finJ = {};
  (pMix.perDay[day] || []).forEach((m) => {
    if (m.phase !== "poule") return;
    [m.aK, m.bK].forEach((k) => {
      if (finJ[k] !== undefined && m.time < finJ[k] + 20) reposMix++;
      finJ[k] = Math.max(finJ[k] === undefined ? -1e9 : finJ[k], m.time + m.duree);
    });
  });
}
ok("mixte : repos ≥ 20 min partout", reposMix === 0, reposMix);
`);
console.log(fails === 0 ? "TOUS LES TESTS RONDE SUISSE SONT OK" : fails + " ÉCHEC(S)");
process.exit(fails === 0 ? 0 : 1);
