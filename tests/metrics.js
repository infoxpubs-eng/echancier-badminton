const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier.md"), "utf8");
const lines = src.split("\n");
const markerIdx = lines.findIndex((l) => l.includes("Composant principal"));
let engine = lines.slice(25, markerIdx - 1).join("\n");
engine = engine.replace(/function AttBadge\(\{ att \}\) \{[\s\S]*?\n\}/, "function AttBadge({ att }) { return att; }");
const D = { samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50", dureeMatch: "", marge: "", finalesFin: false }, dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00", dureeMatch: "", marge: "", finalesFin: false } };
eval(engine + `
const sum = (p) => {
  const ws = p.sched.map((m) => m.att).filter((w) => w !== null);
  return "att60=" + ws.filter((w) => w >= 60).length + " attMax=" + (ws.length ? Math.max(...ws) : 0) + " attMoy=" + (ws.length ? Math.round(ws.reduce((a, b) => a + b, 0) / ws.length) : 0);
};
const p0 = computePlan(baseTabs(), ${JSON.stringify(D)}, 28, 0, false, false);
console.log("défaut        : " + p0.sched.length + " matchs, " + sum(p0));
const Dff = JSON.parse(JSON.stringify(${JSON.stringify(D)}));
Dff.samedi.finalesFin = true; Dff.dimanche.finalesFin = true;
const p1 = computePlan(baseTabs(), Dff, 28, 0, false, false);
console.log("finalesFin/jour : " + p1.sched.length + " matchs, " + sum(p1));
// attente max poules->demis avec finalesFin (règle 2h30)
let wmax = 0;
for (const day of p1.days) {
  const pe = {};
  (p1.perDay[day] || []).forEach((m) => { if (m.phase === "poule") pe[m.tid] = Math.max(pe[m.tid] || -1e9, m.time + m.duree); });
  (p1.perDay[day] || []).forEach((m) => {
    if (m.phase === "poule") return;
    const R = Object.keys(p1.built[m.tid].roundsCount).length;
    if (m.round === R - 2 && pe[m.tid] !== undefined) wmax = Math.max(wmax, m.time - pe[m.tid]);
  });
}
console.log("attente max poules->demis (finalesFin) : " + wmax + " min (cible ≤ 150)");
`);
