/* Test v1.7 : ordre canonique des jours + libellés « Vainqueur N° ».
   v1.7.1 : listes multi-jours (par classement, par tableau) — samedi
   avant dimanche, la tri par heure seule faisait passer le dimanche
   08:30 avant le samedi 17:43.
   Demandes du juge-arbitre :
   1. « les matchs du Dimanche devraient être indiqués après ceux du
      samedi » — même si une configuration enregistrée présente les
      jours dans un autre ordre (ex. dimanche saisi avant samedi), la
      planification, l'affichage ET la numérotation (N° 1 → fin du
      tournoi) suivent l'ordre canonique : samedi, dimanche, puis
      « jour 3 », « jour 4 »… ;
   2. « plutôt que "Vainqueur T1-1", indique le numéro du match dont il
      est vainqueur (ex. "Vainqueur 169") » — toute source fid d'un
      tableau final s'affiche par le numéro du match gagné, identique
      dans toutes les vues et l'export CSV ; repli sur le code interne
      si le match source n'est pas planifié (forfait W.O.). */
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier.md"), "utf8");
const lines = src.split("\n");
const markerIdx = lines.findIndex((l) => l.includes("Composant principal"));
let engine = lines.slice(25, markerIdx - 1).join("\n");
engine = engine.replace(/function AttBadge\(\{ att, phase \}\) \{[\s\S]*?\n\}/, "function AttBadge({ att, type }) { return att === null || att === undefined ? (type !== null && type !== undefined ? type : null) : att; }");

const fails = [];
const ok = (name, cond, detail) => { if (!cond) fails.push(name + (detail ? " : " + detail : "")); };

const harness = engine + `
;(function () {
  /* ---- 1. ordre canonique des jours ---- */
  ok("dayRank : samedi < dimanche", dayRank("samedi") < dayRank("dimanche"), "");
  ok("daySort : dimanche saisi avant samedi → samedi d'abord",
     JSON.stringify(daySort(["dimanche", "samedi"])) === '["samedi","dimanche"]',
     JSON.stringify(daySort(["dimanche", "samedi"])));
  ok("daySort : « jour 3 » après dimanche",
     JSON.stringify(daySort(["jour 3", "dimanche", "samedi"])) === '["samedi","dimanche","jour 3"]',
     JSON.stringify(daySort(["jour 3", "dimanche", "samedi"])));
  ok("daySort : « jour 4 » après « jour 3 »",
     JSON.stringify(daySort(["jour 4", "jour 3"])) === '["jour 3","jour 4"]', "");

  /* ---- 2. configuration avec dimanche AVANT samedi : plan + numérotation ---- */
  const Dinv = {
    dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00" },
    samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50" },
  };
  const plan = computePlan(baseTabs(), Dinv, 28, 0);
  ok("plan.days : samedi avant dimanche malgré l'ordre de saisie",
     plan.days[0] === "samedi" && plan.days[1] === "dimanche", JSON.stringify(plan.days));
  const numsSam = plan.sched.filter((m) => m.day === "samedi").map((m) => m.num);
  const numsDim = plan.sched.filter((m) => m.day === "dimanche").map((m) => m.num);
  ok("numérotation : tous les N° du samedi inférieurs à ceux du dimanche",
     numsSam.length > 0 && numsDim.length > 0 && Math.max(...numsSam) < Math.min(...numsDim),
     "max sam=" + Math.max(...numsSam) + " min dim=" + Math.min(...numsDim));

  /* ---- 3. « Vainqueur 169 » : source fid → numéro du match gagné ---- */
  const D1 = { samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50" } };
  const plan1 = computePlan([{ disc: "DM", classement: "Série 4", nb: 9, qualifs: 2, jour: "samedi" }], D1, 28, 0);
  const b = plan1.built[0];
  const demi = plan1.sched.find((m) => m.tid === 0 && m.fid === "T2-1");
  const quart = plan1.sched.find((m) => m.tid === 0 && m.fid === "T1-1");
  ok("structure : la demi T2-1 a bien la source fid T1-1",
     b.playedFinals.find((m) => m.fid === "T2-1").a === "T1-1", "");
  ok("libellé : « Vainqueur <N° du quart> » (pas « Vainqueur T1-1 »)",
     vlbl(plan1, demi, "T1-1") === "Vainqueur " + quart.num,
     vlbl(plan1, demi, "T1-1") + " (quart N°" + quart.num + ")");
  const srcObj = b.playedFinals.find((m) => m.fid === "T2-1").b; // qualifié exempté (objet)
  ok("source objet (exempt) : libellé qualLabel inchangé",
     vlbl(plan1, demi, srcObj) === qualLabel(srcObj), vlbl(plan1, demi, srcObj));

  /* ---- 4. repli : source forfait (W.O.) non planifiée ---- */
  const planW = computePlan([{ disc: "DM", classement: "Série 4", nb: 9, qualifs: 2, jour: "samedi" }], D1, 28, 0, false, false, new Set(["F0-T1-1"]));
  const demiW = planW.sched.find((m) => m.tid === 0 && m.fid === "T2-1");
  ok("repli forfait : « Vainqueur T1-1 » conservé (match non planifié)",
     demiW !== undefined && vlbl(planW, demiW, "T1-1") === "Vainqueur T1-1", vlbl(planW, demiW, "T1-1"));

  /* ---- 5. v1.7.1 : listes multi-jours d'un tableau « les deux jours » ----
     régression : les vues par classement/par tableau triaient par heure
     seule — le dimanche 08:30 s'affichait avant le samedi 17:43 */
  const D2 = { samedi: { actif: true, terrains: 8, debut: "08:30", fin: "13:00" }, dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00" } };
  const planD = computePlan([{ disc: "DX", classement: "Série 3", nb: 12, qualifs: 2, jour: "les-deux" }], D2, 28, 0);
  const msD = planD.sched.filter((m) => m.tid === 0).slice().sort(ordMatches(planD));
  const idxDim = msD.findIndex((m) => m.day === "dimanche");
  ok("les-deux : le tableau a des matchs sur les deux jours", idxDim > 0 && msD.length - idxDim > 0, "matchs dim=" + (msD.length - idxDim));
  ok("liste multi-jours : le premier match du dimanche arrive APRÈS tous ceux du samedi",
     idxDim > 0 && msD.slice(0, idxDim).every((m) => m.day === "samedi"), "premier dim en position " + idxDim + "/" + msD.length);
  const cle = (m) => planD.days.indexOf(m.day) * 1e6 + m.time * 10 + m.court;
  ok("liste multi-jours : ordre croissant (jour, puis heure, puis terrain)",
     msD.every((m, i) => i === 0 || cle(m) >= cle(msD[i - 1])), "");
})();
`;
eval(harness);
if (fails.length) { console.log("ÉCHECS :"); fails.forEach((f) => console.log("  ✗", f)); process.exit(1); }
console.log("TOUS LES TESTS ORDRE DES JOURS + VAINQUEUR N° SONT OK");
