/* Test v1.5.1 : exempts du tableau final (bracket incomplet).
   Signalement du juge-arbitre : « le match 261 devrait être programmé après
   le 263 car le 261 et 279 dépendent des 249 et 263 — les 1/4 avant les
   1/2, les 1/8 avant les 1/4 ». Cause réelle : dans un bracket incomplet
   (ex. 6 qualifiés → bracket de 8), les tours suivants référençaient les
   exempts par « Vainqueur Tx-y » — des matchs jamais joués ni affichés ;
   les demis semblaient dépendre de quarts qui n'existent pas. Vérifie :
   1. aucune source « Vainqueur Tx-y » fantôme : toute source de type fid
      référence un match réellement joué (ou forfait) du même tableau ;
   2. les côtés exempts référencent le qualifié lui-même (objet poule/ronde) ;
   3. une demi démarre bien après la fin + repos de SA source réelle (le
      quart joué), même si l'autre quart démarre plus tard ;
   4. invariant général : chaque match de tableau final démarre ≥ fin +
      repos de chacune de ses sources-fid (forfaits inclus, récursivement) ;
   5. dénombrement des exempts = paperRounds[0] − roundsCount[0] = nombre
      de byes du 1er tour ;
   v1.6 — ordre strict des tours d'un même tableau (exigence juge-arbitre) :
   6. un tour r ≥ 1 ne démarre qu'après la FIN de TOUS les matchs du tour
      r-1 du même tableau (les 1/8 avant les 1/4, les 1/4 avant les 1/2) ;
   7. le 1er tour ne démarre qu'après la fin de toutes les poules/rondes
      du tableau + repos (plus de quart pendant la dernière ronde). */
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier.md"), "utf8");
const lines = src.split("\n");
const markerIdx = lines.findIndex((l) => l.includes("Composant principal"));
let engine = lines.slice(25, markerIdx - 1).join("\n");
engine = engine.replace(/function AttBadge\(\{ att, phase \}\) \{[\s\S]*?\n\}/, "function AttBadge({ att, type }) { return att === null || att === undefined ? (type !== null && type !== undefined ? '≈ ' + attFmt(type) : '1er tour') : attFmt(att); }");

const fails = [];
const ok = (name, cond, detail) => { if (!cond) fails.push(name + (detail ? " : " + detail : "")); };

const harness = engine + `
;(function () {
  const D1 = { samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50" } };
  const mduree = (m) => (m.duree !== undefined ? m.duree : 28);

  /* ---- 1-2. structure : aucune source fantôme, exempts = qualifiés ---- */
  let nTabs = 0, nExempts = 0;
  for (let nb = 3; nb <= 30; nb++) {
    for (let q = 1; q <= 3; q++) {
      [false, true].forEach((suisse) => {
        const t = { disc: "SM", classement: "", nb: nb, qualifs: q, jour: "samedi", format: "", rondes: "" };
        if (suisse) { t.format = "suisse-elim"; t.rondes = ""; }
        const b = buildTab(t, 0);
        nTabs++;
        const fids = new Set(b.playedFinals.map((m) => m.fid));
        b.playedFinals.forEach((m) => {
          [m.a, m.b].forEach((s) => {
            if (s === null || s === undefined) { fails.push("source nulle : " + b.label + " " + m.fid); return; }
            if (typeof s === "string") {
              if (!fids.has(s)) fails.push("source FANTÔME « Vainqueur " + s + " » : " + b.label + " " + m.fid + " (nb=" + nb + " q=" + q + (suisse ? " suisse" : "") + ")");
            } else {
              // qualifié direct légitime : entrant (élim. directe), sorti de
              // poule, ou sorti de ronde suisse
              if (s.nom === undefined && s.pi === undefined && s.suisse === undefined)
                fails.push("source objet non qualifié : " + JSON.stringify(s));
            }
          });
        });
        const byes = b.finals.filter((m) => m.round === 0 && m.bye).length;
        const ex = (b.paperRounds[0] || 0) - (b.roundsCount[0] || 0);
        if (byes !== ex) fails.push("exempts comptés " + ex + " ≠ byes " + byes + " (nb=" + nb + " q=" + q + ")");
        nExempts += ex;
      });
    }
  }
  console.log("structure : " + nTabs + " tableaux testés, " + nExempts + " exempts au 1er tour, sources toutes réelles : " + (fails.length === 0 ? "OUI" : "NON"));

  /* ---- 3. cas du juge-arbitre : DM 9 paires (6 qualifiés, bracket 8) ---- */
  const plan = computePlan([
    { disc: "DM", classement: "Série 4", nb: 9, qualifs: 2, jour: "samedi" },
    { disc: "SM", classement: "Série 2", nb: 18, qualifs: 2, jour: "samedi" },
  ], D1, 28, 0);
  const dm = plan.built[0], sm = plan.built[1];
  const byFid = (b) => { const M = new Map(); b.playedFinals.forEach((m) => M.set(m.fid, m)); return M; };
  const DM = byFid(dm), SM = byFid(sm);

  const demi1 = DM.get("T2-1"), demi2 = DM.get("T2-2");
  const srcDemi1 = [demi1.a, demi1.b].filter((s) => typeof s === "string");
  const srcDemi1Obj = [demi1.a, demi1.b].filter((s) => typeof s !== "string");
  ok("demi T2-1 : exactement 1 source-fid (T1-1) et 1 exempt", srcDemi1.length === 1 && srcDemi1[0] === "T1-1" && srcDemi1Obj.length === 1, JSON.stringify([demi1.a, demi1.b]));
  const srcDemi2 = [demi2.a, demi2.b].filter((s) => typeof s === "string");
  ok("demi T2-2 : exactement 1 source-fid (T1-4) et 1 exempt", srcDemi2.length === 1 && srcDemi2[0] === "T1-4", JSON.stringify([demi2.a, demi2.b]));
  const quart1 = DM.get("T1-1"), quart4 = DM.get("T1-4");
  const mDemi1 = plan.sched.find((m) => m.tid === 0 && m.fid === "T2-1");
  const mDemi2 = plan.sched.find((m) => m.tid === 0 && m.fid === "T2-2");
  const mQuart1 = plan.sched.find((m) => m.tid === 0 && m.fid === "T1-1");
  const mQuart4 = plan.sched.find((m) => m.tid === 0 && m.fid === "T1-4");
  ok("demi T2-1 après fin + repos de son quart T1-1", mDemi1.time >= mQuart1.time + mduree(mQuart1) + REPOS, mDemi1.time + " vs " + (mQuart1.time + mduree(mQuart1) + REPOS));
  ok("demi T2-2 après fin + repos de son quart T1-4", mDemi2.time >= mQuart4.time + mduree(mQuart4) + REPOS, "");
  ok("les deux quarts se jouent avant la FINALE", plan.sched.find((m) => m.tid === 0 && m.fid === "T3-1").time >= Math.max(mDemi1.time + mduree(mDemi1), mDemi2.time + mduree(mDemi2)) + REPOS, "");
  // v1.6 — ordre strict : la demi T2-1 attend désormais la FIN de TOUS
  // les quarts du tableau (T1-1 à T1-4), même si elle ne dépend que de
  // T1-1 — plus aucun parallélisme demi/quart dans un même tableau
  const quartsDM = plan.sched.filter((m) => m.tid === 0 && m.phase === "finale" && m.round === 0);
  const finQuarts = Math.max(...quartsDM.map((m) => m.time + mduree(m)));
  console.log("demi T2-1 " + fmtTime(mDemi1.time) + " · dernier quart du tableau DM fini " + fmtTime(finQuarts) + (mDemi1.time >= finQuarts ? " — ordre strict respecté" : " — PARALLÉLISME INTERDIT DÉTECTÉ"));
  ok("v1.6 : demi T2-1 démarre après la FIN de tous les quarts du tableau DM", mDemi1.time >= finQuarts, "");
  const poolEndDM = Math.max(...plan.sched.filter((m) => m.tid === 0 && m.phase === "poule").map((m) => m.time + mduree(m)));
  ok("v1.6 : 1er tour DM démarre après la fin de toutes les poules + repos", mQuart1.time >= poolEndDM + REPOS, mQuart1.time + " vs " + (poolEndDM + REPOS));

  /* ---- 4. invariant général sur les sources-fid (forfaits inclus) ---- */
  const feederEndRec = (b, M, fid) => {
    const fm = M.get(fid);
    if (fm === undefined) return null; // exempt : pas de match
    if (fm.forfait) {
      const s1 = feederEndRec(b, M, fm.a), s2 = feederEndRec(b, M, fm.b);
      const v = [s1, s2].filter((x) => x !== null);
      return v.length ? Math.max(...v) : null;
    }
    return fm.time + mduree(fm);
  };
  plan.built.forEach((b) => {
    const M = byFid(b);
    b.playedFinals.forEach((m) => {
      if (m.forfait) return;
      const mm = plan.sched.find((x) => x.tid === b.tid && x.fid === m.fid);
      if (!mm) return;
      [m.a, m.b].forEach((s) => {
        if (typeof s !== "string") return;
        const e = feederEndRec(b, M, s);
        if (e !== null && mm.time < e + REPOS)
          fails.push("ordre violé : " + b.label + " " + m.fid + " (" + fmtTime(mm.time) + ") avant fin+repos de " + s + " (" + fmtTime(e) + ")");
      });
    });
  });
  console.log("invariant sources-fid (fin + repos 20 min) sur le tournoi : " + (fails.length === 0 ? "OK" : "ÉCHECS"));

  /* ---- 5. SM 18 joueurs (12 qualifiés, bracket 16, 4 exempts) ---- */
  ["T2-1", "T2-2", "T2-3", "T2-4"].forEach((fid) => {
    const m = SM.get(fid);
    const fids2 = [m.a, m.b].filter((s) => typeof s === "string");
    const objs2 = [m.a, m.b].filter((s) => typeof s !== "string");
    ok("1/4 " + fid + " : 1 source-fid + 1 exempt", fids2.length === 1 && objs2.length === 1, JSON.stringify([m.a, m.b]));
  });
  ok("SM : 4 exempts au 1er tour", (sm.paperRounds[0] || 0) - (sm.roundsCount[0] || 0) === 4, "");
  ok("libellé exempt lisible (pas « Vainqueur T1-2 »)", qualLabel(SM.get("T2-1").b).indexOf("Vainqueur") !== 0 && typeof SM.get("T2-1").b !== "string" ? true : typeof SM.get("T2-1").b !== "string" || qualLabel(SM.get("T2-1").b).indexOf("poule") >= 0, "");
  ok("libellé demi DM sans fantôme", qualLabel(demi1.b).indexOf("Vainqueur") !== 0, qualLabel(demi1.b));

  /* ---- 6-7. v1.6 : ordre strict des tours sur tous les tableaux ---- */
  plan.built.forEach((b) => {
    const R = {};
    plan.sched.forEach((m) => { if (m.tid === b.tid && m.phase === "finale") (R[m.round] = R[m.round] || []).push(m); });
    Object.keys(R).map(Number).sort((x, y) => x - y).forEach((r) => {
      if (r === 0) return;
      const prev = R[r - 1] || [];
      if (!prev.length) return; // tour précédent joué un autre jour (coupure 2 jours)
      const prevEnd = Math.max(...prev.map((m) => m.time + mduree(m)));
      R[r].forEach((m) => ok("ordre strict " + b.label + " : tour " + (r + 1) + " (" + m.fid + ", " + fmtTime(m.time) + ") après la fin du tour " + r + " (" + fmtTime(prevEnd) + ")", m.time >= prevEnd, ""));
    });
    const poolMs2 = plan.sched.filter((m) => m.tid === b.tid && m.phase === "poule");
    if (poolMs2.length) {
      const pe = Math.max(...poolMs2.map((m) => m.time + mduree(m)));
      (R[0] || []).forEach((m) => ok("1er tour " + b.label + " (" + m.fid + ", " + fmtTime(m.time) + ") après fin des poules + repos (" + fmtTime(pe + REPOS) + ")", m.time >= pe + REPOS, ""));
    }
  });
  console.log("ordre strict des tours (tous tableaux, tous tours) : " + (fails.length === 0 ? "OK" : "ÉCHECS"));

})();
`;
eval(harness);
if (fails.length) { console.log("ÉCHECS :"); fails.forEach((f) => console.log("  ✗", f)); process.exit(1); }
console.log("TOUS LES TESTS EXEMPTS (BRACKET) SONT OK");
