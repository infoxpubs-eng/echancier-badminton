/* Harnais de rendu : moteur extrait à neuf du canvas + expressions des vues
   (synthèse, planning, classement, par tableau, badges d'attente). */
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier.md"), "utf8");
const lines = src.split("\n");
// moteur : lignes 26 jusqu'à la fin de computePlan (auto-détecté)
const markerIdx = lines.findIndex((l) => l.includes("Composant principal"));
let engine = lines.slice(25, markerIdx - 1).join("\n");
// AttBadge contient du JSX : remplacée par une version JS pure
engine = engine.replace(/function AttBadge\(\{ att \}\) \{[\s\S]*?\n\}/, "function AttBadge({ att }) { return att === null || att === undefined ? '1er tour' : attFmt(att); }");
if (engine.includes("<")) { /* vérif JSX résiduel */ 
  const jsxLeft = /<[A-Za-z]/.test(engine.replace(/<=/g, "").replace(/->/g, ""));
  if (jsxLeft) { console.error("JSX résiduel dans le moteur extrait !"); process.exit(1); }
}

const harness = engine + `

/* ===== écran tournoi : toutes les vues ===== */
function renderTournoi(tabs, jours, dureeMatch) {
  const plan = computePlan(tabs, jours, dureeMatch);
  const jourKeys = ["synthese", "planning", "classement"].concat(plan.built.map((b) => "t" + b.tid));
  const jourLabels = { synthese: "📊 Synthèse", planning: "🗓️ Planning", classement: "🏷️ Par classement" };
  const boutons = jourKeys.map((k) => jourLabels[k] || ((plan.built[+k.slice(1)] || {}).label || "Tableau"));
  const dureeEff = Math.max(28, Math.floor(+dureeMatch) || 28);
  const mduree = (m) => (m.duree !== undefined ? m.duree : dureeEff);
  const statsJour = plan.days.map((day) => {
    const ms = plan.perDay[day] || [];
    const derniereFin = ms.length ? Math.max(...ms.map((m) => m.time + mduree(m))) : 0;
    const fin = toMin(jours[day].fin, 18 * 60);
    const debut = toMin(jours[day].debut, 9 * 60);
    const at = plan.attentes.filter((a) => a.day === day);
    return {
      day, nb: ms.length, derniereFin, fin, debut,
      depasse: ms.length > 0 && derniereFin > fin,
      marge: fin - derniereFin,
      attMax: at.length ? Math.max(...at.map((a) => a.w)) : 0,
      attMoy: at.length ? Math.round(at.reduce((s, a) => s + a.w, 0) / at.length) : 0,
      att60: ms.filter((m) => m.att !== null && m.att >= 60).length,
    };
  });
  const total = plan.sched.length;
  const att60 = plan.sched.filter((m) => m.att !== null && m.att >= 60).length;
  const attMaxAll = plan.sched.filter((m) => m.att !== null).reduce((s, m) => Math.max(s, m.att), 0);
  // légende
  const legende = ATT_STEPS.map((s) => attStep(0) && s.lbl).join(",");
  // vue synthèse
  const synthese = plan.built.map((b) => {
    const ms = plan.sched.filter((m) => m.tid === b.tid);
    const totalM = b.poolMs.length + b.playedFinals.length;
    if (!ms.length) return { label: b.label, n: b.n, nonPlan: totalM };
    const st = attStats(ms);
    const prem = Math.min(...ms.map((m) => m.appel));
    const dern = Math.max(...ms.map((m) => m.time)) + dureeEff;
    const jours_ = [...new Set(ms.map((m) => m.day))].map((d) => d.slice(0, 3) + ".").join(" + ");
    const struct = b.P === 0 ? "direct" : b.sizes.join(" + ") + " (" + b.P + ")";
    const sortants = b.P === 0 ? "—" : b.Q + "/poule → " + b.P * b.Q + " qual.";
    const parcours = parcoursStr(b, plan.cuts[b.tid]);
    const attMaxBadge = AttBadge({ att: st.max });
    return { label: b.label, n: b.n, struct, sortants, parcours, nb: ms.length, nbTotal: totalM, horaire: jours_ + " · " + fmtTime(prem) + " → " + fmtTime(dern), attMaxBadge };
  });
  // vue planning (+ badges attente)
  const vuePlanning = plan.days.map((day) => {
    const ms = (plan.perDay[day] || []).slice().sort((a, b) => a.time - b.time || a.court - b.court);
    return ms.map((m) => ({
      appel: fmtTime(m.appel), debut: fmtTime(m.time), terrain: "T" + (m.court + 1),
      label: plan.built[m.tid].label,
      tour: tourLabel(m, plan.built[m.tid]),
      rencontre: m.phase === "poule" ? m.a + " vs " + m.b : qualLabel(m.a) + " / " + qualLabel(m.b),
      badge: AttBadge({ att: m.att }),
    }));
  });
  // vue par classement
  const vueClassement = plan.built.map((b) => {
    const ms = plan.sched.filter((m) => m.tid === b.tid).sort((x, y) => x.time - y.time);
    if (!ms.length) return null;
    const st = attStats(ms);
    const prem = Math.min(...ms.map((m) => m.appel));
    const dern = Math.max(...ms.map((m) => m.time)) + dureeEff;
    return {
      label: b.label, nb: ms.length, horaire: fmtTime(prem) + " → " + fmtTime(dern),
      attMax: attFmt(st.max), attMoy: attFmt(st.moy),
      rows: ms.map((m) => ({
        day: m.day, appel: fmtTime(m.appel), debut: fmtTime(m.time), terrain: "T" + (m.court + 1),
        tour: tourLabel(m, b),
        badge: AttBadge({ att: m.att }),
      })),
    };
  });
  // vues par tableau
  const vueTab = plan.built.map((b) => {
    const ms = plan.sched.filter((m) => m.tid === b.tid).sort((a, b2) => a.time - b2.time);
    return {
      label: b.label, P: b.P, n: b.n, unit: b.unit, Q: b.Q,
      cut: plan.cuts[b.tid] ? plan.cuts[b.tid].label.toLowerCase() : null,
      poules: b.pools.map((ids, pi) => ids.map((i) => b.nom(i)).join(", ")),
      rows: ms.map((m) => ({ day: m.day, tour: tourLabel(m, b), badge: AttBadge({ att: m.att }) })),
    };
  });
  return { statsJour, total, att60, attMaxAll, boutons, legende, synthese, vuePlanning, vueClassement, vueTab };
}

/* ===== écran config ===== */
function renderConfig(tabs, jours, dureeMatch, marge) {
  const joursKeys = Object.keys(jours);
  const joursActifs = joursKeys.filter((j) => jours[j].actif);
  const dureeJour = (j) => {
    const J = jours[j];
    return dureeCalc(
      J.dureeMatch !== undefined && J.dureeMatch !== "" ? J.dureeMatch : dureeMatch,
      J.marge !== undefined && J.marge !== "" ? J.marge : (marge || 0)
    );
  };
  const capJour = (j) => {
    const J = jours[j];
    const terr = Math.max(1, Math.floor(+J.terrains) || 1);
    const minutes = toMin(J.fin, 18 * 60) - toMin(J.debut, 9 * 60);
    return Math.max(0, minutes) * terr / dureeJour(j);
  };
  const matchsTab = (t) => { const b = buildTab(t, 0); return b.poolMs.length + b.playedFinals.length; };
  const besoinFixe = {};
  let besoinDeux = 0, besoinTotal = 0;
  tabs.forEach((t) => {
    const n = matchsTab(t);
    besoinTotal += n;
    if (joursKeys.includes(t.jour)) besoinFixe[t.jour] = (besoinFixe[t.jour] || 0) + n;
    else besoinDeux += n;
  });
  const capTotal = joursKeys.reduce((s2, j) => s2 + (jours[j].actif ? capJour(j) : 0), 0);
  const rows = joursKeys.map((j) => {
    const cap = Math.floor(capJour(j));
    const besoin = besoinFixe[j] || 0;
    const marge = jours[j].actif ? cap - besoin : 0;
    return { j, cap, besoin, marge };
  });
  const builtAll = tabs.map((t, k) => buildTab(t, k));
  const cuts = cutsDeuxJours(builtAll, jours, joursActifs.length ? dureeJour(joursActifs[0]) : dureeCalc(dureeMatch, marge || 0));
  const lignes = builtAll.filter((b) => cuts[b.tid])
    .map((b) => b.label + " : jour 2 à partir des " + cuts[b.tid].label.toLowerCase());
  const previews = tabs.map((t, i) => {
    const b = buildTab(t, i);
    const p1 = b.P === 0 ? "direct : " + b.n + " (" + b.playedFinals.length + ")" : null;
    const p2 = b.P > 0 ? b.P + " poules : " + b.sizes.join(" + ") + ", " + b.Q + " sortants" : null;
    const p5 = t.jour === "les-deux" ? (cuts[i] ? "J2 : " + cuts[i].label.toLowerCase() : "") : "";
    return { label: b.label, p1, p2, p5 };
  });
  return { rows, besoinTotal, besoinDeux, capTotal: Math.floor(capTotal), lignes, previews };
}

/* ================== TESTS ================== */
const failures = [];
function tryCase(name, fn) {
  try { fn(); } catch (e) { failures.push({ name, msg: e.message, stack: String(e.stack).split("\\n").slice(0, 5).join(" | ") }); }
}
const D = (over) => Object.assign({ samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50" }, dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00" } }, over);
const T = (over) => Object.assign({ disc: "SM", classement: "", nb: 16, qualifs: 2, jour: "samedi" }, over);

const nbs = [3, 4, 5, 6, 9, 10, 13, 16, 20, 24, 25, 26, 33, 40, 64, 100, "", "0", "abc", 0, -5, 3.7];
const joursSet = [
  D(),
  D({ samedi: { actif: false, terrains: 8, debut: "08:30", fin: "21:50" } }),
  D({ dimanche: { actif: false, terrains: 8, debut: "08:30", fin: "17:00" } }),
  D({ samedi: { actif: true, terrains: "", debut: "", fin: "" } }),
  D({ samedi: { actif: true, terrains: 0, debut: "21:00", fin: "08:30" } }),
  D({ samedi: { actif: false, terrains: 8, debut: "08:30", fin: "21:50" }, dimanche: { actif: false, terrains: 8, debut: "08:30", fin: "17:00" } }),
];
const quals = ["", 1, 2, 3, 4, "0"];
const joursTab = ["samedi", "dimanche", "les-deux"];

let count = 0;
for (const jours of joursSet) {
  for (const nb of nbs) {
    for (const q of quals) {
      for (const jt of joursTab) {
        const tabs = [T({ nb, qualifs: q, jour: jt }), T({ disc: "DX", nb, qualifs: q, jour: jt })];
        for (const dm of [28, 35, "", "abc"]) {
          count++;
          tryCase("config nb=" + JSON.stringify(nb) + " q=" + JSON.stringify(q) + " jt=" + jt + " dm=" + JSON.stringify(dm), () => renderConfig(tabs, jours, dm));
          tryCase("tournoi idem", () => renderTournoi(tabs, jours, dm));
        }
      }
    }
  }
}
tryCase("aucun tableau", () => { renderConfig([], D(), 28); renderTournoi([], D(), 28); });
tryCase("multi tabs", () => {
  const tabs = [T({ nb: 24, jour: "samedi" }), T({ disc: "DM", nb: 30, jour: "les-deux" }), T({ disc: "SD", classement: "D9-P12", nb: 10, qualifs: 1, jour: "dimanche" }), T({ disc: "DX", nb: 5, jour: "les-deux" })];
  renderConfig(tabs, D(), 28);
  renderTournoi(tabs, D(), 28);
});

console.log("cas testés:", count * 2 + 4, "| échecs:", failures.length);
failures.slice(0, 10).forEach((f) => console.log("ÉCHEC:", f.name, "\\n   ", f.msg, "\\n   ", f.stack));

/* ===== contrôles sémantiques ===== */
const chk = [];
function expect(name, cond, got) { if (!cond) chk.push(name + " → " + JSON.stringify(got)); }
// badges d'attente : plages et formats
expect("attFmt 45", attFmt(45) === "45 min", attFmt(45));
expect("attFmt 60", attFmt(60) === "1h", attFmt(60));
expect("attFmt 95", attFmt(95) === "1h35", attFmt(95));
expect("attStep 0→<30", attStep(0).lbl === "< 30 min", attStep(0).lbl);
expect("attStep 30", attStep(30).lbl === "30 min – 1h", attStep(30).lbl);
expect("attStep 59", attStep(59).lbl === "30 min – 1h", attStep(59).lbl);
expect("attStep 60", attStep(60).lbl === "1h – 1h30", attStep(60).lbl);
expect("attStep 90", attStep(90).lbl === "1h30 – 2h", attStep(90).lbl);
expect("attStep 121", attStep(121).lbl === "≥ 2h", attStep(121).lbl);
// chaque match planifié a un champ att cohérent
const plan = computePlan([T({ nb: 16 }), T({ disc: "DX", nb: 8, jour: "les-deux" })], D(), 28);
plan.sched.forEach((m) => expect("att défini (" + m.phase + ")", m.att === null || (Number.isFinite(m.att) && m.att >= 0), m.att));
const nAtt = plan.sched.filter((m) => m.att !== null).length;
const nFirst = plan.sched.filter((m) => m.att === null).length;
expect("att mix présents", nAtt > 0 && nFirst > 0, { nAtt, nFirst });
// parcoursStr
const b16 = buildTab(T({ nb: 16 }), 0);
expect("parcours SM16", parcoursStr(b16, null).startsWith("Poules → "), parcoursStr(b16, null));
const b30 = buildTab(T({ nb: 30 }), 0);
expect("parcours direct", !parcoursStr(b30, null).includes("Poules"), parcoursStr(b30, null));
expect("parcours niveaux", parcoursStr(b16, null).includes("1/"), parcoursStr(b16, null));
// TOUR : étiquettes
const pl = renderTournoi([T({ nb: 16 }), T({ disc: "DX", nb: 8, jour: "les-deux" })], D(), 28);
const tours = pl.vuePlanning.flat().map((r) => r.tour);
expect("tours « Tour N · Poule M »", tours.some((t) => /^Tour [0-9]+ · Poule [0-9]+$/.test(t)), tours.slice(0, 3));
expect("tours « 1/x Finale »", tours.some((t) => /^[0-9/]+ Finale$|^Finale$/.test(t)), tours.slice(-4));
// ATTENTE : sémantique par joueur/paire (att >= attente de schedule slack)
const plan2 = computePlan([T({ nb: 16 }), T({ disc: "DX", nb: 8, jour: "les-deux" })], D(), 28);
plan2.sched.forEach((m) => expect("att défini (" + m.phase + ")", m.att === null || (Number.isFinite(m.att) && m.att >= 0), m.att));
// vérif manuelle du calcul max des deux joueurs pour un match de poule
const day1 = (plan2.perDay.samedi || []).filter((m) => m.phase === "poule").sort((a, b) => a.time - b.time);
const fin1 = new Map();
for (const m of day1) {
  const wa = fin1.has(m.aK) ? m.time - fin1.get(m.aK) : -1;
  const wb = fin1.has(m.bK) ? m.time - fin1.get(m.bK) : -1;
  const expected = wa < 0 && wb < 0 ? null : Math.max(wa, wb);
  expect("att pool re-calcul", m.att === expected, { att: m.att, expected, a: m.a, b: m.b });
  fin1.set(m.aK, m.time + 28); fin1.set(m.bK, m.time + 28);
}
// classement : toutes vues rendues
expect("boutons 5", pl.boutons.length === 5, pl.boutons);
expect("synthese 2", pl.synthese.length === 2, pl.synthese.length);
expect("classement 2", pl.vueClassement.filter(Boolean).length === 2, pl.vueClassement.length);

/* ===== paramétrage de base ===== */
const bt = baseTabs();
expect("baseTabs 25 tableaux", bt.length === 25, bt.length);
expect("baseTabs séries 1..5", bt.slice(0, 5).map((t) => t.classement).join(",") === "Série 1,Série 2,Série 3,Série 4,Série 5", bt.slice(0, 5).map((t) => t.classement));
expect("baseTabs nb 9 partout", bt.every((t) => t.nb === 9), bt.map((t) => t.nb));
expect("baseTabs SM/SD/DX samedi", bt.filter((t) => ["SM", "SD", "DX"].includes(t.disc)).every((t) => t.jour === "samedi"), true);
expect("baseTabs DM/DD dimanche", bt.filter((t) => ["DM", "DD"].includes(t.disc)).every((t) => t.jour === "dimanche"), true);
expect("baseTabs pas d'intergenre", !bt.some((t) => t.disc === "SI" || t.disc === "DI"), true);
// la config de base se rend sans erreur (défauts : pas de combos, finales à la suite)
const plBase = renderTournoi(baseTabs(), D(), 28);
expect("baseTabs boutons 28", plBase.boutons.length === 28, plBase.boutons.length);
const planBase = computePlan(baseTabs(), D(), 28, 0, false, false);
expect("baseTabs 25 built", planBase.built.length === 25, planBase.built.length);
const matchsTot = planBase.built.reduce((s, b) => s + b.poolMs.length + b.playedFinals.length, 0);
console.log("base (défaut) : " + matchsTot + " matchs, planifiés " + planBase.sched.length + ", non planifiés " + planBase.unscheduled.length);

/* ===== intercalage : une finale ne démarre qu'après SES deux sources ===== */
function feederInvariant(plan, duree, name, fails) {
  const byFid = new Map();
  plan.sched.forEach((m) => { if (m.phase !== "poule") byFid.set(m.tid + "|" + m.fid, m); });
  plan.sched.forEach((m) => {
    if (m.phase === "poule" || m.round === 0) return;
    [m.a, m.b].forEach((fid) => {
      const fm = byFid.get(m.tid + "|" + fid);
      if (fm !== undefined && m.time < fm.time + duree + REPOS)
        fails.push(name + " : finale " + m.fid + " démarre avant sa source " + fid);
    });
  });
}

/* ===== finalesFin (règle 2h30) : pour chaque tableau, l'attente entre la
   fin de SES poules et son premier match tenu (demis) reste ≤ FIN_HOLD +
   marge d'erreur d'estimation ; au-delà le tableau est libéré plus tôt ===== */
function finalesFinInvariant(plan, name, fails) {
  for (const day of plan.days) {
    const poolEndTab = {};
    (plan.perDay[day] || []).forEach((m) => {
      if (m.phase !== "poule") return;
      poolEndTab[m.tid] = Math.max(poolEndTab[m.tid] || -1e9, m.time + (m.duree !== undefined ? m.duree : 28));
    });
    (plan.perDay[day] || []).forEach((m) => {
      if (m.phase === "poule") return;
      const R = Object.keys(plan.built[m.tid].roundsCount).length;
      if (m.round !== R - 2) return; // premier match tenu (demis) du tableau
      const peTab = poolEndTab[m.tid];
      if (peTab === undefined) return; // tableau sans poules ce jour
      const wait = m.time - peTab;
      if (wait > FIN_HOLD + 60)
        fails.push(name + " : demi (" + m.fid + ") à " + fmtTime(m.time) + " soit " + wait + " min après la fin des poules du tableau (" + fmtTime(peTab) + ") — au-delà de 2h30 + marge");
    });
  }
}

/* ===== combosTox + rotation ===== */
function checkPhase(plan, name, fails) {
  for (const day of plan.days) {
    const starts = { 0: [], 1: [], 2: [] };
    (plan.perDay[day] || []).forEach((m) => {
      starts[DISC_PHASE[plan.built[m.tid].tab.disc] ?? 0].push(m.time);
    });
    for (let p = 0; p < 2; p++)
      if (starts[p].length && starts[p + 1].length && Math.max(...starts[p]) > Math.min(...starts[p + 1]))
        fails.push(name + " : phase " + p + " démarre après phase " + (p + 1) + " (" + day + ")");
  }
}
const toxTabs = [T({ nb: 16 }), T({ disc: "DX", nb: 16, jour: "samedi" }), T({ disc: "DM", nb: 16, jour: "samedi" }), T({ disc: "DD", nb: 12, jour: "les-deux" })];
const pfails = [];
const pOn = computePlan(toxTabs, D(), 28, 0, true, false);
checkPhase(pOn, "combosTox ON", pfails);
const pOff = computePlan(toxTabs, D(), 28, 0, false, false);
if (!pOff.sched.length) pfails.push("combosTox OFF : rien de planifié");
// invariant de repos conservé
for (const day of pOn.days) {
  const byP = new Map();
  (pOn.perDay[day] || []).forEach((m) => {
    if (m.phase !== "poule") return;
    (byP.get(m.aK) || byP.set(m.aK, []).get(m.aK)).push(m.time);
    (byP.get(m.bK) || byP.set(m.bK, []).get(m.bK)).push(m.time);
  });
  byP.forEach((times, k) => {
    times.sort((x, y) => x - y);
    for (let i = 1; i < times.length; i++)
      if (times[i] - times[i - 1] < 28 + REPOS) pfails.push("repos violé (" + k + ", " + day + ") : " + (times[i] - times[i - 1]));
  });
}
feederInvariant(pOn, 28, "combosTox", pfails);
feederInvariant(pOff, 28, "combosTox OFF", pfails);
// finalesFin : invariants sur scénario chargé et sur la base
const pFF = computePlan(toxTabs, D(), 28, 0, false, true);
finalesFinInvariant(pFF, "finalesFin", pfails);
feederInvariant(pFF, 28, "finalesFin", pfails);
if (!pFF.sched.length) pfails.push("finalesFin : rien de planifié");
const pBaseFF = computePlan(baseTabs(), D(), 28, 0, false, true);
finalesFinInvariant(pBaseFF, "base finalesFin", pfails);
feederInvariant(pBaseFF, 28, "base finalesFin", pfails);
console.log("base finalesFin : planifiés " + pBaseFF.sched.length + ", non planifiés " + pBaseFF.unscheduled.length);
// combosTox + base : sans crash
const pBaseOn = computePlan(baseTabs(), D(), 28, 0, true, false);
checkPhase(pBaseOn, "base combosTox", pfails);
if (!pBaseOn.sched.length) pfails.push("base combosTox : rien de planifié");
pfails.forEach((f) => chk.push(f));
console.log("contrôles sémantiques:", chk.length === 0 ? "OK" : "ÉCHECS");

/* ===== poule unique (3-5) : pas de sortants, pas de tableau final ===== */
for (const nb of [3, 4, 5]) {
  const bu = buildTab(T({ nb }), 0);
  expect("poule unique " + nb + " sans final", bu.P === 1 && bu.Q === 0 && bu.playedFinals.length === 0 && Object.keys(bu.roundsCount).length === 0 && bu.finals.length === 0, { P: bu.P, Q: bu.Q, f: bu.playedFinals.length, finals: bu.finals.length });
  expect("poule unique " + nb + " parcours", parcoursStr(bu, null) === "Poules", parcoursStr(bu, null));
}
const b6 = buildTab(T({ nb: 6 }), 0);
expect("2 poules : sortants + tableau final", b6.P === 2 && b6.Q >= 1 && b6.playedFinals.length > 0, { P: b6.P, Q: b6.Q, f: b6.playedFinals.length });
const pU = computePlan([T({ nb: 5, jour: "samedi" }), T({ disc: "DX", nb: 4, jour: "samedi" })], D(), 28);
expect("poules uniques : matchs de poule uniquement", pU.sched.every((m) => m.phase === "poule") && pU.unscheduled.length === 0, { sched: pU.sched.length, unsched: pU.unscheduled.length });
const pU2 = computePlan([T({ nb: 4, jour: "les-deux" })], D(), 28);
expect("poule unique les-deux planifiée", pU2.sched.length === pU2.built[0].poolMs.length && pU2.unscheduled.length === 0, { sched: pU2.sched.length });

/* ===== vues par classement et par série : colonnes Tour + Attente ===== */
expect("classement : tour + attente partout", pl.vueClassement.filter(Boolean).every((r) => r.rows.every((x) => typeof x.tour === "string" && typeof x.badge === "string")), true);
expect("par série : tour + attente partout", plBase.vueTab.every((v) => v.rows.every((x) => typeof x.tour === "string" && typeof x.badge === "string")), true);
expect("classement : étiquettes de tour", pl.vueClassement.filter(Boolean).every((r) => r.rows.every((x) => /^Tour [0-9]+ · Poule [0-9]+$/.test(x.tour) || /Finale$/.test(x.tour))), true);
/* ===== jours supplémentaires + options par jour ===== */
const D3 = { samedi: { actif: true, terrains: 8, debut: "08:30", fin: "18:00" }, dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00" }, "jour 3": { actif: true, terrains: 4, debut: "09:00", fin: "16:00", dureeMatch: 35, marge: 5, finalesFin: true } };
// jour supplémentaire : matchs planifiés sur ce jour, durée surchargée
const pJ3 = computePlan([T({ nb: 16, jour: "jour 3" }), T({ disc: "DX", nb: 8, jour: "samedi" }), T({ disc: "DM", nb: 9, jour: "dimanche" })], D3, 28, 0);
expect("jour 3 planifié", pJ3.days.includes("jour 3") && pJ3.sched.some((m) => m.day === "jour 3"), pJ3.days);
expect("jour 3 tout planifié", pJ3.unscheduled.length === 0, pJ3.unscheduled.length);
expect("durée par jour", pJ3.sched.every((m) => m.duree === (m.day === "jour 3" ? 40 : 28)), pJ3.sched.filter((m) => m.day === "jour 3")[0] && pJ3.sched.filter((m) => m.day === "jour 3")[0].duree);
expect("attentes cohérentes (jour 3)", pJ3.sched.every((m) => m.att === null || (Number.isFinite(m.att) && m.att >= 0)), true);
// repos respecté avec des durées différentes par jour
const reposJ3 = [];
for (const day of pJ3.days) {
  const byP = new Map();
  (pJ3.perDay[day] || []).forEach((m) => {
    if (m.phase !== "poule") return;
    (byP.get(m.aK) || byP.set(m.aK, []).get(m.aK)).push({ t: m.time, d: m.duree });
    (byP.get(m.bK) || byP.set(m.bK, []).get(m.bK)).push({ t: m.time, d: m.duree });
  });
  byP.forEach((lst, k) => {
    lst.sort((x, y) => x.t - y.t);
    for (let i = 1; i < lst.length; i++)
      if (lst[i].t - lst[i - 1].t < lst[i - 1].d + REPOS) reposJ3.push(day + " " + k);
  });
}
expect("repos par jour OK", reposJ3.length === 0, reposJ3.slice(0, 3));
// finalesFin par jour : le jour 3 seul est tenu (règle 2h30), les autres non
finalesFinInvariant(pJ3, "jour 3 finalesFin", pfails);
expect("jour 3 rendu vues", (() => { const pl = renderTournoi([T({ nb: 16, jour: "jour 3" })], D3, 28); return pl.statsJour.length === 3 && pl.boutons.length === 4; })(), true);
// jours inactifs seulement (jour 3 désactivé) : pas de match sur jour 3
const D3off = Object.assign({}, D3, { "jour 3": { actif: false, terrains: 4, debut: "09:00", fin: "16:00", dureeMatch: 35, marge: 5, finalesFin: true } });
const pJ3off = computePlan([T({ nb: 16, jour: "jour 3" })], D3off, 28, 0);
expect("jour 3 inactif : repli sur les autres jours", pJ3off.sched.length > 0 && pJ3off.sched.every((m) => m.day !== "jour 3"), pJ3off.days);
// finalesFin global (6e param) : repli pour un jour sans champ
const D3nf = Object.assign({}, D3, { "jour 3": { actif: true, terrains: 4, debut: "09:00", fin: "16:00", dureeMatch: 35, marge: 5 } });
const pJ3nf = computePlan([T({ nb: 16, jour: "jour 3" })], D3nf, 28, 0, false, true);
finalesFinInvariant(pJ3nf, "repli 6e param", pfails);
// marge par jour seulement
const Dm = { samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50", marge: 12 }, dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00" } };
const pDm = computePlan([T({ nb: 16, jour: "samedi" }), T({ disc: "DX", nb: 8, jour: "dimanche" })], Dm, 28, 0);
expect("marge par jour", pDm.sched.every((m) => m.duree === (m.day === "samedi" ? 40 : 28)), pDm.sched.filter((m) => m.day === "samedi")[0].duree);
// jours vides/champs invalides par jour : repli sur la valeur commune
const Dbad = { samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50", dureeMatch: "", marge: "" }, dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00" } };
const pBad = computePlan([T({ nb: 16, jour: "samedi" })], Dbad, 28, 0);
expect("overrides vides = communes", pBad.sched.every((m) => m.duree === 28), pBad.sched[0].duree);
pfails.forEach((f) => chk.push(f));
console.log("jours/par-jour : contrôles ajoutés OK");

/* ===== pause déjeuner par jour ===== */
const pDp = 12 * 60 + 30, pFp = 13 * 60 + 30;
const Dpause = D({ samedi: { actif: true, terrains: 3, debut: "08:30", fin: "21:50", pauseDebut: "12:30", pauseFin: "13:30" } });
const pPause = computePlan([T({ nb: 16 }), T({ disc: "DX", nb: 8, jour: "les-deux" })], Dpause, 28, 0);
expect("pause : aucun match ne la chevauche", (pPause.perDay.samedi || []).every((m) => m.time >= pFp || m.time + (m.duree !== undefined ? m.duree : 28) <= pDp),
  (pPause.perDay.samedi || []).filter((m) => m.time < pFp && m.time + 28 > pDp).length);
expect("pause : des matchs ont lieu après la reprise", (pPause.perDay.samedi || []).some((m) => m.time >= pFp), true);
// la pause réduit la capacité : au même horaire, la dernière fin est plus tardive
const pNoPause = computePlan([T({ nb: 16 }), T({ disc: "DX", nb: 8, jour: "les-deux" })], D({ samedi: { actif: true, terrains: 3, debut: "08:30", fin: "21:50" } }), 28, 0);
const finAvec = Math.max(...(pPause.perDay.samedi || []).map((m) => m.time + 28));
const finSans = Math.max(...(pNoPause.perDay.samedi || []).map((m) => m.time + 28));
expect("pause : capacité réduite (fin plus tardive)", finAvec >= finSans && (finAvec > finSans || pPause.sched.length !== pNoPause.sched.length), { finAvec, finSans, sched: pPause.sched.length, schedSans: pNoPause.sched.length });
// pause sur les deux jours + journée sans pause : dimanche non contraint
const Dpause2 = D({ samedi: { actif: true, terrains: 4, debut: "08:30", fin: "21:50", pauseDebut: "12:30", pauseFin: "13:30" }, dimanche: { actif: true, terrains: 4, debut: "08:30", fin: "17:00", pauseDebut: "12:00", pauseFin: "13:00" } });
const pPause2 = computePlan([T({ nb: 16 }), T({ disc: "DM", nb: 16, jour: "dimanche" })], Dpause2, 28, 0);
expect("pause : samedi respecté", (pPause2.perDay.samedi || []).every((m) => m.time >= pFp || m.time + 28 <= pDp), true);
expect("pause : dimanche respecté", (pPause2.perDay.dimanche || []).every((m) => m.time >= 13 * 60 || m.time + 28 <= 12 * 60), true);
// pause demi-définie ou inversée : pas de contrainte
const pDemi = computePlan([T({ nb: 16 })], D({ samedi: { actif: true, terrains: 3, debut: "08:30", fin: "21:50", pauseDebut: "12:30" } }), 28, 0);
expect("pause demi-définie : tolérante", (pDemi.perDay.samedi || []).some((m) => m.time < pFp && m.time + 28 > pDp), true);
// rendu des vues avec pause : pas d'erreur
expect("vues avec pause", (() => { const plp = renderTournoi([T({ nb: 16 }), T({ disc: "DX", nb: 8, jour: "les-deux" })], Dpause, 28); return plp.statsJour.length === 2 && plp.boutons.length === 5; })(), true);

/* ===== forfaits (W.O.) ===== */
const tabsW = [T({ nb: 16 }), T({ disc: "DX", nb: 8, jour: "les-deux" })];
const pWref = computePlan(tabsW, D(), 28, 0);
const fkey = pWref.sched.find((m) => m.phase === "poule").key;
const pW = computePlan(tabsW, D(), 28, 0, false, false, new Set([fkey]));
expect("W.O. poule : absent du sched", !pW.sched.some((m) => m.key === fkey), fkey);
expect("W.O. poule : pas dans unscheduled", !pW.unscheduled.some((m) => m.key === fkey), fkey);
expect("W.O. poule : présent dans forfaits", pW.forfaits.length === 1 && pW.forfaits[0].key === fkey, pW.forfaits.map((m) => m.key));
expect("W.O. poule : jour rattaché + att null", pW.forfaits[0].day !== null && pW.forfaits[0].att === null, { day: pW.forfaits[0].day, att: pW.forfaits[0].att });
expect("W.O. poule : un match de moins au total", pW.sched.length === pWref.sched.length - 1, { avant: pWref.sched.length, apres: pW.sched.length });
// W.O. sur un 1/4 de finale (round 0) : les tours suivants se jouent quand même
const fkeyF = pWref.sched.find((m) => m.phase !== "poule" && m.round === 0).key;
const pWF = computePlan(tabsW, D(), 28, 0, false, false, new Set([fkeyF]));
expect("W.O. finale : absent du sched", !pWF.sched.some((m) => m.key === fkeyF), fkeyF);
expect("W.O. finale : tours suivants planifiés", pWF.sched.filter((m) => m.phase !== "poule").length > 0, pWF.sched.filter((m) => m.phase !== "poule").length);
// invariants de repos + intercalage sur les plans avec W.O.
const wfails = [];
feederInvariant(pW, 28, "W.O. poule", wfails);
feederInvariant(pWF, 28, "W.O. finale", wfails);
for (const day of pW.days) {
  const byP = new Map();
  (pW.perDay[day] || []).forEach((m) => {
    if (m.phase !== "poule") return;
    (byP.get(m.aK) || byP.set(m.aK, []).get(m.aK)).push(m.time);
    (byP.get(m.bK) || byP.set(m.bK, []).get(m.bK)).push(m.time);
  });
  byP.forEach((times, k) => {
    times.sort((x, y) => x - y);
    for (let i = 1; i < times.length; i++)
      if (times[i] - times[i - 1] < 28 + REPOS) wfails.push("W.O. repos violé (" + k + ", " + day + ")");
  });
}
expect("W.O. : invariants repos/intercalage", wfails.length === 0, wfails.slice(0, 3));
// plusieurs W.O. d'un coup
const fkeys2 = pWref.sched.filter((m) => m.phase === "poule").slice(0, 3).map((m) => m.key);
const pW3 = computePlan(tabsW, D(), 28, 0, false, false, new Set(fkeys2));
expect("3 W.O. : enregistrés et exclus", pW3.forfaits.length === 3 && pW3.sched.length === pWref.sched.length - 3, { forf: pW3.forfaits.length, sched: pW3.sched.length });
// Set vide / undefined : comportement inchangé (compat)
expect("forfaits undefined : inchangé", JSON.stringify(computePlan(tabsW, D(), 28, 0, false, false).sched.length) === JSON.stringify(pWref.sched.length) && computePlan(tabsW, D(), 28, 0, false, false, new Set()).sched.length === pWref.sched.length, true);

/* ===== fin estimée par tableau : cohérence avec les stats du jour ===== */
let finEstOk = true;
for (const b of planBase.built) {
  const ms = planBase.sched.filter((m) => m.tid === b.tid);
  if (!ms.length) continue;
  let dernM = { day: ms[ms.length - 1].day, end: -1e9 };
  ms.forEach((m) => { const e = m.time + (m.duree !== undefined ? m.duree : 28); if (e > dernM.end) dernM = { day: m.day, end: e }; });
  const finOff = toMin(D()[dernM.day].fin, 18 * 60);
  if (!Number.isFinite(dernM.end) || dernM.end <= 0) finEstOk = false;
  if (dernM.end > finOff && (planBase.perDay[dernM.day] || []).every((m) => m.time + (m.duree !== undefined ? m.duree : 28) <= finOff)) finEstOk = false;
}
expect("fin estimée : calculs cohérents", finEstOk, true);
console.log("pause/W.O./fin estimée : contrôles ajoutés OK");
chk.forEach((c) => console.log("  ✗", c));
`;
eval(harness);
