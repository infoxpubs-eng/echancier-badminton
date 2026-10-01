/* Test de reproduction ITB7 — INTO THE BAD 7 (2026), Paris, 13-14 juin,
   8 terrains, créneaux de 34 min. Le tournoi réel (échéancier officiel
   BadNet v5.0) a été reconstitué à partir du PDF : 23 tableaux, 187
   matchs samedi (SH/SD/MX) + 121 matchs dimanche (DH/DD). Ce test
   vérifie que le moteur reproduit la structure à l'identique, que tout
   tient dans la journée, que les invariants tiennent (repos 20 min,
   ordre strict des tours), compare les attentes + fenêtres par tableau
   à la référence BadNet, puis rejoue le tournoi avec l'option « cadence
   par vagues » (0 souple / 0.5 resserrée / 1 vagues strictes) et
   vérifie que les invariants tiennent à chaque réglage. */
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier.md"), "utf8");
const lines = src.split("\n");
const markerIdx = lines.findIndex((l) => l.includes("Composant principal"));
let engine = lines.slice(25, markerIdx - 1).join("\n");
engine = engine.replace(/function AttBadge\(\{ att, phase \}\) \{[\s\S]*?\n\}/, "function AttBadge({ att, type }) { return att === null || att === undefined ? (type !== null && type !== undefined ? type : null) : att; }");

/* ---- configuration ITB7 reconstituée depuis le PDF BadNet ----
   Chaque tableau : effectif réel (nb) + sortants/poule (qualifs).
   Structure BadNet dérivée du PDF (matchs par tableau, poules, tours) :
   samedi  SH P10-NC 23 · D8-D9 23 · N2-N3 14 (2 sortants) · R4-R5 15 ·
   R6-D7 15 · SD P10-NC 15 · D8-D9 9 (2 sortants) · R4-R5 6 (poule
   unique de 4) · R6-D7 6 (poule unique) · MX R6-D7 15 · D8-D9 15 ·
   N2-N3 10 (poule unique de 5) · P10-NC 15 · R4-R5 6 (poule unique)
   = 187 ; dimanche  DH P10-NC 23 · D8-D9 23 · R4-R5 15 (2 poules de 4,
   2 sortants) · R6-D7 15 · N2-N3 6 (poule unique) · DD D8-D9 15 ·
   R6-D7 9 (2 sortants) · P10-NC 9 (2 sortants) · R4-R5 6 = 121. */
const EXPECT = [
  // [disc, classement, nb, qualifs, jour, pools, matchsPoules, finales, total, exempts]
  ["SM", "P10-NC", 18, 1, "samedi", [3, 3, 3, 3, 3, 3], 18, 5, 23, 2],
  ["SM", "D8-D9", 18, 1, "samedi", [3, 3, 3, 3, 3, 3], 18, 5, 23, 2],
  ["SM", "N2-N3", 9, 2, "samedi", [3, 3, 3], 9, 5, 14, 2],
  ["SM", "R4-R5", 12, 1, "samedi", [3, 3, 3, 3], 12, 3, 15, 0],
  ["SM", "R6-D7", 12, 1, "samedi", [3, 3, 3, 3], 12, 3, 15, 0],
  ["SD", "P10-NC", 12, 1, "samedi", [3, 3, 3, 3], 12, 3, 15, 0],
  ["SD", "D8-D9", 6, 2, "samedi", [3, 3], 6, 3, 9, 0],
  ["SD", "R4-R5", 4, 0, "samedi", [4], 6, 0, 6, 0],
  ["SD", "R6-D7", 4, 0, "samedi", [4], 6, 0, 6, 0],
  ["DX", "R6-D7", 12, 1, "samedi", [3, 3, 3, 3], 12, 3, 15, 0],
  ["DX", "D8-D9", 12, 1, "samedi", [3, 3, 3, 3], 12, 3, 15, 0],
  ["DX", "N2-N3", 5, 0, "samedi", [5], 10, 0, 10, 0],
  ["DX", "P10-NC", 12, 1, "samedi", [3, 3, 3, 3], 12, 3, 15, 0],
  ["DX", "R4-R5", 4, 0, "samedi", [4], 6, 0, 6, 0],
  ["DM", "P10-NC", 18, 1, "dimanche", [3, 3, 3, 3, 3, 3], 18, 5, 23, 2],
  ["DM", "D8-D9", 18, 1, "dimanche", [3, 3, 3, 3, 3, 3], 18, 5, 23, 2],
  ["DM", "R4-R5", 8, 2, "dimanche", [4, 4], 12, 3, 15, 0],
  ["DM", "R6-D7", 12, 1, "dimanche", [3, 3, 3, 3], 12, 3, 15, 0],
  ["DM", "N2-N3", 4, 0, "dimanche", [4], 6, 0, 6, 0],
  ["DD", "D8-D9", 12, 1, "dimanche", [3, 3, 3, 3], 12, 3, 15, 0],
  ["DD", "R6-D7", 6, 2, "dimanche", [3, 3], 6, 3, 9, 0],
  ["DD", "P10-NC", 6, 2, "dimanche", [3, 3], 6, 3, 9, 0],
  ["DD", "R4-R5", 4, 0, "dimanche", [4], 6, 0, 6, 0],
];
/* fenêtres BadNet (1er → dernier match, heure de DÉBUT) relevées sur le
   PDF — comparaison informative, l'objectif n'est pas l'égalité */
const BADNET = {
  "SM P10-NC": ["08:45", "16:07"], "SM D8-D9": ["08:45", "16:07"], "SM N2-N3": ["09:19", "16:41"],
  "SM R4-R5": ["09:19", "15:33"], "SM R6-D7": ["17:15", "22:13"], "SD P10-NC": ["17:49", "22:13"],
  "SD D8-D9": ["18:23", "22:13"], "SD R4-R5": ["18:57", "21:13"], "SD R6-D7": ["19:31", "21:13"],
  "DX R6-D7": ["12:43", "18:23"], "DX D8-D9": ["13:17", "18:57"], "DX N2-N3": ["13:17", "18:57"],
  "DX P10-NC": ["13:51", "16:52"], "DX R4-R5": ["16:07", "18:23"],
  "DM P10-NC": ["08:30", "16:52"], "DM D8-D9": ["08:30", "17:52"], "DM R4-R5": ["09:04", "15:52"],
  "DM R6-D7": ["09:38", "16:52"], "DM N2-N3": ["14:10", "16:52"], "DD D8-D9": ["09:38", "16:52"],
  "DD R6-D7": ["10:12", "16:52"], "DD P10-NC": ["10:12", "16:52"], "DD R4-R5": ["14:10", "16:52"],
};

const harness = engine + `

const out = [];
const ok = (name, cond, dbg) => out.push([name, !!cond, dbg]);
const fmt = (t) => String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(Math.round(t % 60)).padStart(2, "0");

const EXPECT = ${JSON.stringify(EXPECT)};
const BADNET = ${JSON.stringify(BADNET)};
const T = (over) => Object.assign({ disc: "SM", classement: "", nb: 16, qualifs: 2, jour: "samedi" }, over);
const tabs = EXPECT.map((e) => ({ disc: e[0], classement: e[1], nb: e[2], qualifs: e[3] || 1, jour: e[4] }));
const jours = {
  samedi:   { actif: true, terrains: 8, debut: "08:45", fin: "23:00" },
  dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "19:30" },
};

/* invariants communs : repos minimum, sources des finales, ordre strict
   des tours, rien de non planifié — utilisés pour la reproduction et
   pour chaque réglage de cadence */
const dureeOf = (m) => (m.duree !== undefined ? m.duree : 34);
const invariants = (p) => {
  let reposKO = 0, srcKO = 0, ordreKO = 0;
  const fb = new Map();
  p.sched.forEach((m) => { if (m.phase !== "poule") fb.set(m.tid + "|" + m.fid, m); });
  for (const day of p.days) {
    const lastEnd = new Map();
    (p.perDay[day] || []).slice().sort((a, b) => a.time - b.time).forEach((m) => {
      if (m.phase === "poule") {
        [m.aK, m.bK].forEach((k) => {
          const le = lastEnd.get(k);
          if (le !== undefined && m.time < le + REPOS) reposKO++;
          lastEnd.set(k, m.time + dureeOf(m));
        });
      } else {
        [m.a, m.b].forEach((fid) => {
          const fm = fb.get(m.tid + "|" + fid);
          if (fm !== undefined && fm.day === m.day && m.time < fm.time + dureeOf(fm) + REPOS) srcKO++;
        });
      }
    });
  }
  p.built.forEach((b) => {
    const rounds = {};
    p.sched.forEach((m) => { if (m.tid === b.tid && m.phase === "finale") (rounds[m.round] = rounds[m.round] || []).push(m); });
    const rs = Object.keys(rounds).map(Number).sort((x, y) => x - y);
    for (let i = 1; i < rs.length; i++) {
      const finPrec = Math.max(...rounds[rs[i - 1]].map((m) => m.time + dureeOf(m)));
      const debSuiv = Math.min(...rounds[rs[i]].map((m) => m.time));
      if (debSuiv < finPrec) ordreKO++;
    }
  });
  return { reposKO, srcKO, ordreKO, unsched: p.unscheduled.length };
};
const metrics = (p) => {
  const ws = p.sched.map((m) => m.att).filter((w) => w !== null);
  const sat = p.perDay.samedi || [], sun = p.perDay.dimanche || [];
  const lastOf = (arr) => Math.max(...arr.map((m) => m.time + dureeOf(m)));
  return {
    finSam: lastOf(sat), finDim: lastOf(sun),
    att60: ws.filter((w) => w >= 60).length,
    attMax: ws.length ? Math.max(...ws) : 0,
    attMoy: ws.length ? Math.round(ws.reduce((a, b) => a + b, 0) / ws.length) : 0,
  };
};

/* ---------- 1. structure : identique à BadNet (cadence souple) ---------- */
const plan = computePlan(tabs, jours, 34, 0, false, false);
let structFail = 0;
plan.built.forEach((b, i) => {
  const e = EXPECT[i];
  const poolsOk = JSON.stringify(b.sizes.slice().sort((x, y) => x - y)) === JSON.stringify(e[5].slice().sort((x, y) => x - y));
  const mp = b.poolMs.length, mf = b.playedFinals.length, tot = mp + mf;
  const byes = b.finals ? b.finals.filter((m) => m.round === 0 && m.bye).length : 0;
  const good = poolsOk && mp === e[6] && mf === e[7] && tot === e[8] && byes === e[9];
  if (!good) structFail++;
  ok("structure " + b.label + " : " + tot + " matchs (" + mp + " poule + " + mf + " finale)", good,
     JSON.stringify(b.sizes) + " mp=" + mp + "/" + e[6] + " mf=" + mf + "/" + e[7] + " exempts=" + byes + "/" + e[9]);
});
const sat = plan.perDay.samedi || [], sun = plan.perDay.dimanche || [];
ok("total samedi = 187 matchs", sat.length === 187, sat.length);
ok("total dimanche = 121 matchs", sun.length === 121, sun.length);
ok("tout tient : aucun match non planifié", plan.unscheduled.length === 0, plan.unscheduled.length);
ok("23 tableaux", plan.built.length === 23, plan.built.length);

/* ---------- 2. invariants (cadence souple) ---------- */
const inv0 = invariants(plan);
ok("repos minimum " + REPOS + " min (poules, partout)", inv0.reposKO === 0, inv0.reposKO + " violations");
ok("sources-fid : fin + repos " + REPOS + " min (tableaux finaux)", inv0.srcKO === 0, inv0.srcKO + " violations");
ok("ordre strict des tours (tous tableaux)", inv0.ordreKO === 0, inv0.ordreKO + " violations");

/* ---------- 3. fins de journée (gardes-fous de régression) ---------- */
const m0 = metrics(plan);
ok("samedi fini à " + fmt(m0.finSam) + " (BadNet ~22:47)", m0.finSam <= toMin("22:50"), fmt(m0.finSam));
ok("dimanche fini à " + fmt(m0.finDim) + " (BadNet ~18:26)", m0.finDim <= toMin("18:55"), fmt(m0.finDim));
ok("attente max = 136 min (exempts de bracket)", m0.attMax === 136, m0.attMax);
ok("attentes ≥ 1 h : " + m0.att60 + " (réf. BadNet estimée ~65)", m0.att60 === 89, m0.att60);

/* ---------- 4. fenêtres par tableau vs BadNet (informatif) ---------- */
let tinfo = [];
plan.built.forEach((b) => {
  const ms = plan.sched.filter((m) => m.tid === b.tid);
  const d = Math.min(...ms.map((m) => m.time)), f = Math.max(...ms.map((m) => m.time));
  const bn = BADNET[b.label] || ["?", "?"];
  tinfo.push("  " + b.label.padEnd(10) + " | " + fmt(d) + " → " + fmt(f) + " | " + bn[0] + " → " + bn[1]);
});
out.push(["INFO", true, "\\n" + tinfo.join("\\n")]);

/* ---------- 5. étude « cadence par vagues » (option B) ----------
   Rejoue ITB7 à chaque réglage : 0 (souple, défaut), 0.5 (resserrée :
   battement régulier 27 min entre les tours d'une même poule), 1
   (vagues strictes : le tour r d'un tableau démarre après la fin du
   tour r-1 du tableau entier). Les invariants doivent tenir partout. */
const LBL = { 0: "souple (défaut)", 0.5: "resserrée (battement 27 min)", 1: "vagues strictes" };
let study = ["  réglage                    | fin sam | fin dim | att≥1h | attMax | attMoy"];
[0, 0.5, 1].forEach((c) => {
  const p = computePlan(tabs, jours, 34, 0, false, false, undefined, c);
  const inv = invariants(p);
  const mm = metrics(p);
  ok("cadence " + LBL[c] + " : tout tient", inv.unsched === 0, inv.unsched + " non planifiés");
  ok("cadence " + LBL[c] + " : repos " + REPOS + " min garanti", inv.reposKO === 0 && inv.srcKO === 0, inv.reposKO + "/" + inv.srcKO);
  ok("cadence " + LBL[c] + " : ordre strict des tours", inv.ordreKO === 0, inv.ordreKO + " violations");
  study.push("  " + String(LBL[c]).padEnd(26) + " | " + fmt(mm.finSam) + "   | " + fmt(mm.finDim) + "   | " +
    String(mm.att60).padStart(6) + " | " + String(mm.attMax).padStart(6) + " | " + String(mm.attMoy).padStart(6));
  if (c === 0) {
    ok("cadence 0 = comportement inchangé (22:41 / 18:34 / att60 89)", fmt(mm.finSam) === "22:41" && fmt(mm.finDim) === "18:34" && mm.att60 === 89,
       fmt(mm.finSam) + " " + fmt(mm.finDim) + " " + mm.att60);
  }
  if (c === 1) {
    // vagues strictes : le tour r de poule d'un tableau démarre bien
    // après la fin du tour r-1 du même tableau (toutes poules)
    let waveKO = 0;
    p.built.forEach((b) => {
      if (!b.poolMs.length) return;
      const rounds = {};
      (p.perDay[b.tab.jour] || []).forEach((m) => {
        if (m.tid === b.tid && m.phase === "poule") (rounds[m.round] = rounds[m.round] || []).push(m);
      });
      const rs = Object.keys(rounds).map(Number).sort((x, y) => x - y);
      for (let i = 1; i < rs.length; i++) {
        const finPrec = Math.max(...rounds[rs[i - 1]].map((m) => m.time + dureeOf(m)));
        const debSuiv = Math.min(...rounds[rs[i]].map((m) => m.time));
        if (debSuiv < finPrec) waveKO++;
      }
    });
    ok("cadence 1 : vagues strictes par tableau (poules)", waveKO === 0, waveKO + " violations");
    // gardes-fous de l'étude (valeurs constatées ITB7) : les vagues
    // strictes cadencent les tours mais, sur ce scénario, dégradent les
    // attentes (rapport d'étude) — le souple reste le meilleur compromis
    ok("cadence 1 : fin samedi ≤ 23:20 (constatée 23:15)", mm.finSam <= toMin("23:20"), fmt(mm.finSam));
    ok("cadence 1 : attentes ≥ 1 h attendues ~132 (étude)", mm.att60 >= 120 && mm.att60 <= 145, mm.att60);
    ok("étude : le souple domine les vagues sur les attentes (ITB7)", m0.att60 < mm.att60 && m0.attMoy < mm.attMoy,
       "souple att60=" + m0.att60 + " moy=" + m0.attMoy + " vs vagues att60=" + mm.att60 + " moy=" + mm.attMoy);
  }
});
out.push(["INFO", true, "\\n" + study.join("\\n")]);

let fails = out.filter((o) => !o[1]);
out.forEach((o) => { if (o[0] === "INFO") console.log(o[2]); else console.log((o[1] ? "OK   " : "FAIL ") + o[0] + (o[1] && o[2] === undefined ? "" : "  [" + o[2] + "]")); });
if (fails.length) { console.log("ÉCHECS : " + fails.length); process.exit(1); }
console.log("TOUS LES TESTS ITB7 (REPRODUCTION + ÉTUDE CADENCE) SONT OK");
`;

eval(harness);
