/* Reproduit fidèlement la logique de rendu de l'écran CONFIG du canvas,
   avec fuzzing des états, pour localiser le crash filter@native. */
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier.md"), "utf8");
const lines = src.split("\n");
// moteur : lignes 26 jusqu'au composant principal (auto-détecté)
const markerIdx = lines.findIndex((l) => l.includes("Composant principal"));
let engine = lines.slice(25, markerIdx - 1).join("\n");
// AttBadge contient du JSX : remplacée par une version JS pure
engine = engine.replace(/function AttBadge\(\{ att \}\) \{[\s\S]*?\n\}/, "function AttBadge({ att }) { return att === null || att === undefined ? '1er tour' : attFmt(att); }");
engine = engine.replace(/export default function App/, "function App_UNUSED");

const harness = engine + `

/* ===== rendu écran config (expressions recopiées à l'identique) ===== */
function renderConfig(tabs, jours, dureeMatch) {
  const joursActifs = JOURS.filter((j) => jours[j].actif);
  // carte estimation
  const out = (() => {
    const dureeEff = Math.max(28, Math.floor(+dureeMatch) || 28);
    const capJour = (j) => {
      const J = jours[j];
      const terr = Math.max(1, Math.floor(+J.terrains) || 1);
      const minutes = toMin(J.fin, 18 * 60) - toMin(J.debut, 9 * 60);
      return Math.max(0, minutes) * terr / dureeEff;
    };
    const matchsTab = (t) => {
      const b = buildTab(t, 0);
      return b.poolMs.length + b.playedFinals.length;
    };
    const besoinFixe = {};
    let besoinDeux = 0, besoinTotal = 0;
    tabs.forEach((t) => {
      const n = matchsTab(t);
      besoinTotal += n;
      if (t.jour === "samedi" || t.jour === "dimanche") besoinFixe[t.jour] = (besoinFixe[t.jour] || 0) + n;
      else besoinDeux += n;
    });
    const capTotal = JOURS.reduce((s, j) => s + (jours[j].actif ? capJour(j) : 0), 0);
    const rows = JOURS.map((j) => {
      const cap = Math.floor(capJour(j));
      const besoin = besoinFixe[j] || 0;
      const marge = jours[j].actif ? cap - besoin : 0;
      return { j, cap: jours[j].actif ? cap : "—", besoin: besoin || "—",
        marge: jours[j].actif ? (marge >= 0 ? "✓ +" + marge : "⚠ " + marge) : "—" };
    });
    const txt = "Besoin total : " + besoinTotal + " dont " + besoinDeux + " / " + Math.floor(capTotal);
    const deux = (() => {
      const builtAll = tabs.map((t, k) => buildTab(t, k));
      const cuts = cutsDeuxJours(builtAll, jours, dureeEff);
      const lignes = builtAll.filter((b) => cuts[b.tid])
        .map((b) => b.label + " : jour 2 à partir des " + cuts[b.tid].label.toLowerCase());
      if (!lignes.length) return null;
      return "🔀 " + lignes.join(" · ");
    })();
    return { rows, txt, deux };
  })();

  // aperçu par tableau
  const previews = tabs.map((t, i) => {
    const b = buildTab(t, i);
    const p1 = b.P === 0 ? "élimination directe : " + b.n + " " + b.unit + " (" + b.playedFinals.length + " matchs)" : null;
    const p2 = b.P > 0 ? b.P + " poule(s) : " + b.sizes.join(" + ") + " " + b.unit + " (" + b.poolMs.length +
      " matchs de poule), " + b.Q + " sortant(s)/poule → " + b.P * b.Q + " qualifiés, " + b.playedFinals.length +
      " matchs de tableau final (dont finale : " + roundName(1).toLowerCase() + " à " + roundName(b.roundsCount[0] || 1).toLowerCase() + ")." : null;
    const p3 = t.jour === "samedi" && !jours.samedi.actif && " ⚠️ samedi inactif";
    const p4 = t.jour === "dimanche" && !jours.dimanche.actif && " ⚠️ dimanche inactif";
    const p5 = t.jour === "les-deux" && (() => {
      const builtAll = tabs.map((t2, k) => buildTab(t2, k));
      const cuts = cutsDeuxJours(builtAll, jours, Math.max(28, Math.floor(+dureeMatch) || 28));
      return cuts[i] ? " · jour 2 : à partir des " + cuts[i].label.toLowerCase() : "";
    })();
    return { label: b.label, p1, p2, p3, p4, p5 };
  });
  return { out, previews };
}

/* ===== écran tournoi : statsJour + expressions des vues ===== */
function renderTournoi(tabs, jours, dureeMatch) {
  const plan = computePlan(tabs, jours, dureeMatch);
  const jourKeys = ["planning", "terrain"].concat(plan.built.map((b) => "t" + b.tid));
  const jourLabels = { planning: "📅 Planning", terrain: "🎾 Par terrain" };
  const boutons = jourKeys.map((k) => jourLabels[k] || plan.built[+k.slice(1)].label);
  const statsJour = plan.days.map((day) => {
    const ms = plan.perDay[day] || [];
    const dureeEff = Math.max(28, Math.floor(+dureeMatch) || 28);
    const derniereFin = ms.length ? Math.max(...ms.map((m) => m.time + dureeEff)) : 0;
    const fin = toMin(jours[day].fin, 18 * 60);
    const debut = toMin(jours[day].debut, 9 * 60);
    const at = plan.attentes.filter((a) => a.day === day);
    return {
      day, nb: ms.length, derniereFin, fin, debut,
      depasse: ms.length > 0 && derniereFin > fin,
      marge: fin - derniereFin,
      attMax: at.length ? Math.max(...at.map((a) => a.w)) : 0,
      attMoy: at.length ? Math.round(at.reduce((s, a) => s + a.w, 0) / at.length) : 0,
    };
  });
  const total = plan.sched.length;
  const depasse = statsJour.filter((s) => s.depasse).map((s) => "⚠️ " + s.day + " : " + (-s.marge));
  const nonPlan = plan.unscheduled.length > 0
    ? [...new Set(plan.unscheduled.map((m) => plan.built[m.tid].label))].join(", ") : null;
  const ok = statsJour.every((s) => !s.depasse) && plan.unscheduled.length === 0;
  // vue planning
  const vuePlanning = plan.days.map((day) => {
    const ms = (plan.perDay[day] || []).slice().sort((a, b) => a.time - b.time || a.court - b.court);
    return ms.map((m) => ({
      appel: fmtTime(m.appel), debut: fmtTime(m.time), terrain: "T" + (m.court + 1),
      label: plan.built[m.tid].label,
      phase: m.phase === "poule" ? "Poule " + (m.pool + 1) : roundName(plan.built[m.tid].roundsCount[m.round] || 1),
      rencontre: m.phase === "poule" ? m.a + " vs " + m.b : qualLabel(m.a) + " / " + qualLabel(m.b),
    }));
  });
  // vue terrain
  const vueTerrain = plan.days.map((day) => ({
    day,
    courts: Array.from({ length: Math.max(1, Math.floor(+jours[day].terrains) || 1) }, (_, c) => {
      const ms = (plan.perDay[day] || []).filter((m) => m.court === c).sort((a, b) => a.time - b.time);
      return ms.map((m) => ({
        appel: fmtTime(m.appel), debut: fmtTime(m.time), label: plan.built[m.tid].label,
        phase: m.phase === "poule" ? "Poule " + (m.pool + 1) : "Finale",
      }));
    }),
  }));
  // vues par tableau
  const vueTab = plan.built.map((b) => {
    const ms = plan.sched.filter((m) => m.tid === b.tid).sort((a, b2) => a.time - b2.time);
    const poules = b.pools.map((ids, pi) => ids.map((i) => b.nom(i)).join(", "));
    const rows = ms.map((m) => ({
      day: m.day, appel: fmtTime(m.appel), debut: fmtTime(m.time), terrain: "T" + (m.court + 1),
      phase: m.phase === "poule" ? "Poule " + (m.pool + 1) : roundName(b.roundsCount[m.round] || 1),
      cut: plan.cuts[b.tid] ? plan.cuts[b.tid].label.toLowerCase() : null,
    }));
    return { label: b.label, P: b.P, n: b.n, unit: b.unit, Q: b.Q, poules, rows };
  });
  return { statsJour, total, depasse, nonPlan, ok, boutons, vuePlanning, vueTerrain, vueTab };
}

/* ================== TESTS ================== */
const failures = [];
function tryCase(name, fn) {
  try { fn(); } catch (e) { failures.push({ name, msg: e.message, stack: String(e.stack).split("\\n").slice(0, 4).join(" | ") }); }
}
const D = (over) => Object.assign({ samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50" }, dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00" } }, over);
const T = (over) => Object.assign({ disc: "SM", classement: "", nb: 16, qualifs: 2, jour: "samedi" }, over);
const defTabs = () => [T({ nb: 16, jour: "samedi" }), T({ disc: "DX", nb: 8, jour: "les-deux" })];

const nbs = [3, 4, 5, 6, 9, 10, 13, 16, 20, 24, 25, 26, 33, 40, 64, 100, "", "0", "abc", 0, -5, 3.7];
const joursSet = [D(), D({ samedi: { actif: false, terrains: 8, debut: "08:30", fin: "21:50" } }), D({ dimanche: { actif: false, terrains: 8, debut: "08:30", fin: "17:00" } }), D({ samedi: { actif: true, terrains: "", debut: "", fin: "" } }), D({ samedi: { actif: false, terrains: 8, debut: "08:30", fin: "21:50" }, dimanche: { actif: false, terrains: 8, debut: "08:30", fin: "17:00" } })];
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
          tryCase("config nb=" + JSON.stringify(nb) + " q=" + JSON.stringify(q) + " jt=" + jt + " dm=" + JSON.stringify(dm) + " jours=" + JSON.stringify(jours.samedi.actif) + jours.dimanche.actif, () => renderConfig(tabs, jours, dm));
          tryCase("tournoi idem", () => renderTournoi(tabs, jours, dm));
        }
      }
    }
  }
}
// cas : aucun tableau, tableau unique les-deux, tableaux multiples
tryCase("aucun tableau", () => { renderConfig([], D(), 28); renderTournoi([], D(), 28); });
tryCase("multi tabs", () => {
  const tabs = [T({ nb: 24, jour: "samedi" }), T({ disc: "DM", nb: 30, jour: "les-deux" }), T({ disc: "SD", classement: "D9-P12", nb: 10, qualifs: 1, jour: "dimanche" }), T({ disc: "DX", nb: 5, jour: "les-deux" })];
  renderConfig(tabs, D(), 28);
  renderTournoi(tabs, D(), 28);
});

console.log("cas testés:", count * 2, "| échecs:", failures.length);
failures.slice(0, 12).forEach((f) => console.log("ÉCHEC:", f.name, "\\n   ", f.msg, "\\n   ", f.stack));
`;
eval(harness);
