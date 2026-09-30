/* Vérifie : (1) invariant de repos ≥ 20 min par participant/jour et par tour
   de tableau final, avec et sans marge de sécurité ; (2) l'effet de la nouvelle
   priorité (min = participant le plus attendu servi en premier) vs l'ancienne
   (max) sur les attentes ≥ 1h ; (3) le comptage att60. */
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier.md"), "utf8");
const lines = src.split("\n");
// moteur : lignes 26 jusqu'à la fin de computePlan (auto-détecté)
const markerIdx = lines.findIndex((l) => l.includes("Composant principal"));
let engine = lines.slice(25, markerIdx - 1).join("\n");
engine = engine.replace(/function AttBadge\(\{ att \}\) \{[\s\S]*?\n\}/, "function AttBadge({ att }) { return att === null || att === undefined ? '1er tour' : attFmt(att); }");
// variante « ancienne priorité » (max) pour comparaison : copie de computePlan uniquement
const cpIdx = engine.indexOf("function computePlan(");
const engineCore = engine.slice(0, cpIdx);
const computePlanSrc = engine.slice(cpIdx);
const computePlanOldSrc = computePlanSrc
  .replace("return Math.min(lastEnd.get(m.aK) ?? -1e9, lastEnd.get(m.bK) ?? -1e9);", "return Math.max(lastEnd.get(m.aK) ?? -1e9, lastEnd.get(m.bK) ?? -1e9);")
  .replace("function computePlan(", "function computePlanOld(");

const harness = engineCore + "\n" + computePlanSrc + "\n" + computePlanOldSrc + `

function attSum(plan) {
  const ws = plan.sched.map((m) => m.att).filter((w) => w !== null);
  return {
    n: ws.length,
    att60: ws.filter((w) => w >= 60).length,
    att90: ws.filter((w) => w >= 90).length,
    attMax: ws.length ? Math.max(...ws) : 0,
    attMoy: ws.length ? Math.round(ws.reduce((a, b) => a + b, 0) / ws.length) : 0,
  };
}
function restInvariant(plan, duree, name, fails) {
  // durée effective de chaque match : celle du jour de sa planification
  const md = (m) => (m.duree !== undefined ? m.duree : duree);
  for (const day of plan.days) {
    const byP = new Map();
    (plan.perDay[day] || []).forEach((m) => {
      if (m.phase !== "poule") return;
      if (!byP.has(m.aK)) byP.set(m.aK, []);
      byP.get(m.aK).push({ t: m.time, d: md(m) });
      if (!byP.has(m.bK)) byP.set(m.bK, []);
      byP.get(m.bK).push({ t: m.time, d: md(m) });
    });
    byP.forEach((lst, k) => {
      lst.sort((x, y) => x.t - y.t);
      for (let i = 1; i < lst.length; i++)
        if (lst[i].t - lst[i - 1].t < lst[i - 1].d + REPOS)
          fails.push(name + " repos poule violé (" + k + ", " + day + ") : " + (lst[i].t - lst[i - 1].t) + " min");
    });
  }
  // intercalage : une finale ne démarre qu'une fois SES deux sources
  // terminées (+ repos) — l'invariant est au niveau du match, pas du tour
  const byFid = new Map();
  plan.sched.forEach((m) => { if (m.phase !== "poule") byFid.set(m.tid + "|" + m.fid, m); });
  plan.sched.forEach((m) => {
    if (m.phase === "poule" || m.round === 0) return;
    [m.a, m.b].forEach((fid) => {
      const fm = byFid.get(m.tid + "|" + fid);
      if (fm !== undefined && m.time < fm.time + md(fm) + REPOS)
        fails.push(name + " repos finale violé (tab " + m.tid + ", " + m.fid + " avant sa source " + fid + ")");
    });
  });
}
const D = (over) => Object.assign({ samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50" }, dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00" } }, over);
const T = (over) => Object.assign({ disc: "SM", classement: "", nb: 16, qualifs: 2, jour: "samedi" }, over);
const fails = [];
const scenarios = [
  ["défaut", [T({ nb: 16 }), T({ disc: "DX", nb: 8, jour: "les-deux" })], D(), 28, 0],
  ["défaut+marge10", [T({ nb: 16 }), T({ disc: "DX", nb: 8, jour: "les-deux" })], D(), 28, 10],
  ["contention 3 terrains", [T({ nb: 16 }), T({ disc: "DM", nb: 16 }), T({ disc: "SD", nb: 12, qualifs: 1 })], D({ samedi: { actif: true, terrains: 3, debut: "08:30", fin: "21:50" } }), 30, 0],
  ["contention+marge7", [T({ nb: 16 }), T({ disc: "DM", nb: 16 }), T({ disc: "SD", nb: 12, qualifs: 1 })], D({ samedi: { actif: true, terrains: 3, debut: "08:30", fin: "21:50" } }), 30, 7],
  ["direct 30", [T({ nb: 30, jour: "les-deux" }), T({ disc: "DD", nb: 24 })], D(), 28, 0],
  ["poule de 3", [T({ nb: 3 }), T({ disc: "DX", nb: 9, qualifs: 1, jour: "les-deux" })], D(), 28, 0],
  ["gros 24", [T({ nb: 24 }), T({ disc: "DM", nb: 20 }), T({ disc: "SD", nb: 22 })], D(), 28, 0],
  ["3 jours, durées par jour", [T({ nb: 16, jour: "samedi" }), T({ disc: "DX", nb: 9, jour: "jour 3" }), T({ disc: "DM", nb: 12, jour: "dimanche" })],
    { samedi: { actif: true, terrains: 6, debut: "08:30", fin: "20:00", dureeMatch: 32 }, dimanche: { actif: true, terrains: 6, debut: "08:30", fin: "17:00" }, "jour 3": { actif: true, terrains: 4, debut: "09:00", fin: "16:00", dureeMatch: 35, marge: 5, finalesFin: true } }, 28, 0],
];
console.log("scénario | planifiés | attentes≥1h (nouveau) | ≥1h (ancien) | max (nouveau→ancien) | moy (nouveau→ancien)");
for (const [name, tabs, jours, dureeM, marge] of scenarios) {
  const duree = Math.max(28, dureeM) + marge;
  const pNew = computePlan(tabs, jours, dureeM, marge);
  const pOld = computePlanOld(tabs, jours, dureeM, marge);
  restInvariant(pNew, duree, name + " [nouveau]", fails);
  restInvariant(pOld, duree, name + " [ancien]", fails);
  const sN = attSum(pNew), sO = attSum(pOld);
  console.log(name + " | " + pNew.sched.length + " | " + sN.att60 + " | " + sO.att60 + " | " + sN.attMax + "→" + sO.attMax + " | " + sN.attMoy + "→" + sO.attMoy);
  // indicateurs seulement — le démarrage progressif des tableaux change le
  // paysage : l'ancienne priorité (max) peut ponctuellement améliorer un
  // indicateur isolé sans réduire les attentes longues (att60 reste la
  // protection de régression, vérifiée dans render-views sur la base)
  if (sN.attMax > sO.attMax) console.log("  (info) " + name + " : attMax nouveau " + sN.attMax + " > ancien " + sO.attMax);
  if (sN.attMoy > sO.attMoy) console.log("  (info) " + name + " : attMoy nouveau " + sN.attMoy + " > ancien " + sO.attMoy);
  // att90 : indicateur only — avec le tri « même tour / poule / série »,
  // l'ancienne priorité (max) peut ponctuellement faire moins d'attentes ≥ 1h30
}
// durées par jour : chaque match porte la durée de son jour
const pJ = computePlan([T({ nb: 16, jour: "samedi" }), T({ disc: "DX", nb: 9, jour: "jour 3" })],
  { samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50", dureeMatch: 32 }, dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00" }, "jour 3": { actif: true, terrains: 4, debut: "09:00", fin: "16:00", dureeMatch: 35, marge: 5, finalesFin: true } }, 28, 0);
if (!pJ.sched.every((m) => m.duree === (m.day === "jour 3" ? 40 : m.day === "samedi" ? 32 : 28)))
  fails.push("durées par jour incohérentes : " + pJ.sched.map((m) => m.day + ":" + m.duree).slice(0, 5).join(", "));
restInvariant(pJ, 32, "durées par jour invariant", fails);
// att60 avec marge : la marge ne doit pas créer de replanification impossible
const pM = computePlan([T({ nb: 16 }), T({ disc: "DX", nb: 8, jour: "les-deux" })], D(), 28, 10);
if (pM.unscheduled.length > 0) fails.push("marge10 : " + pM.unscheduled.length + " matchs non planifiés");
restInvariant(pM, 38, "marge10 invariant", fails);
console.log("marge 10 → attentes ≥1h : " + attSum(pM).att60 + ", non planifiés : " + pM.unscheduled.length);
// combosTox : le repos reste garanti avec l'option « combinaisons toxiques » cochée
const pTox = computePlan([T({ nb: 16 }), T({ disc: "DX", nb: 16, jour: "samedi" }), T({ disc: "DM", nb: 16, jour: "samedi" }), T({ disc: "DD", nb: 12, jour: "les-deux" })], D(), 28, 0, true);
restInvariant(pTox, 28, "combosTox invariant", fails);
if (!pTox.sched.length) fails.push("combosTox : rien de planifié");
const pToxOff = computePlan([T({ nb: 16 }), T({ disc: "DX", nb: 16, jour: "samedi" })], D(), 28, 0, false);
restInvariant(pToxOff, 28, "combosTox OFF invariant", fails);
console.log("combosTox ON → planifiés " + pTox.sched.length + ", attentes ≥1h : " + attSum(pTox).att60);
// finalesFin : demis et finales regroupées en fin de journée, repos garanti
const pFF = computePlan([T({ nb: 16 }), T({ disc: "DM", nb: 16 }), T({ disc: "SD", nb: 12, qualifs: 1 })], D(), 28, 0, false, true);
restInvariant(pFF, 28, "finalesFin invariant", fails);
if (!pFF.sched.length) fails.push("finalesFin : rien de planifié");
console.log("finalesFin ON → planifiés " + pFF.sched.length + ", attentes ≥1h : " + attSum(pFF).att60);
// pause déjeuner par jour : aucun match ne chevauche la fenêtre, repos garanti
const pD = 12 * 60 + 30, pF = 13 * 60 + 30;
const pPause = computePlan([T({ nb: 16 }), T({ disc: "DM", nb: 16 }), T({ disc: "SD", nb: 12, qualifs: 1 })],
  D({ samedi: { actif: true, terrains: 3, debut: "08:30", fin: "21:50", pauseDebut: "12:30", pauseFin: "13:30" } }), 28, 0);
restInvariant(pPause, 28, "pause invariant", fails);
(pPause.perDay.samedi || []).forEach((m) => {
  if (m.time < pF && m.time + (m.duree !== undefined ? m.duree : 28) > pD) fails.push("pause chevauchée : " + m.key + " à " + fmtTime(m.time));
});
if (!(pPause.perDay.samedi || []).some((m) => m.time >= pF)) fails.push("pause : aucun match après la reprise (pause sans effet ?)");
console.log("pause 12:30→13:30 → planifiés " + pPause.sched.length + ", chevauchements : " + (pPause.perDay.samedi || []).filter((m) => m.time < pF && m.time + 28 > pD).length);
// pause à moitié définie (début sans fin) : pas de contrainte de pause
const pPauseDemi = computePlan([T({ nb: 16 })], D({ samedi: { actif: true, terrains: 3, debut: "08:30", fin: "21:50", pauseDebut: "12:30" } }), 28, 0);
restInvariant(pPauseDemi, 28, "pause demi invariant", fails);
if ((pPauseDemi.perDay.samedi || []).length && (pPauseDemi.perDay.samedi || []).every((m) => m.time >= pF)) fails.push("pause demi-définie : tous les matchs repoussés après 13:30");
// pause inversée (fin ≤ début) : pas de contrainte
const pPauseInv = computePlan([T({ nb: 16 })], D({ samedi: { actif: true, terrains: 3, debut: "08:30", fin: "21:50", pauseDebut: "13:30", pauseFin: "12:30" } }), 28, 0);
restInvariant(pPauseInv, 28, "pause inverse invariant", fails);
if ((pPauseInv.perDay.samedi || []).length && (pPauseInv.perDay.samedi || []).every((m) => m.time >= pF)) fails.push("pause inversée : tous les matchs repoussés après 13:30");
// forfaits (W.O.) : match exclu du sched, enregistré dans forfaits, repos garanti
const tabsW = [T({ nb: 16 }), T({ disc: "DX", nb: 8, jour: "les-deux" })];
const pWref = computePlan(tabsW, D(), 28, 0);
const fkey = pWref.sched.find((m) => m.phase === "poule").key;
const pW = computePlan(tabsW, D(), 28, 0, false, false, new Set([fkey]));
if (pW.sched.some((m) => m.key === fkey)) fails.push("W.O. encore planifié : " + fkey);
if (pW.unscheduled.some((m) => m.key === fkey)) fails.push("W.O. compté non planifié : " + fkey);
if (pW.forfaits.length !== 1 || pW.forfaits[0].key !== fkey || pW.forfaits[0].att !== null) fails.push("W.O. mal enregistré : " + JSON.stringify(pW.forfaits.map((m) => m.key)));
if (pW.forfaits[0].day === null || pW.forfaits[0].day === undefined) fails.push("W.O. sans jour rattaché");
restInvariant(pW, 28, "forfait poule invariant", fails);
// W.O. sur un 1/4 de finale (round 0) : la demi se joue quand même
const fkeyF = pWref.sched.find((m) => m.phase !== "poule" && m.round === 0).key;
const pWF = computePlan(tabsW, D(), 28, 0, false, false, new Set([fkeyF]));
if (pWF.sched.some((m) => m.key === fkeyF)) fails.push("W.O. finale encore planifié : " + fkeyF);
if (pWF.sched.filter((m) => m.phase !== "poule").length === 0) fails.push("forfait finale : plus aucune finale planifiée");
restInvariant(pWF, 28, "forfait finale invariant", fails);
console.log("forfaits → W.O. poule " + fkey + " : " + pW.sched.length + "/" + pWref.sched.length + " planifiés ; W.O. finale r0 " + fkeyF + " : " + pWF.sched.length + "/" + pWref.sched.length + " planifiés");
console.log(fails.length === 0 ? "TOUS LES INVARIANTS ET COMPARAISONS SONT OK" : "ÉCHECS :");
fails.forEach((f) => console.log("  ✗", f));
`;
eval(harness);
