/* Test de régression v1.3 — tableaux « les deux jours » :
   les matchs du jour 2 ne doivent PAS hériter de l'horloge du jour 1.
   Avant correctif, une source jouée la veille contraignait l'heure de
   reprise au sens horloge absolue : des quarts finis à 17:42 le samedi
   reprogrammaient les demis à 18:02 le dimanche — d'où des marges
   réelles dimanche aberrantes (ex. −118 min avec une journée presque
   vide) alors que le calcul de marge réelle, lui, est bien par jour.
   Après correctif : repos de nuit acquis, reprise à l'ouverture du
   jour 2 ; l'attente d'une source de la veille n'est pas mesurable. */
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier.md"), "utf8");
const lines = src.split("\n");
const markerIdx = lines.findIndex((l) => l.includes("Composant principal"));
let engine = lines.slice(25, markerIdx - 1).join("\n");
engine = engine.replace(/function AttBadge\(\{ att, phase \}\) \{[\s\S]*?\n\}/, "function AttBadge({ att, type }) { return att === null || att === undefined ? (type !== null && type !== undefined ? '≈ ' + attFmt(type) : '1er tour') : attFmt(att); }");

const harness = engine + `

const out = [];
const ok = (name, cond, dbg) => out.push([name, !!cond, dbg]);
const D = () => ({ samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50" }, dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00" } });
const T = (over) => Object.assign({ disc: "SM", classement: "", nb: 16, qualifs: 2, jour: "samedi" }, over);
const fmt = (t) => String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(Math.round(t % 60)).padStart(2, "0");

/* scénario type (capture du 2026-10-01) : samedi chargé, DX « les deux »,
   dimanche léger — le DX finit sa part du jour 1 en début d'après-midi,
   ce qui suffit à détecter l'ancrage erroné (avant correctif : demis du
   dimanche à 13:30 = fin des quarts du samedi 13:10 + 20 min) */
const tabs = [
  T({ nb: 24 }), T({ nb: 24, classement: "Série 2" }),
  T({ nb: 32, classement: "Série 3" }), T({ nb: 34, classement: "Série 4" }),
  T({ disc: "DX", classement: "Série 1", nb: 24, jour: "les-deux" }),
  T({ disc: "SD", nb: 12, jour: "dimanche" }),
  T({ disc: "DM", nb: 12, jour: "dimanche" }),
  T({ disc: "DD", nb: 12, jour: "dimanche" }),
];
const jours = D();
const plan = computePlan(tabs, jours, 28, 0);
const dxTid = plan.built.findIndex((b) => b.tab.disc === "DX");
const dxSun = (plan.perDay.dimanche || []).filter((m) => m.tid === dxTid);
const dxSat = (plan.perDay.samedi || []).filter((m) => m.tid === dxTid);
const md = (m) => (m.duree !== undefined ? m.duree : 28);

ok("tous les matchs planifiés", plan.unscheduled.length === 0, plan.unscheduled.length);
ok("coupure jour 2 présente (demis)", plan.cuts[dxTid] !== undefined && plan.cuts[dxTid].label === "Demi-finales", plan.cuts[dxTid]);
ok("le DX joue sur les deux jours", dxSat.length > 0 && dxSun.length > 0, dxSat.length + "/" + dxSun.length);

/* contrôle central : la part du jour 2 du DX démarre à l'ouverture du
   dimanche — pas ancrée sur la fin du jour 1 (avant correctif : 13:30) */
ok("jour 2 : reprise du DX à l'ouverture (08:30)",
  dxSun.length > 0 && Math.min(...dxSun.map((m) => m.time)) === toMin("08:30"),
  dxSun.map((m) => fmt(m.time) + " r" + m.round).join(", "));
ok("jour 2 : aucun match du DX après midi", dxSun.every((m) => m.time < 12 * 60),
  dxSun.map((m) => fmt(m.time)).join(", "));

/* marge réelle du dimanche positive une fois la reprise ramenée au matin */
const lastSun = Math.max(...(plan.perDay.dimanche || []).map((m) => m.time + md(m)));
ok("dimanche : marge réelle positive", lastSun <= toMin("17:00"), "dernier " + fmt(lastSun) + " vs fermeture 17:00");

/* repos garanti au sein du jour 2 : finale après ses demis (même jour) */
const sunByRound = {};
dxSun.forEach((m) => { (sunByRound[m.round] = sunByRound[m.round] || []).push(m); });
const rounds = Object.keys(sunByRound).map(Number).sort((a, b) => a - b);
ok("jour 2 : tours du DX dans l'ordre", rounds.length >= 2, rounds.join(","));
for (let i = 1; i < rounds.length; i++) {
  const finPrec = Math.max(...sunByRound[rounds[i - 1]].map((m) => m.time + md(m)));
  const debSuiv = Math.min(...sunByRound[rounds[i]].map((m) => m.time));
  ok("jour 2 : repos " + REPOS + " min entre r" + rounds[i - 1] + " et r" + rounds[i],
    debSuiv >= finPrec + REPOS, fmt(debSuiv) + " < " + fmt(finPrec + REPOS));
}

/* attente : une source jouée la veille n'est pas mesurable (null, pas
   un délai négatif ni un héritage de l'horloge du jour 1) */
const firstSun = sunByRound[rounds[0]] || [];
ok("jour 2 : attente des demis non mesurable (sources de la veille)",
  firstSun.every((m) => m.att === null && m.attPhase === null),
  firstSun.map((m) => m.att + "/" + m.attPhase).join(","));
/* la finale du jour 2 (sources du même jour) a une attente mesurable ≥ repos */
if (rounds.length >= 2) {
  const fin = (sunByRound[rounds[rounds.length - 1]] || [])[0];
  ok("jour 2 : attente de la finale mesurable (sources du jour)",
    fin !== undefined && fin.att !== null && fin.att >= REPOS, fin ? fin.att : "pas de finale");
}

/* invariant général : aucun match du jour 2 ne démarre avant l'ouverture */
ok("jour 2 : aucun match avant l'ouverture",
  (plan.perDay.dimanche || []).every((m) => m.time >= toMin("08:30")));

/* résumé */
const lastSat = Math.max(...(plan.perDay.samedi || []).map((m) => m.time + md(m)));
console.log("samedi " + (plan.perDay.samedi || []).length + " matchs, dernier " + fmt(lastSat) +
  " (marge " + (toMin("21:50") - lastSat) + " min) ; dimanche " + (plan.perDay.dimanche || []).length +
  " matchs, dernier " + fmt(lastSun) + " (marge " + (toMin("17:00") - lastSun) + " min)");
out.forEach(([name, cond, dbg]) => console.log((cond ? "OK   " : "FAIL ") + name + (cond ? "" : " : " + JSON.stringify(dbg))));
const bad = out.filter(([, c]) => !c);
if (bad.length) { console.log("ÉCHECS : " + bad.length); process.exit(1); }
console.log("TOUS LES TESTS LES-DEUX-JOURS SONT OK");
`;
eval(harness);
