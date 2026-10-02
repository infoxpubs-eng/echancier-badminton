---
name: "badminton-echancier-web"
title: "Échéancier Badminton — version web autonome"
type: "text/html"
---

<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Échéancier Tournoi de Badminton</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
</style>
</head>
<body>
<div id="root"></div>
<script>
// message de repli : si React/Babel (CDN) n'ont pas pu être chargés —
// aperçu du canvas (scripts externes bloqués) ou navigateur hors ligne.
window.addEventListener("load", function () {
  if (typeof React !== "undefined" && typeof ReactDOM !== "undefined" && typeof Babel !== "undefined") return;
  document.getElementById("root").innerHTML =
    '<div style="max-width:34rem;margin:3rem auto;padding:1.5rem;border:1px solid #a7f3d0;border-radius:0.75rem;background:#f0fdf4;font-family:system-ui,sans-serif;color:#065f46">' +
    '<h2 style="margin:0 0 0.5rem;font-size:1.15rem;color:#065f46">⚠️ Cette version web ne démarre pas ici</h2>' +
    '<p style="margin:0.25rem 0">Elle charge React et Tailwind depuis internet (unpkg.com, cdn.tailwindcss.com). Ces scripts externes sont bloqués dans cet aperçu — et hors connexion.</p>' +
    '<p style="margin:0.75rem 0 0.25rem"><strong>Téléchargez le fichier</strong> puis ouvrez-le dans un navigateur connecté.</p>' +
    '<p style="margin:0.25rem 0">Sans internet, utilisez la <strong>version hors-ligne</strong> (badminton-echancier-offline), qui ne dépend d\u2019aucune connexion.</p>' +
    '</div>';
});
</script>
<script type="text/babel" data-presets="react">
const { useMemo, useState } = React;

/* ============================================================
   Échéancier prédictif de tournoi de badminton (week-end)
   - Paramétrage par tableau : discipline, classement, nombre de
     joueurs/paires, sortants par poule,
     jour(s) de jeu (samedi / dimanche / les deux).
   - Poules 3-5 automatiques : la combinaison minimisant le nombre
     total de matchs est choisie ; au-delà de 24 inscrits, élimination
     directe sans poules.
   - Aucun nom à saisir : joueurs/paires anonymes.
   - Chaque jour a ses terrains et horaires.
   - Ordonnancement glouton "événementiel" : à chaque libération de
     terrain, on joue le match dont le participant attend depuis le
     plus longtemps, tout en respectant le repos minimum.
   - Appel 5 min avant chaque match, échange de côté à 8,
     2 sets gagnants de 15 (écart 2, plafond 21).
   ============================================================ */

const DISCIPLINES = [
  { key: "SM", label: "Simple messieurs", unit: "joueurs" },
  { key: "SD", label: "Simple dames", unit: "joueuses" },
  { key: "SI", label: "Simple intergenre", unit: "joueurs" },
  { key: "DM", label: "Double messieurs", unit: "paires" },
  { key: "DD", label: "Double dames", unit: "paires" },
  { key: "DX", label: "Double mixte", unit: "paires" },
  { key: "DI", label: "Double intergenre", unit: "paires" },
];

const DISC_COLORS = {
  SM: "bg-sky-100 text-sky-800", SD: "bg-rose-100 text-rose-800",
  SI: "bg-orange-100 text-orange-800",
  DM: "bg-amber-100 text-amber-800", DD: "bg-violet-100 text-violet-800",
  DX: "bg-teal-100 text-teal-800", DI: "bg-lime-100 text-lime-800",
};

const JOURS = ["samedi", "dimanche"]; // jours par défaut (d'autres peuvent être ajoutés)
/* ordre canonique des jours : samedi, puis dimanche, puis les jours
   supplémentaires (« jour 3 », « jour 4 »…) dans l'ordre. Une
   configuration enregistrée (ou une saisie dans un autre ordre) ne doit
   jamais afficher ni numéroter les matchs du dimanche avant ceux du
   samedi */
const dayRank = (j) => {
  const i = JOURS.indexOf(j);
  if (i !== -1) return i;
  const m = /^jour (\d+)$/.exec(j);
  return 900 + (m ? parseInt(m[1], 10) : 800);
};
const daySort = (arr) => arr.slice().sort((a, b) => dayRank(a) - dayRank(b) || (a < b ? -1 : a > b ? 1 : 0));

const REPOS = 20;    // minutes de repos minimum après la fin d'un match
const APPEL = 5;     // minutes d'appel avant le match
const FIN_HOLD = 150; // option « demis et finales en fin de journée » : attente
                      // maximale tolérée après la fin des poules d'un tableau
                      // (2h30) — au-delà, ses demis/finales avancent dès que
                      // possible au lieu d'être tenues en fin de journée

/* ---------- paramétrage de base ----------
   5 tableaux par catégorie (« Série 1 » à « Série 5 »), 9 joueurs ou
   paires par défaut, sans tableaux intergenre (ajoutables manuellement).
   Convention : simples et mixte le samedi, doubles le dimanche. */
const BASE_CATS = [["SM", "samedi"], ["SD", "samedi"], ["DX", "samedi"], ["DM", "dimanche"], ["DD", "dimanche"]];
const baseTabs = () => {
  const tabs = [];
  for (const [disc, jour] of BASE_CATS)
    for (let s = 1; s <= 5; s++)
      tabs.push({ disc, classement: "Série " + s, nb: 9, qualifs: 2, jour });
  return tabs;
};

/* famille d'une discipline pour les combinaisons toxiques :
   0 = simples, 1 = mixte, 2 = doubles. Par défaut, les inscriptions
   n'autorisent pas un joueur/paire sur deux familles le même jour.
   Si l'option « combinaisons toxiques » est cochée (autorisées si le
   dimensionnement le permet), l'ordonnancement sérialise les familles
   dans chaque journée : tous les matchs d'une famille sont terminés
   avant de démarrer la suivante, pour qu'un joueur/paire inscrit sur
   deux familles ne soit jamais attendu au même moment sur les deux. */
const DISC_PHASE = { SM: 0, SD: 0, SI: 0, DX: 1, DM: 2, DD: 2, DI: 2 };

/* ---------- helpers ---------- */
function bergerRounds(ids) {
  const arr = [...ids];
  if (arr.length % 2 === 1) arr.push(-1);
  const m = arr.length;
  const rounds = [];
  for (let r = 0; r < m - 1; r++) {
    const round = [];
    for (let i = 0; i < m / 2; i++) {
      const a = arr[i], b = arr[m - 1 - i];
      if (a !== -1 && b !== -1) round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    arr.splice(1, 0, arr.pop());
  }
  return rounds;
}

function bracketOrder(size) {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2 + 1;
    const next = [];
    for (const s of order) next.push(s, n - s);
    order = next;
  }
  return order;
}

const nextPow2 = (n) => Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));

const fmtTime = (t) =>
  String(Math.floor(t / 60) % 24).padStart(2, "0") + ":" + String(Math.abs(Math.round(t % 60))).padStart(2, "0");

const toMin = (hhmm, dflt) => {
  const p = (hhmm || "").split(":").map(Number);
  if (p.length !== 2 || isNaN(p[0])) return dflt;
  return (p[0] || 0) * 60 + (p[1] || 0);
};
/* durée planifiée d'un match = durée moyenne + marge de sécurité
   (la marge absorbe les dépassements réels pour garantir le repos) */
const dureeCalc = (dureeBrut, margeBrut) =>
  Math.max(28, Math.floor(+dureeBrut) || 28) + Math.max(0, Math.floor(+margeBrut) || 0);

function roundName(nb) {
  const names = { 1: "Finale", 2: "Demi-finales", 4: "Quarts de finale", 8: "8es de finale", 16: "16es de finale", 32: "32es de finale", 64: "64es de finale" };
  return names[nb] || "Tour de " + nb + " matchs";
}

const ORDINALS = ["1er", "2e", "3e", "4e"];
const NIVEAUX = { 1: "Finale", 2: "1/2 Finale", 4: "1/4 Finale", 8: "1/8 Finale", 16: "1/16 Finale", 32: "1/32 Finale", 64: "1/64 Finale" };
const niveauLabel = (nb) => NIVEAUX[nb] || roundName(nb);
/* étiquette de tour d'un match : « Tour 2 · Poule 3 » en poules,
   « Ronde 3 » en ronde suisse, « 1/4 Finale » en élimination directe */
function tourLabel(m, b) {
  if (m.phase === "poule")
    return b.suisse ? "Ronde " + (m.round + 1)
      : "Tour " + (m.round + 1) + " · Poule " + (m.pool + 1);
  return niveauLabel((b.paperRounds || b.roundsCount)[m.round] || 1);
}
const qualLabel = (q) => {
  if (q === null || q === undefined) return "—";
  if (typeof q === "string") return "Vainqueur " + q;
  if (q.nom !== undefined) return q.nom;
  if (q.suisse) return (q.r === 0 ? "1er" : (q.r + 1) + "e") + " ronde suisse";
  return ORDINALS[q.r] + " poule " + (q.pi + 1);
};
/* exempts du 1er tour d'un tableau final (bracket incomplet) : les
   qualifiés semés qui avancent sans jouer, comptés dans paperRounds */
const exemptsTxt = (b) => (b.paperRounds && (b.paperRounds[0] || 0) > (b.roundsCount[0] || 0)
  ? " · " + ((b.paperRounds[0] || 0) - (b.roundsCount[0] || 0)) + " exempt(s) au 1er tour"
  : "");
/* « Vainqueur 169 » : libellé d'une source du tableau final par le
   NUMÉRO du match gagné (numérotation 1 → fin du tournoi, identique
   dans toutes les vues et l'export) au lieu du code interne « T1-1 » :
   le juge-arbitre retrouve la source directement dans l'échéancier
   (repli sur le code si le match n'est pas planifié, ex. forfait) */
const _srcNumCache = new WeakMap();
const srcNumMap = (plan) => {
  let M = _srcNumCache.get(plan);
  if (M === undefined) {
    M = new Map();
    plan.sched.forEach((m) => { if (m.fid !== undefined) M.set(m.tid + "|" + m.fid, m.num); });
    _srcNumCache.set(plan, M);
  }
  return M;
};
const vlbl = (plan, m, s) => {
  if (typeof s !== "string") return qualLabel(s);
  const n = srcNumMap(plan).get(m.tid + "|" + s);
  return "Vainqueur " + (n !== undefined ? n : s);
};
/* tri des listes multi-jours d'un même tableau : TOUS les matchs du
   samedi dans l'ordre chronologique, puis ceux du dimanche, puis des
   jours suivants — jamais de dimanche avant un samedi (vues « par
   classement » et « par tableau », où les journées se côtoient) */
const ordMatches = (plan) => (x, y) =>
  plan.days.indexOf(x.day) - plan.days.indexOf(y.day) ||
  x.time - y.time || x.court - y.court;


/* ---------- code couleur des attentes ----------
   Attente d'un match = temps TOTAL depuis la fin du match précédent
   du même joueur/paire (poules) — repos minimum inclus — ; pour les
   finales, celle du qualifié issu de la source finie le plus tôt.
   Tranches de 30 min à partir de 1h. */
const ATT_STEPS = [
  { max: 30, cls: "attb-1", lbl: "< 30 min" },
  { max: 60, cls: "attb-2", lbl: "30 min – 1h" },
  { max: 90, cls: "attb-3", lbl: "1h – 1h30" },
  { max: 120, cls: "attb-4", lbl: "1h30 – 2h" },
  { max: Infinity, cls: "attb-5", lbl: "≥ 2h" },
];
const attStep = (w) => ATT_STEPS.find((s) => w < s.max) || ATT_STEPS[ATT_STEPS.length - 1];
const attFmt = (w) => w >= 60 ? Math.floor(w / 60) + "h" + (w % 60 ? String(w % 60).padStart(2, "0") : "") : w + " min";
const attStats = (ms) => {
  const ws = ms.map((m) => m.att).filter((w) => w !== null && w !== undefined);
  return {
    max: ws.length ? Math.max(...ws) : 0,
    moy: ws.length ? Math.round(ws.reduce((a, b) => a + b, 0) / ws.length) : 0,
  };
};
/* attentes « combinées » d'un tableau : attentes individuelles ET délais
   de transition de phase (≈, premier tour d'élimination directe) — sert au
   fond de couleur de l'en-tête des vues par tableau/classement */
const attStatsAll = (ms) => {
  const ws = ms.map((m) => (m.att !== null && m.att !== undefined ? m.att : ((m.attPhase !== null && m.attPhase !== undefined) ? m.attPhase : null))).filter((w) => w !== null);
  return {
    n: ws.length,
    max: ws.length ? Math.max(...ws) : 0,
    moy: ws.length ? Math.round(ws.reduce((a, b) => a + b, 0) / ws.length) : 0,
  };
};
function AttBadge({ att, phase }) {
  if (att === null || att === undefined) {
    if (phase !== null && phase !== undefined)
      return <span title="délai entre la fin estimée du dernier match de la phase précédente du tableau (poules ou rondes suisses) et le début de ce match d'élimination directe — attente individuelle non applicable : qualifiés issus des poules" className={"rounded px-1.5 py-0.5 text-[10px] font-semibold italic " + attStep(phase).cls}>≈ {attFmt(phase)}</span>;
    return <span title="premier tour du joueur ou de la paire : attente non applicable" className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">—</span>;
  }
  return <span title={"attente totale depuis la fin du match précédent, repos de " + REPOS + " min inclus, pour le joueur ou la paire la plus attendu(e) du match"} className={"rounded px-1.5 py-0.5 text-[10px] font-semibold " + attStep(att).cls}>{attFmt(att)}</span>;
}
/* parcours d'un tableau sous forme "Poules → Quarts → Demis → Finale",
   avec le tour de démarrage du jour 2 marqué si coupure */
function parcoursStr(b, cut) {
  const parts = [];
  if (b.suisse) parts.push(b.rondes + " ronde" + (b.rondes > 1 ? "s" : "") + " suisse" + (b.rondes > 1 ? "s" : ""));
  else if (b.P > 0) parts.push("Poules");
  Object.keys(b.roundsCount).map(Number).sort((x, y) => x - y).forEach((r) => {
    const lbl = niveauLabel((b.paperRounds || b.roundsCount)[r] || 1);
    parts.push(cut && cut.cut === r ? "(J2) " + lbl : lbl);
  });
  return parts.join(" → ");
}

/* ---------- tailles de poules ----------
   Règle systématique : on retient la combinaison qui minimise le nombre
   total de matchs de poule (priorité 3 > 4 > 5 ; une poule de 5 uniquement
   pour 5 inscrits, une seule poule de 3 à 5 inscrits).
   Au-delà de 24 inscrits : pas de poules, élimination directe. */
function poolSizes(n) {
  if (n > 24) return []; // élimination directe
  if (n <= 5) return [Math.max(3, n)]; // une seule poule de 3, 4 ou 5
  let P = Math.max(1, Math.ceil(n / 3)); // un maximum de poules de 3…
  while (P > 1 && Math.floor(n / P) < 3) P--; // …jamais moins de 3 par poule
  const base = Math.floor(n / P), extra = n % P;
  return Array.from({ length: P }, (_, i) => base + (i < extra ? 1 : 0));
}

/* ---------- construction d'un tableau ---------- */
/* tableau final (élimination directe) depuis une liste de qualifiés :
   semés dans un bracket de taille puissance de 2 (exempts si nécessaire) */
function bracketFromQuals(tid, quals) {
  const size = nextPow2(Math.max(2, quals.length));
  const order = bracketOrder(size);
  const slots = Array(size).fill(null);
  quals.forEach((q, i) => { slots[order[i] - 1] = q; });
  const finals = [];
  let prev = [];
  if (quals.length > 0) {
    for (let i = 0; i < size / 2; i++) {
      const m = { tid, phase: "finale", round: 0, a: slots[2 * i], b: slots[2 * i + 1], bye: !slots[2 * i] || !slots[2 * i + 1], fid: "T1-" + (i + 1) };
      prev.push(m); finals.push(m);
    }
    let r = 1;
    // exempt du 1er tour : ce match n'est pas joué — l'inscrit présent dans
    // le créneau avance sans jouer. Le tour suivant référence donc le
    // qualifié LUI-MÊME (sorti des poules ou des rondes suisses), jamais un
    // « Vainqueur Tx-y » fantôme : ce label faisait croire que les demis
    // dépendaient de quarts absents de l'échéancier (ex. « Vainqueur T1-2 »
    // alors que T1-2 est un exempt du 1er tour)
    const adv = (mm) => (mm.round === 0 && mm.bye
      ? (mm.a !== null && mm.a !== undefined ? mm.a : (mm.b !== null && mm.b !== undefined ? mm.b : mm.fid))
      : mm.fid);
    while (prev.length > 1) {
      const nxt = [];
      for (let i = 0; i < prev.length / 2; i++)
        nxt.push({ tid, phase: "finale", round: r, a: adv(prev[2 * i]), b: adv(prev[2 * i + 1]), fid: "T" + (r + 1) + "-" + (i + 1) });
      finals.push(...nxt); prev = nxt; r++;
    }
  }
  const playedFinals = finals.filter((m) => !(m.round === 0 && m.bye));
  const roundsCount = {};
  playedFinals.forEach((m) => { roundsCount[m.round] = (roundsCount[m.round] || 0) + 1; });
  // nombre de matchs « papier » par tour (exempts compris) : c'est LUI qui
  // donne le nom du tour (un 1er tour de bracket 64 = « 1/32 finale », même
  // si 30 exempts réduisent les matchs réellement joués à 2)
  const paperRounds = {};
  finals.forEach((m) => { paperRounds[m.round] = (paperRounds[m.round] || 0) + 1; });
  return { finals, playedFinals, roundsCount, paperRounds };
}

function buildTab(t, tid) {
  const n = Math.max(3, Math.floor(t.nb) || 3);
  const unit = (DISCIPLINES.find((d) => d.key === t.disc) || {}).unit || "joueurs";
  const nom = (i) => (unit === "paires" ? "Paire " : "Joueur ") + (i + 1);
  const label = t.disc + (t.classement ? " " + t.classement : "");
  /* ---------- format « ronde suisse » (avec ou sans élimination directe) :
     pas de poules, personne n'est éliminé — chaque inscrit joue une fois
     par ronde contre un adversaire proche (appariement simulé par
     rotation : l'échéancier est prédictif, sans résultats). Nombre de
     rondes réglable (« Rondes », vide = auto ⌈log₂(n)⌉ min 3, plafonné
     au maximum sans rejouer le même adversaire) ; 1 exempt par ronde si
     le nombre d'inscrits est impair. Avec élimination directe : les Q
     premiers (champ « sortants ») sortent vers un tableau final ; sans,
     le classement final se fait aux victoires puis départages. */
  if (t.format === "suisse" || t.format === "suisse-elim") {
    const nat = bergerRounds(Array.from({ length: n }, (_, i) => i));
    const rAuto = Math.max(3, Math.ceil(Math.log2(Math.max(2, n))));
    const R = Math.min(nat.length, Math.max(1, Math.floor(+t.rondes) || rAuto));
    const parRonde = Math.floor(n / 2); // matchs joués simultanément par ronde
    const poolMs = [];
    nat.slice(0, R).forEach((round, ri) => round.forEach(([a, b]) =>
      poolMs.push({ tid, phase: "poule", pool: ri, round: ri, a: nom(a), b: nom(b), aK: tid + ":" + a, bK: tid + ":" + b, suisse: true })));
    // inscrits impairs : 1 exempt par ronde, qui tourne — jamais le même
    // deux fois tant que chaque inscrit n'a pas été exempté une fois
    const exempts = [];
    if (n % 2 === 1) nat.slice(0, R).forEach((round, ri) => {
      const pres = {};
      round.forEach((pr) => { pres[pr[0]] = 1; pres[pr[1]] = 1; });
      for (let i = 0; i < n; i++) if (!pres[i]) { exempts.push({ r: ri, j: i }); break; }
    });
    const seule = t.format === "suisse";
    const Q = seule ? 0 : Math.max(2, Math.min(Math.floor(t.qualifs) || 2, n));
    const quals = seule ? [] : Array.from({ length: Q }, (_, i) => ({ suisse: true, r: i }));
    return {
      tab: t, tid, pools: [], sizes: [], P: parRonde, Q, n, unit, nom, poolMs, label, exempts,
      suisse: true, seule, rondes: R, parRonde,
      ...bracketFromQuals(tid, quals),
    };
  }
  const sizes = poolSizes(n);
  const P = sizes.length;
  // répartition serpentin des participants dans les poules (tailles inégales)
  const pools = sizes.map(() => []);
  let idx = 0;
  for (let band = 0; P > 0 && idx < n; band++) {
    for (let k = 0; k < P && idx < n; k++) {
      const pi = band % 2 === 0 ? k : P - 1 - k;
      if (pools[pi].length < sizes[pi]) pools[pi].push(idx++);
    }
  }
  const poolMs = [];
  pools.forEach((ids, pi) => {
    bergerRounds(ids).forEach((round, ri) => round.forEach(([a, b]) =>
      poolMs.push({ tid, phase: "poule", pool: pi, round: ri, a: nom(a), b: nom(b), aK: tid + ":" + a, bK: tid + ":" + b })));
  });
  // qualifiés : si élimination directe (> 24), chaque inscrit entre
  // directement dans le tableau ; une poule UNIQUE (3-5 inscrits) est le
  // tableau final lui-même : pas de sortants, pas de suite en élimination
  // directe ; sinon les Q premiers de chaque poule sortent
  // (Q limité par la taille de la plus petite poule)
  const direct = P === 0;
  const unique = P === 1;
  const Q = direct || unique ? 0 : Math.max(1, Math.min(Math.floor(t.qualifs) || 1, Math.min(...pools.map((p) => p.length))));
  const quals = direct
    ? Array.from({ length: n }, (_, i) => ({ entrant: i, nom: nom(i) }))
    : [];
  if (!direct && !unique) pools.forEach((ids, pi) => { for (let r = 0; r < Q; r++) quals.push({ pi, r }); });
  return {
    tab: t, tid, pools, sizes, P, Q, n, unit, nom, poolMs, label, suisse: false,
    ...bracketFromQuals(tid, quals),
  };
}

/* ---------- coupure jour 2 pour les tableaux sur deux jours ----------
   Si le jour 1 a la capacité d'accueillir poules + tours jusqu'aux
   quarts inclus, le jour 2 démarre aux demi-finales ; sinon le jour 2
   démarre aux quarts de finale (le jour 1 s'arrête aux 8es). */
function cutsDeuxJours(built, jours, duree) {
  const days = daySort(Object.keys(jours).filter((j) => jours[j].actif));
  const res = {};
  if (days.length < 2) return res;
  const terr = (j) => Math.max(1, Math.floor(+jours[j].terrains) || 1);
  const capDay1 = Math.floor(Math.max(0, toMin(jours[days[0]].fin, 18 * 60) - toMin(jours[days[0]].debut, 9 * 60)) / duree) * terr(days[0]);
  let remaining = capDay1;
  built.forEach((b) => {
    if (b.tab.jour === days[0]) remaining -= b.poolMs.length + b.playedFinals.length;
  });
  built.forEach((b) => {
    if (b.tab.jour !== "les-deux") return;
    const R = Object.keys(b.roundsCount).length;
    if (R === 0) return; // poule unique : pas de tableau final, pas de coupure
    const sumRounds = (from, to) => { let s = 0; for (let r = from; r <= to; r++) s += b.roundsCount[r] || 0; return s; };
    const semisIdx = Math.max(0, R - 2);
    const quartersIdx = Math.max(0, R - 3);
    const mSemis = b.poolMs.length + sumRounds(0, semisIdx - 1);
    const mQuarts = b.poolMs.length + sumRounds(0, quartersIdx - 1);
    let cut = quartersIdx;
    if (remaining - mSemis >= 0) { cut = semisIdx; remaining -= mSemis; }
    else remaining -= mQuarts;
    res[b.tid] = { cut, label: roundName((b.paperRounds || b.roundsCount)[cut] || 1) };
  });
  return res;
}

/* ---------- configurations enregistrées : sauver/recharger une config
   de départ, export/import JSON — « Dernière (auto) » est écrasée à
   chaque génération (localStorage si disponible, sinon rien) ---------- */
const CFG_KEY = "echancier-configs-v1";
const CFG_AUTO = "Dernière (auto)";
const cfgStore = {
  read() { try { return JSON.parse(localStorage.getItem(CFG_KEY) || "{}") || {}; } catch (e) { return {}; } },
  write(o) { try { localStorage.setItem(CFG_KEY, JSON.stringify(o)); } catch (e) {} },
};
/* ---------- tableau de bord statistique (bouton « Statistiques ») ----------
   Restitution chiffrée du tournoi, dérivée intégralement du plan et des
   effectifs saisis : inscrits estimés (engagements par tableau — un
   joueur/une paire peut être engagé(e) dans plusieurs tableaux, les
   joueurs étant anonymes ce sont des estimations), matchs, durées,
   attentes avec répartition par palier, occupation des terrains et
   marges réelles par jour. Aucune donnée saisie en plus. */
function statsSummary(plan, jours, dureeBrut, margeBrut) {
  var jH = 0, jF = 0, jI = 0, pM = 0, pF = 0, pX = 0, pI = 0;
  plan.built.forEach(function (b) {
    var n = b.n;
    if (b.unit === "paires") {
      if (b.tab.disc === "DM") pM += n;
      else if (b.tab.disc === "DD") pF += n;
      else if (b.tab.disc === "DX") pX += n;
      else pI += n;
    } else if (b.tab.disc === "SM") jH += n;
    else if (b.tab.disc === "SD") jF += n;
    else jI += n;
  });
  var inscrits = {
    joueursH: jH + 2 * pM + pX,
    joueusesF: jF + 2 * pF + pX,
    intergenre: jI + 2 * pI,
    paires: pM + pF + pX + pI,
    pairesM: pM, pairesF: pF, pairesX: pX, pairesI: pI,
    simples: jH + jF + jI,
    engagements: jH + jF + jI + 2 * (pM + pF + pX + pI),
  };
  var formats = { poules: 0, uniques: 0, direct: 0, suisse: 0 };
  var exempts = 0;
  plan.built.forEach(function (b) {
    if (b.suisse) formats.suisse++;
    else if (b.P === 0) formats.direct++;
    else if (b.P === 1) formats.uniques++;
    else formats.poules++;
    if (b.finals) exempts += b.finals.filter(function (m) { return m.round === 0 && m.bye; }).length;
    if (b.exempts) exempts += b.exempts.length;
  });
  // attentes « badges » : attentes individuelles des matchs planifiés
  var wsAll = plan.sched.map(function (m) { return m.att; })
    .filter(function (w) { return w !== null && w !== undefined; });
  var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
  var paliers = [
    { lbl: "< 30 min", n: wsAll.filter(function (w) { return w < 30; }).length },
    { lbl: "30 min – 1h", n: wsAll.filter(function (w) { return w >= 30 && w < 60; }).length },
    { lbl: "1h – 1h30", n: wsAll.filter(function (w) { return w >= 60 && w < 90; }).length },
    { lbl: "1h30 – 2h", n: wsAll.filter(function (w) { return w >= 90 && w < 120; }).length },
    { lbl: "≥ 2h", n: wsAll.filter(function (w) { return w >= 120; }).length },
  ];
  var wp = plan.attentes.map(function (a) { return a.w; });
  // par jour : matchs, temps de jeu, occupation, attentes, marge réelle
  var jrs = [];
  var jeuTotal = 0;
  plan.days.forEach(function (day) {
    var j = jours[day] || {};
    var ms = plan.perDay[day] || [];
    var dj = dureeCalc(
      j.dureeMatch !== undefined && j.dureeMatch !== "" ? j.dureeMatch : dureeBrut,
      j.marge !== undefined && j.marge !== "" ? j.marge : margeBrut
    );
    var jeu = ms.reduce(function (s, m) { return s + (m.duree !== undefined ? m.duree : dj); }, 0);
    jeuTotal += jeu;
    var terrains = Math.max(1, Math.floor(+j.terrains) || 1);
    var deb = ms.length ? Math.min.apply(null, ms.map(function (m) { return m.time; })) : null;
    var fin = ms.length ? Math.max.apply(null, ms.map(function (m) { return m.time + (m.duree !== undefined ? m.duree : dj); })) : null;
    var plage = fin !== null ? fin - toMin(j.debut, 9 * 60) : 0;
    var wsD = ms.map(function (m) { return m.att; }).filter(function (w) { return w !== null && w !== undefined; });
    jrs.push({
      day: day,
      nb: ms.length,
      poules: ms.filter(function (m) { return m.phase === "poule"; }).length,
      finales: ms.filter(function (m) { return m.phase !== "poule"; }).length,
      dureeJ: dj,
      jeuH: Math.round(jeu / 60),
      occupation: plage > 0 ? Math.round(100 * jeu / (terrains * plage)) : 0,
      terrains: terrains,
      debut: deb !== null ? fmtTime(deb) : "—",
      fin: fin !== null ? fmtTime(fin) : "—",
      margeReelle: fin !== null ? Math.round(toMin(j.fin, 18 * 60) - fin) : null,
      attMoy: wsD.length ? Math.round(sum(wsD) / wsD.length) : 0,
      attMax: wsD.length ? Math.max.apply(null, wsD) : 0,
      att60: wsD.filter(function (w) { return w >= 60; }).length,
      wo: plan.forfaits.filter(function (m) { return m.day === day; }).length,
    });
  });
  var byDisc = {};
  plan.built.forEach(function (b) {
    var nb = plan.sched.filter(function (m) { return m.tid === b.tid; }).length;
    byDisc[b.tab.disc] = (byDisc[b.tab.disc] || 0) + nb;
  });
  var eng = inscrits.engagements || 1;
  return {
    inscrits: inscrits,
    total: plan.sched.length,
    tableaux: {
      total: plan.built.length, formats: formats, exempts: exempts,
      wo: plan.forfaits.length, nonPlanifies: plan.unscheduled.length,
    },
    attentes: {
      n: wsAll.length,
      moy: wsAll.length ? Math.round(sum(wsAll) / wsAll.length) : 0,
      max: wsAll.length ? Math.max.apply(null, wsAll) : 0,
      sup60: wsAll.filter(function (w) { return w >= 60; }).length,
      paliers: paliers,
    },
    attentesJoueurs: {
      n: wp.length,
      moy: wp.length ? Math.round(sum(wp) / wp.length) : 0,
      max: wp.length ? Math.max.apply(null, wp) : 0,
      sup60: wp.filter(function (w) { return w >= 60; }).length,
    },
    jours: jrs,
    byDisc: byDisc,
    jeu: {
      totalH: Math.round(jeuTotal / 60),
      moyenneParEngagement: Math.round(2 * jeuTotal / eng),
      matchsParEngagement: Math.round(10 * 2 * plan.sched.length / eng) / 10,
    },
  };
}
/* ---------- moteur d'ordonnancement ---------- */
/* Pour chaque jour : simulation événementielle. Chaque terrain a une
   heure de libération ; on prend le terrain libre le plus tôt, et parmi
   les matchs jouables on choisit celui dont le participant le plus
   tardivement libéré a fini le plus tôt (attente maximale réduite).
   Chaque jour peut définir une pause déjeuner (aucun match ne la
   chevauche) ; le 7e argument (facultatif) liste les matchs « W.O. »
   (forfaits) : ils ne consomment pas de terrain et libèrent les
   matchs qui en dépendent — la journée est replanifiée sans eux. */
function computePlan(tabs, jours, dureeBrut, margeBrut, combosTox, finalesFin, forfaits, cadenceBrut) {
  // durée planifiée = durée moyenne + marge de sécurité : la marge absorbe
  // les dépassements réels pour que le repos de 20 min reste garanti
  const duree = Math.max(28, Math.floor(+dureeBrut) || 28) + Math.max(0, Math.floor(+margeBrut) || 0);
  // option « cadence par vagues » (0 → 1) : resserrer les tours d'une
  // même poule à un battement régulier au lieu de l'entrelacement souple.
  // 0 = souple (défaut) ; à mi-course le battement minimal entre la fin
  // du tour précédent d'une poule et le début du suivant interpole du
  // repos (20 min) vers la durée d'un créneau ; à 1 = vague stricte par
  // tableau : le tour r ne démarre que lorsque le tour r-1 du même
  // tableau est entièrement terminé (rythme cadencé type BadNet). Le
  // repos minimum de 20 min reste garanti dans tous les cas.
  const cadence = Math.min(1, Math.max(0, Number(cadenceBrut) || 0));
  const days = daySort(Object.keys(jours).filter((j) => jours[j].actif));
  // durée et marge peuvent être surchargées pour chaque journée (paramètre
  // vide = valeur commune) ; l'option « demis et finales en fin de journée »
  // est également propre à chaque jour (le 6e argument reste la valeur de
  // repli pour un jour qui ne la précise pas)
  const resDuree = (day) => {
    const j = jours[day] || {};
    return dureeCalc(
      j.dureeMatch !== undefined && j.dureeMatch !== "" ? j.dureeMatch : dureeBrut,
      j.marge !== undefined && j.marge !== "" ? j.marge : margeBrut
    );
  };
  const built = tabs.map((t, i) => buildTab(t, i));
  const items = [];
  built.forEach((b) => {
    b.poolMs.forEach((m) => items.push({ ...m, scheduled: false }));
    b.playedFinals.forEach((m) => items.push({ ...m, scheduled: false }));
  });
  // clé stable d'un match (suivi en direct : terminé / W.O.) + marque W.O.
  // un même tour de poule contient plusieurs affrontements simultanés : la
  // clé distingue la paire (indices des deux inscrits) pour qu'un W.O.
  // n'exclue que SON match
  items.forEach((m) => {
    m.key = m.phase === "poule"
      ? "P" + m.tid + "-" + m.pool + "-" + m.round + "-" + m.aK.split(":")[1] + "-" + m.bK.split(":")[1]
      : "F" + m.tid + "-" + m.fid;
    m.forfait = forfaits !== undefined && forfaits !== null && typeof forfaits.has === "function" && forfaits.has(m.key);
  });
  // intercalage : un match de tableau final attend ses deux matchs
  // sources (fin du tour précédent) ET l'ordre strict des tours du même
  // tableau : un tour ne démarre que lorsque le tour précédent du
  // tableau est entièrement terminé (jamais de demi pendant qu'un
  // quart du même tableau est en jeu — exigence juge-arbitre)
  const finByFid = new Map();
  items.forEach((m) => { if (m.phase !== "poule") finByFid.set(m.tid + "|" + m.fid, m); });
  // jour en cours de planification : une source jouée un AUTRE jour (tableau
  // « les deux jours ») ne contraint pas l'heure de reprise — le repos de la
  // nuit est acquis, le match du jour 2 démarre à l'ouverture du jour au lieu
  // d'hériter de l'horloge absolue du jour 1 (bug : finale reprogrammée à
  // l'heure de la veille, d'où des marges réelles dimanche aberrantes)
  let curDay = null;
  const feederEnd = (m) => {
    if (m.round === 0) return -1e9;
    let pe = -1e9;
    [m.a, m.b].forEach((fid) => {
      const fm = finByFid.get(m.tid + "|" + fid);
      if (fm === undefined) pe = Math.max(pe, -1e9);
      // source « W.O. » (forfait) : dure 0 min — elle « finit » dès que
      // SES propres sources sont terminées
      else if (fm.forfait) pe = Math.max(pe, feederEnd(fm));
      // source « bye » (exemptée) : jamais planifiée → sans contrainte
      else pe = Math.max(pe, fm.scheduled ? (fm.day !== undefined && fm.day !== curDay ? -1e9 : fm.time + (fm.duree !== undefined ? fm.duree : duree)) : Infinity);
    });
    return pe;
  };
  const cuts = cutsDeuxJours(built, jours, days.length ? resDuree(days[0]) : duree);
  const allowed = (m) => {
    const b = built[m.tid];
    const j = b.tab.jour;
    if (j === "les-deux") {
      // tours de tableau final à partir de la coupure : jour 2 uniquement
      if (days.length > 1 && m.phase === "finale" && cuts[b.tid] && m.round >= cuts[b.tid].cut)
        return [days[1]];
      return days.slice();
    }
    return days.includes(j) ? [j] : days.slice();
  };
  // nombre de tours par tableau (tours de poule + tours du tableau final) :
  // critère de départage — les séries les plus longues démarrent en premier
  const nbRoundsTab = built.map((b) =>
    (b.poolMs.length ? Math.max(...b.poolMs.map((m) => m.round)) + 1 : 0) +
    Object.keys(b.roundsCount).length);
  // regroupement par série : « Série 2 » → 2 ; classement libre → fin de liste.
  // Les tableaux d'une même série (SM Série 1, SD Série 1, DX Série 1…)
  // forment un bloc qui démarre ensemble, avant la série suivante.
  const serieIdx = built.map((b) => {
    const mm = /Série\s*(\d+)/i.exec(String(b.tab.classement || ""));
    return mm ? parseInt(mm[1], 10) : Number.MAX_SAFE_INTEGER;
  });
  const sched = [];
  const perDay = {};
  const dayDuree = {}; // jour -> durée planifiée effective de ses matchs
  const lastEnd = new Map(); // clé participant -> fin du dernier match (jour courant)
  const poolEndAll = new Map(); // tid|jour -> fin de la dernière poule/ronde planifiée ce jour-là
  for (const day of days) {
    const j = jours[day];
    const dureeJ = resDuree(day);
    const finalesFinJ = j.finalesFin !== undefined ? !!j.finalesFin : !!finalesFin;
    dayDuree[day] = dureeJ;
    // battement minimal interpole du repos vers la durée d'un créneau
    // selon la cadence (option « cadence par vagues »)
    const battementJ = REPOS + Math.round(cadence * Math.max(0, dureeJ - REPOS));
    const start = toMin(j.debut, 9 * 60);
    const end = toMin(j.fin, 18 * 60);
    const courts = Array.from({ length: Math.max(1, j.terrains) }, () => start);
    // pause déjeuner du jour (facultative) : aucun match ne la chevauche
    const pauseD = toMin(j.pauseDebut, null);
    const pauseF = toMin(j.pauseFin, null);
    const hasPause = pauseD !== null && pauseF !== null && pauseF > pauseD;
    curDay = day;
    lastEnd.clear();
    const queue = items.filter((m) => !m.scheduled && !m.forfait && allowed(m).includes(day));
    const st = built.map(() => ({ poolLeft: 0, roundLeft: {}, roundEnd: {}, swissLeft: {}, poolRoundLeft: {}, poolRoundEnd: {}, poolEndR: {} }));
    queue.forEach((m) => {
      if (m.phase === "poule") {
        st[m.tid].poolLeft++;
        st[m.tid].poolRoundLeft[m.round] = (st[m.tid].poolRoundLeft[m.round] || 0) + 1;
        if (m.suisse) st[m.tid].swissLeft[m.round] = (st[m.tid].swissLeft[m.round] || 0) + 1;
      }
      else st[m.tid].roundLeft[m.round] = (st[m.tid].roundLeft[m.round] || 0) + 1;
    });
    // ---- démarrage progressif des tableaux ----
    // on ne lance pas tous les tableaux d'un coup : les séries dont les
    // tours sont les plus nombreux démarrent en premier et occupent les
    // terrains ; les suivantes sont mises en jeu progressivement, quand
    // les tableaux actifs n'ont plus de match prêt — certaines démarrent
    // ainsi l'après-midi, quand les premières sont terminées. Cela garde
    // les tours de chaque tableau groupés et réduit les temps d'attente.
    const dayCount = {};
    const dayTids = [];
    queue.forEach((m) => {
      dayCount[m.tid] = (dayCount[m.tid] || 0) + 1;
      if (dayTids.indexOf(m.tid) < 0) dayTids.push(m.tid);
    });
    const dayOrder = dayTids.slice().sort((x, y) =>
      nbRoundsTab[y] - nbRoundsTab[x] || serieIdx[x] - serieIdx[y] ||
      dayCount[y] - dayCount[x] || x - y);
    const activeTids = new Set();
    let actIdx = 0, cumPools = 0;
    while (actIdx < dayOrder.length && (actIdx === 0 || cumPools < courts.length)) {
      activeTids.add(dayOrder[actIdx]);
      cumPools += Math.max(1, built[dayOrder[actIdx]].P || 0);
      actIdx++;
    }
    const okActive = (m) => activeTids.has(m.tid);
    const pStart = (m) => {
      if (m.phase === "poule") {
        // ronde suisse : une ronde ne démarre que lorsque la précédente du
        // même tableau est entièrement planifiée (ordre des rondes strict)
        if (m.suisse && (st[m.tid].swissLeft[m.round - 1] || 0) > 0) return Infinity;
        let base = Math.max((lastEnd.get(m.aK) ?? -1e9) + REPOS, (lastEnd.get(m.bK) ?? -1e9) + REPOS);
        // option « cadence par vagues » : battement régulier entre les
        // tours d'une même poule ; à cadence maximale, vague stricte par
        // tableau — le tour r attend la fin du tour r-1 du tableau entier
        // (échéancier à créneaux cadencés type BadNet)
        if (cadence > 0 && m.round > 0 && !m.suisse) {
          const s2 = st[m.tid];
          if (cadence >= 1) {
            if ((s2.poolRoundLeft[m.round - 1] || 0) > 0) return Infinity;
            base = Math.max(base, (s2.poolRoundEnd[m.round - 1] ?? -1e9) + battementJ);
          } else {
            base = Math.max(base, (s2.poolEndR[m.pool + "|" + (m.round - 1)] ?? -1e9) + battementJ);
          }
        }
        return base;
      }
      const s = st[m.tid];
      if (s.poolLeft > 0) return Infinity;
      // 1er tour du tableau final (qualifiés sortis des poules OU des
      // rondes suisses) : il ne démarre qu'après la FIN de la dernière
      // poule/ronde du tableau (résultats complets) + repos — un qualifié
      // a ainsi forcément terminé TOUS ses matchs de poule avant le 1er
      // tour (plus de quart qui démarre pendant la dernière ronde)
      if (m.round === 0) return (s.poolEnd ?? -1e9) + REPOS;
      // option « demis et finales en fin de journée » (propre à chaque jour) :
      // les demis et finales sont tenues en fin de journée, une fois toutes les
      // poules du jour terminées — SAUF si le tableau attendrait plus de 2h30
      // (FIN_HOLD) après la fin de ses propres poules : ses tours finals
      // avancent alors dès que possible. Les tableaux démarrés tardivement ou
      // dont les tours sont de toute façon tardifs restent tenus.
      if (finalesFinJ) {
        const R = Object.keys(built[m.tid].roundsCount).length;
        if (m.round >= R - 2) {
          // les poules du jour sont-elles encore à jouer ou en jeu ?
          let unPool = 0;
          queue.forEach((q) => { if (!q.scheduled && q.phase === "poule") unPool++; });
          if (unPool > 0 || poolPlayEnd > curT0) {
            // estimation de la fin de TOUTES les poules du jour : fin déjà
            // planifiée, ou heure courante + reste à jouer (approx. : un
            // « tour » de poules par vague de terrains, durée + repos)
            const estPoolsEnd = Math.max(poolPlayEnd,
              curT0 + Math.ceil(unPool / courts.length) * (dureeJ + REPOS));
            const peTab = s.poolEnd ?? curT0;
            if (peTab + FIN_HOLD > estPoolsEnd) return Infinity; // tenue
          }
        }
      }
      // ordre strict des tours d'un même tableau : le tour r attend que
      // tous les matchs du tour r-1 du tableau soient planifiés ET
      // terminés — les 1/8 avant les 1/4, les 1/4 avant les 1/2
      if ((s.roundLeft[m.round - 1] || 0) > 0) return Infinity;
      const pe = feederEnd(m);
      if (pe === Infinity) return Infinity;
      return Math.max(pe + REPOS, s.roundEnd[m.round - 1] ?? -1e9);
    };
    const prio = (m) => {
      // en poule : le participant qui attend depuis le PLUS LONGTEMPS
      // (fin de match la plus ancienne) est servi en premier → les
      // attentes longues (> 1h) sont réduites au maximum
      if (m.phase === "poule")
        return Math.min(lastEnd.get(m.aK) ?? -1e9, lastEnd.get(m.bK) ?? -1e9);
      return st[m.tid].roundEnd[m.round] ?? -1e9;
    };
    let poolPlayEnd = -1e9; // fin (heure) du dernier match de poule planifié du jour
    let curT0 = -1e9;      // heure courante du terrain libre le plus tôt
    let guard = 0;
    for (;;) {
      if (++guard > 20000) break;
      let ci = -1, t0 = Infinity;
      courts.forEach((c, i) => { if (c < t0) { t0 = c; ci = i; } });
      if (ci === -1) break;
      curT0 = t0;
      // pas de coupure d'heure de fin : tous les matchs sont planifiés,
      // même au-delà de l'horaire officiel (le dépassement est indiqué
      // dans la vue échéancier plutôt que de supprimer des matchs)
      const remaining = queue.some((m) => !m.scheduled);
      if (!remaining) { courts[ci] = Infinity; continue; }
      // combinaisons toxiques autorisées (option) : phase courante = famille
      // la moins avancée encore à jouer ce jour ; on ne joue jamais une
      // famille tant qu'une famille précédente a des matchs en attente
      let phaseMin = -1;
      if (combosTox) {
        phaseMin = Infinity;
        queue.forEach((m) => {
          if (!m.scheduled) phaseMin = Math.min(phaseMin, DISC_PHASE[built[m.tid].tab.disc] ?? 0);
        });
      }
      const okPhase = (m) => phaseMin < 0 || (DISC_PHASE[built[m.tid].tab.disc] ?? 0) === phaseMin;
      const cands = queue.filter((m) => !m.scheduled && pStart(m) <= t0 && okActive(m) && okPhase(m));
      if (!cands.length) {
        // aucun match prêt parmi les tableaux actifs : mise en jeu
        // progressive du tableau suivant (jusqu'à ce que tous démarrent)
        if (actIdx < dayOrder.length) {
          activeTids.add(dayOrder[actIdx]);
          cumPools += Math.max(1, built[dayOrder[actIdx]].P || 0);
          actIdx++;
          continue;
        }
        let nxt = Infinity;
        queue.forEach((m) => { if (!m.scheduled && okPhase(m)) nxt = Math.min(nxt, pStart(m)); });
        if (nxt === Infinity) { courts[ci] = Infinity; continue; }
        courts[ci] = Math.max(t0, nxt);
        continue;
      }
      // départages après la priorité d'attente (joueur/paire le plus
      // attendu servi en premier) : même tour d'abord, puis séries
      // ayant le plus de tours, puis poules dans l'ordre, puis tableau —
      // les matchs d'une même poule et d'un même tour restent groupés,
      // chaque tour se termine avant de passer aux suivants
      cands.sort((x, y) =>
        prio(x) - prio(y) ||
        x.round - y.round ||
        nbRoundsTab[y.tid] - nbRoundsTab[x.tid] ||
        (x.phase === "poule" && y.phase === "poule" ? x.pool - y.pool : 0) ||
        x.tid - y.tid
      );
      const m = cands[0];
      const ps = pStart(m);
      let time = Math.max(t0, ps);
      // pause déjeuner : un match qui chevaucherait la pause démarre après
      if (hasPause && time < pauseF && time + dureeJ > pauseD) time = pauseF;
      // attente TOTALE (repos inclus) depuis le match précédent du
      // joueur/de la paire concernée : la plus longue des deux (poules) ;
      // pour les finales, celle du qualifié issu de la source finie le
      // plus tôt (le plus attendu des deux)
      if (m.phase === "poule") {
        const wa = lastEnd.has(m.aK) ? time - lastEnd.get(m.aK) : -1;
        const wb = lastEnd.has(m.bK) ? time - lastEnd.get(m.bK) : -1;
        m.att = wa < 0 && wb < 0 ? null : Math.max(wa, wb);
      } else {
        // attente du qualifié le plus attendu : sa source est celle qui
        // finit le plus tôt ; une source W.O. dure 0 min (elle finit
        // quand SES sources finissent)
        let peMin = Infinity, found = false;
        [m.a, m.b].forEach((fid) => {
          const fm = finByFid.get(m.tid + "|" + fid);
          let e;
          if (fm !== undefined && fm.forfait) e = feederEnd(fm);
          else if (fm !== undefined && fm.scheduled) e = fm.day !== undefined && fm.day !== day ? undefined : fm.time + (fm.duree !== undefined ? fm.duree : dureeJ);
          if (e !== undefined && e < -1e8) e = undefined; // source jouée un autre jour ou sans contrainte : pas d'attente mesurable
          if (e !== undefined) { found = true; peMin = Math.min(peMin, e); }
        });
        m.att = found ? time - peMin : null;
        // premier tour d'élimination directe (qualifiés issus des poules
        // ou des rondes suisses) : attente individuelle non applicable —
        // on mémorise le délai depuis la fin estimée de la dernière poule/
        // ronde du tableau (badge « ≈ », indicateur organisationnel)
        m.attPhase = found ? null : (poolEndAll.get(m.tid + "|" + day) !== undefined ? time - poolEndAll.get(m.tid + "|" + day) : null);
      }
      m.scheduled = true; m.day = day; m.time = time; m.court = ci; m.appel = time - APPEL; m.duree = dureeJ;
      courts[ci] = time + dureeJ;
      if (m.phase === "poule") {
        lastEnd.set(m.aK, time + dureeJ); lastEnd.set(m.bK, time + dureeJ);
        st[m.tid].poolLeft--;
        if (m.suisse) st[m.tid].swissLeft[m.round] = (st[m.tid].swissLeft[m.round] || 1) - 1;
        st[m.tid].poolRoundLeft[m.round] = (st[m.tid].poolRoundLeft[m.round] || 1) - 1;
        st[m.tid].poolRoundEnd[m.round] = Math.max(st[m.tid].poolRoundEnd[m.round] ?? 0, time + dureeJ);
        st[m.tid].poolEndR[m.pool + "|" + m.round] = Math.max(st[m.tid].poolEndR[m.pool + "|" + m.round] ?? 0, time + dureeJ);
        st[m.tid].poolEnd = Math.max(st[m.tid].poolEnd ?? 0, time + dureeJ);
        poolEndAll.set(m.tid + "|" + day, Math.max(poolEndAll.get(m.tid + "|" + day) ?? 0, time + dureeJ));
        poolPlayEnd = Math.max(poolPlayEnd, time + dureeJ);
      } else {
        st[m.tid].roundLeft[m.round] = (st[m.tid].roundLeft[m.round] || 1) - 1;
        st[m.tid].roundEnd[m.round] = Math.max(st[m.tid].roundEnd[m.round] ?? 0, time + dureeJ);
      }
      (perDay[day] = perDay[day] || []).push(m);
      sched.push(m);
    }
  }
  // numérotation des matchs (1 → fin du tournoi) : ordre chronologique,
  // jour par jour puis heure puis terrain — le même numéro désigne le
  // même match dans toutes les vues et dans l'export CSV
  let num = 0;
  for (const day of days) {
    (perDay[day] || []).slice().sort((a, b) => a.time - b.time || a.court - b.court)
      .forEach((m) => { m.num = ++num; });
  }
  // attentes par participant (jour par jour)
  const attentes = [];
  for (const day of days) {
    const byP = new Map();
    (perDay[day] || []).forEach((m) => {
      if (m.phase !== "poule") return;
      (byP.get(m.aK) || byP.set(m.aK, []).get(m.aK)).push(m.time);
      (byP.get(m.bK) || byP.set(m.bK, []).get(m.bK)).push(m.time);
    });
    byP.forEach((times) => {
      times.sort((x, y) => x - y);
      for (let i = 1; i < times.length; i++) {
        const w = times[i] - (times[i - 1] + dayDuree[day]);
        if (w >= 0) attentes.push({ day, w });
      }
    });
  }
  // matchs W.O. (forfaits) : jamais planifiés sur un terrain — ils sont
  // exclus des créneaux et rattachés à leur jour pour les comptages
  const forfList = items.filter((m) => m.forfait);
  forfList.forEach((m) => {
    const ad = allowed(m);
    m.day = ad.length ? ad[0] : (days.length ? days[0] : null);
    m.att = null;
    m.attPhase = null;
  });
  return { sched, perDay, built, days, unscheduled: items.filter((m) => !m.scheduled && !m.forfait), attentes, cuts, forfaits: forfList };
}

/* ============ Composant principal ============ */
/* ---------- thème « Bad18 » (rouge / blanc / noir, aux couleurs des
   logos Bad18 : volant BAD 18 et coq) — appliqué via une classe wrapper
   qui remplace la palette verte par la palette rouge ---------- */
const THEME_BAD18_CSS = `
.theme-bad18 .bg-emerald-50 { background-color: #fef2f2 !important; }
.theme-bad18 .bg-emerald-100 { background-color: #fee2e2 !important; }
.theme-bad18 .bg-emerald-600 { background-color: #dc2626 !important; }
.theme-bad18 .bg-emerald-700 { background-color: #b91c1c !important; }
.theme-bad18 .hover\\:bg-emerald-50:hover { background-color: #fef2f2 !important; }
.theme-bad18 .hover\\:bg-emerald-700:hover { background-color: #b91c1c !important; }
.theme-bad18 .border-emerald-50 { border-color: #fee2e2 !important; }
.theme-bad18 .border-emerald-100 { border-color: #fecaca !important; }
.theme-bad18 .border-emerald-200 { border-color: #fca5a5 !important; }
.theme-bad18 .border-emerald-300 { border-color: #f87171 !important; }
.theme-bad18 .border-emerald-500,
.theme-bad18 .focus\\:border-emerald-500:focus { border-color: #ef4444 !important; }
.theme-bad18 .text-emerald-400 { color: #f87171 !important; }
.theme-bad18 .text-emerald-500 { color: #ef4444 !important; }
.theme-bad18 .text-emerald-600 { color: #dc2626 !important; }
.theme-bad18 .text-emerald-700 { color: #b91c1c !important; }
.theme-bad18 .text-emerald-800 { color: #991b1b !important; }
.theme-bad18 .text-emerald-900 { color: #7f1d1d !important; }
`;
/* ---------- palette sémantique des attentes : couleurs IDENTIQUES dans
   tous les thèmes (classique, Bad18, dark) — classes dédiées attb-1..5,
   insensibles aux surcharges CSS des thèmes ---------- */
const ATT_CSS = `
.attb-1 { background-color: #059669 !important; color: #ffffff !important; }
.attb-2 { background-color: #d1fae5 !important; color: #065f46 !important; }
.attb-3 { background-color: #fef08a !important; color: #713f12 !important; }
.attb-4 { background-color: #fed7aa !important; color: #7c2d12 !important; }
.attb-5 { background-color: #fecaca !important; color: #7f1d1d !important; }
`;
/* ---------- notes et explications dépliables : masquées par défaut,
   chacune s'ouvre d'un clic (élément natif <details>/<summary>) ;
   masquées aussi à l'impression/PDF — couleur de la poignée adaptée
   à chaque thème (classique vert, Bad18 rouge, dark bleu ciel) ---------- */
const NOTE_CSS = `
.note { border: 1px dashed #a7f3d0; border-radius: 10px; margin: 6px 0; }
.theme-bad18 .note { border-color: #f87171; }
.theme-dark .note { border-color: #33517a; }
.note-sum { cursor: pointer; padding: 3px 10px; font-size: .72rem; font-weight: 700; color: #047857; list-style: none; user-select: none; }
.theme-bad18 .note-sum { color: #b91c1c; }
.theme-dark .note-sum { color: #38bdf8; }
.note-sum::-webkit-details-marker { display: none; }
.note-sum::after { content: " ▸"; }
.note[open] .note-sum::after { content: " ▾"; }
.note-body { padding: 2px 12px 8px; }
@media print { .note { display: none !important; } }
`;
/* ---------- thème « dark » : fond bleu nuit — textes de contenu en
   bleu ciel (au lieu du vert), notes et explications en gris moyen ;
   bulles d'alerte/notifications et pastilles (attb-*, marges) inchangées :
   elles gardent leurs couleurs du mode classique ---------- */
const THEME_DARK_CSS = `
body:has(.theme-dark) { background-color: #0b1220 !important; }
.theme-dark { background-color: #0b1220 !important; color: #e2e8f0 !important; }
.theme-dark .bg-white { background-color: #101a2c !important; }
.theme-dark .bg-slate-100 { background-color: #1a2c47 !important; }
.theme-dark .bg-emerald-50 { background-color: #16233a !important; }
.theme-dark .bg-emerald-100 { background-color: #1a2c47 !important; }
.theme-dark .border-emerald-50 { border-color: #1f2b40 !important; }
.theme-dark .border-emerald-100 { border-color: #243a55 !important; }
.theme-dark .border-emerald-200 { border-color: #2b4260 !important; }
.theme-dark .border-emerald-300 { border-color: #33517a !important; }
.theme-dark .border-emerald-500,
.theme-dark .focus\\:border-emerald-500:focus { border-color: #33517a !important; }
/* gris moyen : notes et explications (textes secondaires) */
.theme-dark .text-slate-500 { color: #94a3b8 !important; }
.theme-dark .text-slate-600 { color: #94a3b8 !important; }
.theme-dark .text-emerald-400,
.theme-dark .text-emerald-500 { color: #94a3b8 !important; }
/* bleu ciel : texte principal (au lieu du vert) */
.theme-dark .text-emerald-600 { color: #38bdf8 !important; }
.theme-dark .text-emerald-700,
.theme-dark .text-emerald-800 { color: #7dd3fc !important; }
.theme-dark .text-emerald-900 { color: #e2e8f0 !important; }
/* bulles de notification positives (✅) : le texte reste vert */
.theme-dark .p-3.text-sm.bg-emerald-50.text-emerald-800 { color: #a7f3d0 !important; }
.theme-dark .text-amber-600 { color: #fbbf24 !important; }
.theme-dark .text-red-600,
.theme-dark .text-red-700 { color: #f87171 !important; }
`;
/* impression / export PDF : masque les boutons et garde le contenu */
const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; }
}
`;
/* logo Bad18 : pastille noire cerclée de rouge, volant blanc à bords
   rouges et inscription « BAD 18 » — version vectorielle des logos */
function Bad18Logo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Logo Bad18">
      <rect x="3" y="3" width="90" height="90" rx="20" fill="#0f0f0f" stroke="#dc2626" strokeWidth="4" />
      <g transform="translate(77,21)">
        <path d="M-10 -14 L10 -14 L5 10 L-5 10 Z" fill="#ffffff" />
        <path d="M-10 -14 L-5 10 M0 -14 L0 10 M10 -14 L5 10" stroke="#dc2626" strokeWidth="2" fill="none" />
        <circle cx="0" cy="16" r="6" fill="#dc2626" stroke="#ffffff" strokeWidth="1.5" />
      </g>
      <text x="10" y="38" fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900" fontSize="26" fill="#ffffff">BAD</text>
      <text x="22" y="80" fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900" fontSize="38" fill="#dc2626">18</text>
    </svg>
  );
}
/* note dépliable : enveloppe un texte explicatif — masqué par défaut,
   « ℹ️ » + libellé cliquable pour le déplier, un par un */
function Note({ label, children }) {
  return (
    <details className="note">
      <summary className="note-sum">ℹ️ {label}</summary>
      <div className="note-body">{children}</div>
    </details>
  );
}
function App() {
  const [phase, setPhase] = useState("config");
  const [dureeMatch, setDureeMatch] = useState(28);
  const [marge, setMarge] = useState(0);
  const [combosTox, setCombosTox] = useState(false);
  const [finalesFin, setFinalesFin] = useState(false);
  // option « cadence par vagues » : 0 = souple (défaut), 0.5 = resserrée,
  // 1 = vagues strictes par tableau (rythme cadencé type BadNet)
  const [cadence, setCadence] = useState(0);
  const [theme, setTheme] = useState("classique");
  const [jours, setJours] = useState({
    samedi: { actif: true, terrains: 8, debut: "08:30", fin: "21:50", dureeMatch: "", marge: "", finalesFin: false },
    dimanche: { actif: true, terrains: 8, debut: "08:30", fin: "17:00", dureeMatch: "", marge: "", finalesFin: false },
  });
  const [tabs, setTabs] = useState(baseTabs());
  const [vueTab, setVueTab] = useState("planning");
  // tableau de bord statistique : affiché/masqué par le bouton dédié
  const [showStats, setShowStats] = useState(false);
  // suivi en direct : matchs cochés « terminé » et « W.O. » (forfaits) —
  // un W.O. replanifie la journée sans consommer de créneau terrain
  const [live, setLive] = useState(false);
  const [finis, setFinis] = useState({});
  const [wf, setWf] = useState({});
  // configurations enregistrées : { nom: snapshot } — « Dernière (auto) »
  const [configs, setConfigs] = useState(() => cfgStore.read());
  const [cfgName, setCfgName] = useState("");
  const forfaitsSet = useMemo(() => new Set(Object.keys(wf).filter((k) => wf[k])), [wf]);

  const joursActifs = daySort(Object.keys(jours).filter((j) => jours[j].actif));

  const majTab = (i, champ, v) => setTabs((prev) => prev.map((t, k) => (k === i ? { ...t, [champ]: v } : t)));
  const supprTab = (i) => setTabs((prev) => prev.filter((_, k) => k !== i));
  const ajoutTab = () => setTabs((prev) => [...prev, { disc: "SM", classement: "", nb: 9, qualifs: 2, jour: "samedi", format: "", rondes: "" }]);
  // jours supplémentaires (au-delà de samedi et dimanche, max 4 au total)
  const ajoutJour = () => setJours((p) => {
    if (Object.keys(p).length >= 4) return p;
    let n = 3;
    while (p["jour " + n] !== undefined) n++;
    return { ...p, ["jour " + n]: { actif: true, terrains: 8, debut: "08:30", fin: "18:00", dureeMatch: "", marge: "", finalesFin: false } };
  });
  const supprJour = (j) => setJours((p) => {
    const q = { ...p };
    delete q[j];
    return q;
  });

  /* ---------- configurations enregistrées ---------- */
  const snapshot = () => ({
    jours: JSON.parse(JSON.stringify(jours)), tabs: JSON.parse(JSON.stringify(tabs)),
    dureeMatch, marge, combosTox, finalesFin, cadence, theme,
  });
  const applyCfg = (c) => {
    if (!c || typeof c !== "object") return;
    if (c.jours && typeof c.jours === "object") setJours(JSON.parse(JSON.stringify(c.jours)));
    if (Array.isArray(c.tabs)) setTabs(JSON.parse(JSON.stringify(c.tabs)));
    if (c.dureeMatch !== undefined) setDureeMatch(c.dureeMatch);
    if (c.marge !== undefined) setMarge(c.marge);
    if (c.combosTox !== undefined) setCombosTox(!!c.combosTox);
    if (c.finalesFin !== undefined) setFinalesFin(!!c.finalesFin);
    if (c.cadence !== undefined) setCadence(Math.min(1, Math.max(0, +c.cadence || 0)));
    if (c.theme) setTheme(c.theme);
  };
  const saveCfg = (nom) => {
    const n = (nom || cfgName || "").trim();
    if (!n) return;
    const o = { ...cfgStore.read(), [n]: snapshot() };
    cfgStore.write(o);
    setConfigs(o);
    setCfgName("");
  };
  const delCfg = (nom) => {
    const o = { ...cfgStore.read() };
    delete o[nom];
    cfgStore.write(o);
    setConfigs(o);
  };
  const exportCfg = () => {
    const data = JSON.stringify({ app: "echancier-badminton", version: 1, config: snapshot() }, null, 2);
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
      a.download = "echancier-config.json";
      // Safari/iOS : l'ancre doit être dans le document
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {}
  };
  const importCfg = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { try { const d = JSON.parse(String(r.result)); applyCfg(d && d.config ? d.config : d); } catch (e) {} };
    r.readAsText(file);
  };

  const plan = useMemo(
    () => (phase === "tournoi" ? computePlan(tabs, jours, dureeMatch, marge, combosTox, finalesFin, forfaitsSet, cadence) : null),
    [phase, tabs, jours, dureeMatch, marge, combosTox, finalesFin, forfaitsSet, cadence]
  );

  const inputCls = "w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";
  const cardCls = "rounded-xl border border-emerald-100 bg-white p-4 shadow-sm";
  const numCls = "w-20 rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none";

  /* ---------- écran configuration ---------- */
  if (phase === "config") {
    return (
      <div className={"mx-auto max-w-4xl space-y-5 p-4" + (theme === "bad18" ? " theme-bad18" : theme === "dark" ? " theme-dark" : "")}>
        <style>{THEME_BAD18_CSS}</style>
        <style>{THEME_DARK_CSS}</style>
        <style>{ATT_CSS}</style>
        <style>{NOTE_CSS}</style>
        <div className={cardCls}>
          <div className="flex items-center gap-3">
            <Bad18Logo size={52} />
            <h1 className="text-xl font-bold text-emerald-900">🏸 Échéancier Tournoi de Badminton</h1>
          </div>
          <Note label="Fonctionnement">
            <p className="mt-1 text-sm text-emerald-700">
            Paramétrage prédictif : indiquez pour chaque tableau le nombre de joueurs/paires,
            les sortants par poule et le(s) jour(s) de jeu, et le format de chaque tableau
            (poules + élimination directe, ronde suisse + élimination directe, ou ronde suisse seule).
            Base proposée : 5 séries par catégorie
            (SM, SD, DX le samedi ; DM, DD le dimanche), 9 joueurs/paires par tableau — les
            tableaux intergenre ne sont pas proposés de base mais restent ajoutables manuellement.
            Les poules (3-5) sont composées automatiquement pour minimiser le nombre de matchs ;
            au-delà de 24 inscrits, élimination directe. Aucun nom à saisir. L'échéancier démarre ensuite les
            tableaux progressivement — les séries aux tours les plus nombreux d'abord, les suivantes au fil des
            créneaux libérés — et alterne les matchs pour minimiser l'attente, avec {REPOS} min de repos minimum et {APPEL} min d'appel.
            </p>
          </Note>
        </div>

        <h3 className="font-semibold text-emerald-900">🗓️ Jours du tournoi</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {daySort(Object.keys(jours)).map((j) => (
            <div key={j} className={cardCls}>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold capitalize text-emerald-900">{j}</h4>
                <div className="flex items-center gap-2">
                  {j !== "samedi" && j !== "dimanche" && (
                    <button className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" onClick={() => supprJour(j)}>✕</button>
                  )}
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-emerald-800">
                    <input type="checkbox" checked={jours[j].actif} onChange={(e) => setJours((p) => ({ ...p, [j]: { ...p[j], actif: e.target.checked } }))} />
                    Actif
                  </label>
                </div>
              </div>
              {/* champs responsive : 2 colonnes sur mobile, 3 à partir de sm —
                  les champs heure d'iOS ont besoin d'une largeur suffisante,
                  sinon leur contenu déborde sur le champ voisin */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-emerald-600">Terrains</label>
                  <input type="number" min="1" max="16" className={inputCls} value={jours[j].terrains}
                    disabled={!jours[j].actif}
                    onChange={(e) => setJours((p) => ({ ...p, [j]: { ...p[j], terrains: e.target.value } }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-emerald-600">Début</label>
                  <input type="time" className={inputCls} value={jours[j].debut} disabled={!jours[j].actif}
                    onChange={(e) => setJours((p) => ({ ...p, [j]: { ...p[j], debut: e.target.value } }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-emerald-600">Fin</label>
                  <input type="time" className={inputCls} value={jours[j].fin} disabled={!jours[j].actif}
                    onChange={(e) => setJours((p) => ({ ...p, [j]: { ...p[j], fin: e.target.value } }))} />
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-emerald-600" title="vide = valeur commune (Paramètres communs)">Durée match (min)</label>
                  <input type="number" min="28" max="90" className={inputCls} placeholder={dureeMatch}
                    value={jours[j].dureeMatch !== undefined ? jours[j].dureeMatch : ""} disabled={!jours[j].actif}
                    onChange={(e) => setJours((p) => ({ ...p, [j]: { ...p[j], dureeMatch: e.target.value } }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-emerald-600" title="vide = valeur commune (Paramètres communs)">Marge aléas (min)</label>
                  <input type="number" min="0" max="20" className={inputCls} placeholder={marge}
                    value={jours[j].marge !== undefined ? jours[j].marge : ""} disabled={!jours[j].actif}
                    onChange={(e) => setJours((p) => ({ ...p, [j]: { ...p[j], marge: e.target.value } }))} />
                </div>
                <label className="col-span-2 flex cursor-pointer items-end gap-2 pb-2 text-xs text-emerald-800 sm:col-span-1" title="les demis et finales de ce jour sont programmées en fin de journée, sauf si un tableau attendrait plus de 2h30 après la fin de ses poules">
                  <input type="checkbox" className="w-auto" disabled={!jours[j].actif}
                    checked={!!jours[j].finalesFin}
                    onChange={(e) => setJours((p) => ({ ...p, [j]: { ...p[j], finalesFin: e.target.checked } }))} />
                  Demis et finales en fin de journée
                </label>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-emerald-600" title="aucun match n'est planifié pendant la pause ; vides = pas de pause">Pause Déjeuner/Remise médailles — de</label>
                  <input type="time" className={inputCls} placeholder="12:30"
                    value={jours[j].pauseDebut !== undefined ? jours[j].pauseDebut : ""} disabled={!jours[j].actif}
                    onChange={(e) => setJours((p) => ({ ...p, [j]: { ...p[j], pauseDebut: e.target.value } }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-emerald-600" title="heure de reprise estimée après la pause">à (reprise)</label>
                  <input type="time" className={inputCls} placeholder="13:30"
                    value={jours[j].pauseFin !== undefined ? jours[j].pauseFin : ""} disabled={!jours[j].actif}
                    onChange={(e) => setJours((p) => ({ ...p, [j]: { ...p[j], pauseFin: e.target.value } }))} />
                </div>
              </div>
              <Note label="Journée">
                <div className="mt-1 text-xs leading-tight text-emerald-400">Terrains : min 1 · max 16 (bornage appliqué au moment du calcul) · durée et marge laissées vides = valeurs communes · pause (Déjeuner/Remise médailles) vide = pas de pause (heure estimée usuelle : 12:30 → 13:30).</div>
              </Note>
            </div>
          ))}
        </div>
        <button className="mt-1 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
          disabled={Object.keys(jours).length >= 4} onClick={ajoutJour}>＋ Ajouter un jour</button>
        <p className="mt-1 text-xs text-emerald-600">
          « Demis et finales en fin de journée » est propre à chaque jour : les demis et finales des tableaux sont programmées
          en fin de journée pour enchaîner la remise des prix — mais si un tableau attendrait plus de 2h30 après la fin de
          ses propres poules, ses tours finals avancent dès que possible. Les tableaux démarrés tardivement ou aux tours
          naturellement tardifs restent tenus en fin de journée.
        </p>

        <div className={cardCls}>
          <h4 className="mb-2 font-semibold text-emerald-900">⚙️ Paramètres communs</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-emerald-600">Durée moyenne d'un match (min, minimum 28 — valeur commune)</label>
              <input type="number" min="28" max="90" className={inputCls} value={dureeMatch}
                onChange={(e) => setDureeMatch(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-emerald-600">Marge de sécurité par match (min, 0–20 — valeur commune)</label>
              <input type="number" min="0" max="20" className={inputCls} value={marge}
                onChange={(e) => setMarge(e.target.value)} />
            </div>
            <Note label="Repos et appel">
              <div className="flex items-end text-xs text-emerald-600">Repos minimum : {REPOS} min après la fin d'un match · Appel : {APPEL} min avant chaque match</div>
            </Note>
            <div>
              <label className="mb-1 block text-xs font-medium text-emerald-600">Thème d'affichage</label>
              <select className={inputCls} value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="classique">Classique (vert)</option>
                <option value="bad18">Bad18 (rouge et noir)</option>
                <option value="dark">Dark (sombre)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-emerald-600">Cadence des tours de poule (option « cadence par vagues »)</label>
              <select className={inputCls} value={cadence} onChange={(e) => setCadence(+e.target.value)}>
                <option value={0}>Souple (défaut) — entrelacement, priorité au joueur qui attend le plus</option>
                <option value={0.5}>Resserrée — battement régulier entre les tours d'une même poule</option>
                <option value={1}>Vagues strictes — le tour r d'un tableau démarre après la fin du tour r-1 (type BadNet)</option>
              </select>
            </div>
          </div>
          <Note label="Marge de sécurité">
          <p className="mt-2 text-xs text-emerald-600">
            La marge de sécurité est ajoutée à chaque match de l'échéancier théorique : si un match réel dépasse sa durée
            prévue (jusqu'à cette marge), les matchs suivants restent à l'heure et le repos réel ne descend jamais sous
            {" "}{REPOS} min. Au-delà, le respect du repos passe avant l'heure affichée : les matchs suivants sont décalés,
            jamais compressés, sauf accord du juge-arbitre ou des joueurs/paires.
          </p>
          </Note>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-emerald-800">
            <input type="checkbox" className="mt-0.5 w-auto" checked={combosTox} onChange={(e) => setCombosTox(e.target.checked)} />
            <span><b>Autoriser les combinaisons toxiques</b></span>
          </label>
          <Note label="Combinaisons toxiques">
            <p className="mt-1 text-xs text-emerald-600">
            Par défaut, un joueur/paire n'est pas inscrit sur deux familles le même jour (ex. simple <i>et</i> mixte) :
            aucun chevauchement possible. Cochez cette option seulement si le dimensionnement du tournoi permet de
            telles combinaisons : l'échéancier sérialise alors les familles dans chaque journée (simples, puis mixte,
            puis doubles), pour qu'un joueur/paire ne soit jamais attendu sur deux familles à la fois.
            </p>
          </Note>
          <Note label="Demis et finales en fin de journée">
          <p className="mt-3 text-xs text-emerald-600">
            <b>Demi-finales et finales en fin de journée</b> : cette option se règle désormais pour chaque jour
            (case à cocher dans la carte du jour ci-dessus).
          </p>
          </Note>
        </div>

        {/* Configurations enregistrées : sauver, recharger, exporter, importer */ }
        <div className={cardCls}>
          <h4 className="mb-2 font-semibold text-emerald-900">💾 Configurations enregistrées</h4>
          <Note label="Configurations enregistrées">
          <p className="mb-2 text-xs text-emerald-600">
            Sauvegardez une configuration de départ (jours, tableaux, durées, thème) pour y revenir ensuite.
            Un fichier JSON peut être exporté pour l'archiver ou la transférer, puis réimporté.
          </p>
          </Note>
          <div className="flex flex-wrap items-center gap-2">
            <input className={inputCls + " max-w-xs"} placeholder="Nom de la configuration" value={cfgName}
              onChange={(e) => setCfgName(e.target.value)} />
            <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700" onClick={() => saveCfg()}>Enregistrer</button>
            <button className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-50" onClick={exportCfg}>⬇ Exporter JSON</button>
            <label className="cursor-pointer rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-50">
              ⬆ Importer JSON
              <input type="file" accept="application/json,.json" className="hidden"
                onChange={(e) => { importCfg(e.target.files && e.target.files[0]); e.target.value = ""; }} />
            </label>
          </div>
          {Object.keys(configs).length > 0 && (
            <ul className="mt-3 space-y-1">
              {Object.keys(configs).sort((a, b) => (a === CFG_AUTO ? -1 : b === CFG_AUTO ? 1 : a.localeCompare(b))).map((nom) => (
                <li key={nom} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{nom}</span>
                  <span className="text-xs text-emerald-600">{configs[nom].tabs ? configs[nom].tabs.length : 0} tableau(x) · {configs[nom].jours ? Object.keys(configs[nom].jours).length : 0} jour(s)</span>
                  <button className="rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50" onClick={() => applyCfg(configs[nom])}>Charger</button>
                  <button className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" onClick={() => delCfg(nom)}>Supprimer</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Estimation de capacité par jour */}
        {(() => {
          const dureeJour = (j) => {
            const J = jours[j];
            return dureeCalc(
              J.dureeMatch !== undefined && J.dureeMatch !== "" ? J.dureeMatch : dureeMatch,
              J.marge !== undefined && J.marge !== "" ? J.marge : marge
            );
          };
          const capJour = (j) => {
            const J = jours[j];
            const terr = Math.max(1, Math.floor(+J.terrains) || 1);
            const pd = toMin(J.pauseDebut, null), pf = toMin(J.pauseFin, null);
            const pause = pd !== null && pf !== null && pf > pd ? pf - pd : 0;
            const minutes = toMin(J.fin, 18 * 60) - toMin(J.debut, 9 * 60) - pause;
            return Math.max(0, minutes) * terr / dureeJour(j);
          };
          const matchsTab = (t) => {
            const b = buildTab(t, 0);
            return b.poolMs.length + b.playedFinals.length;
          };
          const joursKeys = daySort(Object.keys(jours));
          const daysConf = joursKeys.filter((j) => jours[j].actif);
          const besoinFixe = {};
          let besoinDeux = 0, besoinTotal = 0;
          tabs.forEach((t) => {
            const n = matchsTab(t);
            besoinTotal += n;
            if (joursKeys.includes(t.jour)) besoinFixe[t.jour] = (besoinFixe[t.jour] || 0) + n;
            else besoinDeux += n;
          });
          const capTotal = joursKeys.reduce((s, j) => s + (jours[j].actif ? capJour(j) : 0), 0);
          // planification réelle avec les paramètres courants : capacité
          // réellement consommée et fin effective de chaque journée — le
          // repos de {REPOS} min, l'alternance et le déroulé par tours font
          // que la capacité réelle est plus faible que la capacité théorique
          const realPlan = computePlan(tabs, jours, dureeMatch, marge, combosTox, finalesFin, forfaitsSet, cadence);
          const realJour = {};
          joursKeys.forEach((j) => {
            const rms = realPlan.perDay[j] || [];
            const finReelle = rms.length ? Math.max(...rms.map((m) => m.time + (m.duree !== undefined ? m.duree : dureeJour(j)))) : null;
            realJour[j] = {
              nb: rms.length,
              // matchs venant de tableaux NON fixés à ce jour (« les deux
              // jours » ou tableau d'un jour inactif) : ils ne sont pas
              // dans le « besoin fixe » mais consomment la capacité du jour
              deux: rms.filter((m) => realPlan.built[m.tid].tab.jour !== j).length,
              margeReelle: finReelle === null ? null : toMin(jours[j].fin, 18 * 60) - finReelle,
            };
          });
          return (
            <div className={cardCls}>
              <h4 className="mb-2 font-semibold text-emerald-900">📊 Estimation de capacité (matchs jouables)</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-emerald-600">
                    <th className="py-1">Jour</th><th>Capacité</th><th title="besoin des tableaux affectés à CE jour uniquement — les tableaux « les deux jours » ne sont pas comptés ici (colonne suivante)">Besoin fixe</th><th>Les deux jours</th><th title="capacité − besoin fixe uniquement : les tableaux « les deux jours » n'y sont pas déduits — ne pas s'y fier pour savoir si la journée tient, voir « Marge réelle »">Marge</th><th title="matchs réellement planifiés avec les paramètres courants (repos et alternance inclus), y compris les matchs des tableaux « les deux jours » tombés sur ce jour">Planifié</th><th title="marge en minutes entre la fin réelle de la journée planifiée et l'horaire de fermeture — négatif = le dernier match finit après la fermeture (rien n'est supprimé)">Marge réelle</th>
                  </tr>
                </thead>
                <tbody>
                  {joursKeys.map((j) => {
                    const cap = Math.floor(capJour(j));
                    const besoin = besoinFixe[j] || 0;
                    const marge = jours[j].actif ? cap - besoin : 0;
                    return (
                      <tr key={j} className="border-b border-emerald-50">
                        <td className="py-1.5 font-medium capitalize">{j}{!jours[j].actif && " (inactif)"}</td>
                        <td className="font-mono">{jours[j].actif ? cap : "—"}</td>
                        <td className="font-mono">{besoin || "—"}</td>
                        <td className="font-mono text-emerald-600">{besoinDeux}</td>
                        <td className="font-mono font-semibold">
                          {jours[j].actif ?
                            <span style={{ display: "inline-block", borderRadius: "6px", padding: "1px 8px", whiteSpace: "nowrap", backgroundColor: marge < 0 ? "#fee2e2" : "#dcfce7", color: marge < 0 ? "#b91c1c" : "#065f46" }}>
                              {marge >= 0 ? "✓ +" + marge : "⚠ " + marge}
                            </span> : "—"}
                        </td>
                        <td className="font-mono" title={jours[j].actif && realJour[j].nb ? ("dont " + realJour[j].deux + " match(s) de tableaux « les deux jours » (non comptés dans le besoin fixe) + " + (realJour[j].nb - realJour[j].deux) + " de tableaux fixés au jour") : null}>{jours[j].actif ? <span>{realJour[j].nb}{realJour[j].deux > 0 && <span className="text-emerald-500"> ({realJour[j].deux} deux-jours)</span>}</span> : "—"}</td>
                        <td className="font-mono font-semibold">
                          {jours[j].actif && realJour[j].margeReelle !== null ?
                            <span style={{ display: "inline-block", borderRadius: "6px", padding: "1px 8px", whiteSpace: "nowrap", backgroundColor: realJour[j].margeReelle < 0 ? "#fee2e2" : "#dcfce7", color: realJour[j].margeReelle < 0 ? "#b91c1c" : "#065f46" }}>
                              {(realJour[j].margeReelle >= 0 ? "✓ +" + realJour[j].margeReelle : "⚠ " + realJour[j].margeReelle) + " min"}
                            </span> : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Note label="Lecture de l'estimation">
              <p className="mt-2 text-xs text-emerald-600">
                Capacité d'un jour = terrains × (horaire ouvert ÷ durée de match). Besoin total : <b>{besoinTotal}</b> matchs
                (poules + tableaux finaux), dont <b>{besoinDeux}</b> à répartir sur les deux jours, pour une capacité totale de
                {" "}<b>{Math.floor(capTotal)}</b> matchs. La colonne « Marge » est <b>théorique</b> : elle suppose les terrains
                occupés en continu et ne déduit que le besoin <b>fixe</b> du jour — les tableaux « les deux jours » n'y sont
                pas comptés, alors qu'ils se planifient en partie chaque jour (visible dans « Planifié », suffixe
                « deux-jours »). La colonne « Marge réelle » est calculée sur la planification effective (repos de {REPOS} min,
                appel, alternance des tours et pauses inclus) : c'est elle qui dit si la journée tient réellement —
                {" "}<b>une marge théorique positive ne garantit pas que tout se joue dans l'horaire</b>. Une marge réelle
                négative signifie que le dernier match finit après la fermeture (ex. −201 min = fermeture 17:00, dernier
                match 20:21) : <b>aucun match n'est supprimé</b>, le moteur planifie tout, même au-delà de l'horaire, et
                l'écran tournoi l'affiche aussi (⚠️ horaire de fin modifié).
                {realPlan.unscheduled.length > 0 && <span className="font-semibold text-red-700"> ⚠️ {realPlan.unscheduled.length} match(s) non planifiable(s) avec ces paramètres.</span>}
              </p>
              </Note>
              {(() => {
                const builtAll = tabs.map((t, k) => buildTab(t, k));
                const cuts = cutsDeuxJours(builtAll, jours, daysConf.length ? dureeJour(daysConf[0]) : dureeCalc(dureeMatch, marge));
                const lignes = builtAll.filter((b) => cuts[b.tid])
                  .map((b) => b.label + " : jour 2 à partir des " + cuts[b.tid].label.toLowerCase());
                if (!lignes.length) return null;
                return (
                  <Note label="Tableaux sur deux jours">
                  <p className="mt-1 text-xs text-emerald-700">
                    🔀 {lignes.join(" · ")} (décision automatique selon la capacité du jour 1).
                  </p>
                  </Note>
                );
              })()}
            </div>
          );
        })()}

        <h3 className="font-semibold text-emerald-900">📋 Tableaux (discipline × classement)</h3>
        <div className="space-y-3">
          {tabs.map((t, i) => {
            const b = buildTab(t, i);
            return (
              <div key={i} className={cardCls}>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-emerald-600">Discipline</label>
                    <select className={numCls + " w-24"} value={t.disc} onChange={(e) => majTab(i, "disc", e.target.value)}>
                      {DISCIPLINES.map((d) => <option key={d.key} value={d.key}>{d.key}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-emerald-600">Classement</label>
                    <input className={numCls + " w-32"} placeholder="ex : D9-P12" value={t.classement} onChange={(e) => majTab(i, "classement", e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-emerald-600">{b.unit}</label>
                    <input type="number" min="3" className={numCls} value={t.nb} onChange={(e) => majTab(i, "nb", e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-emerald-600">Format</label>
                    <select className={numCls + " w-44"} value={t.format || "poules"} onChange={(e) => majTab(i, "format", e.target.value === "poules" ? "" : e.target.value)}>
                      <option value="poules">Poules + élim. directe</option>
                      <option value="suisse-elim">Ronde suisse + élim. directe</option>
                      <option value="suisse">Ronde suisse seule</option>
                    </select>
                  </div>
                  {(t.format === "suisse" || t.format === "suisse-elim") && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-emerald-600">Rondes</label>
                      <input type="number" min="1" className={numCls + " w-16"} placeholder="auto"
                        title="vide = automatique : ⌈log₂(inscrits)⌉, minimum 3 ; plafonné au maximum sans rejouer le même adversaire"
                        value={t.rondes === undefined ? "" : t.rondes} onChange={(e) => majTab(i, "rondes", e.target.value)} />
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-emerald-600">
                      {t.format === "suisse-elim" ? "Qualifiés élim." : "Sortants / poule"}
                    </label>
                    <input type="number" min={t.format === "suisse-elim" ? "2" : "1"} className={numCls}
                      disabled={t.format === "suisse"}
                      title={t.format === "suisse-elim" ? "les Q premiers de la ronde suisse vont en élimination directe" : t.format === "suisse" ? "sans objet : classement final aux victoires" : ""}
                      value={t.qualifs} onChange={(e) => majTab(i, "qualifs", e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-emerald-600">Jour(s)</label>
                    <select className={numCls + " w-28"} value={t.jour} onChange={(e) => majTab(i, "jour", e.target.value)}>
                      {daySort(Object.keys(jours)).map((jk) => (
                        <option key={jk} value={jk}>{jk.charAt(0).toUpperCase() + jk.slice(1)}</option>
                      ))}
                      <option value="les-deux">Les deux</option>
                    </select>
                  </div>
                  <button className="ml-auto rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50" onClick={() => supprTab(i)}>✕ Retirer</button>
                </div>
                <p className="mt-2 text-xs text-emerald-600">
                  <b>{b.label}</b> — {b.suisse && <span>ronde suisse : {b.rondes} ronde{b.rondes > 1 ? "s" : ""} × {b.parRonde} match{b.parRonde > 1 ? "s" : ""}
                  {" "}({b.n % 2 === 1 ? "1 exempt par ronde · " : ""}{b.poolMs.length} matchs au total)
                  {b.seule
                    ? " — classement final aux victoires puis départages"
                    : " — " + b.Q + " qualifié(s) → élimination directe (" + b.playedFinals.length + " matchs de tableau final" + exemptsTxt(b) + ")"}</span>}
                  {!b.suisse && b.P === 0 && <span>élimination directe : {b.n} {b.unit} ({b.playedFinals.length} matchs{exemptsTxt(b)})</span>}
                  {!b.suisse && b.P === 1 && <span>poule unique de {b.n} {b.unit} — {b.poolMs.length} matchs, classement final de
                  la poule : pas de sortants ni de suite en élimination directe (le champ « Sortants / poule » ne
                  s'applique pas).</span>}
                  {!b.suisse && b.P > 1 && <span>{b.P} poule(s) : {b.sizes.join(" + ")} {b.unit} ({b.poolMs.length} matchs de poule),
                  {" "}{b.Q} sortant(s)/poule → {b.P * b.Q} qualifiés, {b.playedFinals.length} matchs de tableau final{exemptsTxt(b)}
                  (dont finale : {roundName(1).toLowerCase()} à {roundName(b.roundsCount[0] || 1).toLowerCase()}).</span>}
                  {t.jour !== "les-deux" && jours[t.jour] && !jours[t.jour].actif && " ⚠️ " + t.jour + " inactif"}
                  {t.jour === "les-deux" && (() => {
                    const builtAll = tabs.map((t2, k) => buildTab(t2, k));
                    const d1 = joursActifs.length ? dureeCalc(
                      (jours[joursActifs[0]].dureeMatch !== undefined && jours[joursActifs[0]].dureeMatch !== "") ? jours[joursActifs[0]].dureeMatch : dureeMatch,
                      (jours[joursActifs[0]].marge !== undefined && jours[joursActifs[0]].marge !== "") ? jours[joursActifs[0]].marge : marge
                    ) : dureeCalc(dureeMatch, marge);
                    const cuts = cutsDeuxJours(builtAll, jours, d1);
                    return cuts[i] ? " · jour 2 : à partir des " + cuts[i].label.toLowerCase() : "";
                  })()}
                </p>
              </div>
            );
          })}
        </div>
        <button className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50" onClick={ajoutTab}>＋ Ajouter un tableau</button>

        <button className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white shadow hover:bg-emerald-700" onClick={() => { saveCfg(CFG_AUTO); setPhase("tournoi"); setVueTab("synthese"); }}>
          Générer l'échéancier 🏸
        </button>
      </div>
    );
  }

  /* ---------- écran échéancier ---------- */
  const jourKeys = ["synthese", "planning", "classement"].concat(plan.built.map((b) => "t" + b.tid));
  const jourLabels = { synthese: "📊 Synthèse", planning: "🗓️ Planning", classement: "🏷️ Par classement" };
  /* durée effective d'un match : celle du jour de sa planification (le
     jour peut surcharger durée/marge), sinon la valeur commune */
  const mduree = (m) => (m.duree !== undefined ? m.duree : dureeCalc(dureeMatch, marge));
  const pauseJour = (day) => {
    const pd = toMin(jours[day].pauseDebut, null), pf = toMin(jours[day].pauseFin, null);
    return pd !== null && pf !== null && pf > pd ? fmtTime(pd) + " → " + fmtTime(pf) : null;
  };
  const forfJour = (day) => plan.forfaits.filter((m) => m.day === day).length;
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
      term: ms.filter((m) => finis[m.key]).length,
      wo: forfJour(day),
    };
  });
  const total = plan.sched.length;
  const att60 = plan.sched.filter((m) => m.att !== null && m.att >= 60).length;
  const attMaxAll = plan.sched.filter((m) => m.att !== null).reduce((s, m) => Math.max(s, m.att), 0);
  /* export CSV de l'échéancier complet (toutes les journées) */
  const exportCsv = () => {
    const rows = [["Jour", "Appel", "Debut", "Terrain", "N°", "Tableau", "Tour", "Rencontre", "Attente"]];
    plan.days.forEach((day) => {
      (plan.perDay[day] || []).slice().sort((a, b) => a.time - b.time || a.court - b.court).forEach((m) => {
        rows.push([
          day, fmtTime(m.appel), fmtTime(m.time), "T" + (m.court + 1), m.num,
          plan.built[m.tid].label, tourLabel(m, plan.built[m.tid]),
          m.phase === "poule" ? m.a + " vs " + m.b : vlbl(plan, m, m.a) + " vs " + vlbl(plan, m, m.b),
          m.att === null || m.att === undefined ? "" : attFmt(m.att),
        ]);
      });
    });
    const csv = "\ufeff" + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "echancier-badminton.csv";
    // Safari/iOS : l'ancre doit être dans le document pour que le
    // téléchargement programme se déclenche
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div className={"mx-auto max-w-6xl space-y-4 p-4" + (theme === "bad18" ? " theme-bad18" : theme === "dark" ? " theme-dark" : "")}>
      <style>{THEME_BAD18_CSS}</style>
      <style>{THEME_DARK_CSS}</style>
      <style>{ATT_CSS}</style>
      <style>{NOTE_CSS}</style>
      <style>{PRINT_CSS}</style>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-emerald-900">🏸 Échéancier du week-end</h1>
        <div className="no-print flex flex-wrap items-center gap-2">
          <button className={"rounded-lg px-3 py-1.5 text-sm font-medium " + (live ? "bg-red-600 text-white" : "border border-red-200 text-red-700 hover:bg-red-50")}
            title="cochez les matchs terminés et signalez les W.O. — la journée se replanifie automatiquement"
            onClick={() => setLive((v) => !v)}>{live ? "⏺️ Direct actif" : "⏺️ Suivi en direct"}</button>
          <button className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-50" onClick={exportCsv}>⬇ Export CSV</button>
          <button className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-50" title="imprime la vue courante ou enregistrez-la en PDF" onClick={() => window.print()}>🖨️ PDF / Imprimer</button>
          <button className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-50" onClick={() => setPhase("config")}>⚙️ Modifier la configuration</button>
          <button className={showStats ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white" : "rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-50"} title="afficher/masquer le tableau de bord statistique du tournoi : inscrits, paires, matchs, durées, attentes, occupation des terrains" onClick={() => setShowStats((v) => !v)}>📊 Statistiques</button>
        </div>
      </header>
      {live && (
        <div className="no-print rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          ⏺️ <b>Suivi en direct</b> — cochez ✓ un match terminé dans le planning ; <b>W.O.</b> signale un forfait :
          le match ne consomme pas de terrain et la journée est replanifiée automatiquement.
        </div>
      )}
      {plan.forfaits.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <b>W.O. enregistrés :</b>{" "}
          {plan.forfaits.map((m, i) => (
            <span key={m.key} className="mr-2 inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-xs">
              {plan.built[m.tid].label} · {tourLabel(m, plan.built[m.tid])}
              <button className="no-print font-bold text-red-600" title="annuler le W.O." onClick={() => setWf((p) => ({ ...p, [m.key]: false }))}>✕</button>
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statsJour.map((s) => (
          <div key={s.day} className="rounded-xl border border-emerald-100 bg-white p-3 text-center shadow-sm">
            <div className="text-lg font-bold capitalize text-emerald-900">{s.nb ? fmtTime(s.derniereFin) : "—"}</div>
            <div className="text-xs text-emerald-600 capitalize">{s.day} — {s.nb} matchs ({fmtTime(s.debut)} → {fmtTime(s.fin)})</div>
            <div className="mt-1 text-[11px] text-emerald-500">attente max {s.attMax} min · moy {s.attMoy} min{s.att60 > 0 ? " · ⚠️ " + s.att60 + " ≥ 1h" : ""}</div>
            <div className="text-[11px] text-emerald-400">
              {pauseJour(s.day) && <span>🍽️ Pause Déjeuner/Remise médailles : {pauseJour(s.day)}</span>}
              {live && <span className="ml-1">· ✔ {s.term}/{s.nb} terminés{s.wo > 0 ? " · " + s.wo + " W.O." : ""}</span>}
              {!live && s.wo > 0 && <span className="ml-1">· {s.wo} W.O.</span>}
            </div>
          </div>
        ))}
        <div className="rounded-xl border border-emerald-100 bg-white p-3 text-center shadow-sm">
          <div className="text-lg font-bold text-emerald-900">{total}</div>
          <div className="text-xs text-emerald-600">matchs planifiés au total</div>
          {plan.forfaits.length > 0 && <div className="text-[11px] text-amber-600">+ {plan.forfaits.length} W.O. non joués</div>}
        </div>
      </div>

      {showStats && (() => {
        const st = statsSummary(plan, jours, dureeMatch, marge);
        return (
          <div className={cardCls}>
            <h3 className="mb-3 font-semibold text-emerald-900">📊 Tableau de bord statistique</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
                <div className="text-lg font-bold text-emerald-900">{st.inscrits.joueursH} H · {st.inscrits.joueusesF} F</div>
                <div className="text-xs text-emerald-600">joueurs estimés (engagements)</div>
                <div className="text-[11px] text-emerald-500">+ {st.inscrits.intergenre} intergenre · {st.inscrits.engagements} engagements</div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
                <div className="text-lg font-bold text-emerald-900">{st.inscrits.paires}</div>
                <div className="text-xs text-emerald-600">paires estimées</div>
                <div className="text-[11px] text-emerald-500">{st.inscrits.pairesM} H · {st.inscrits.pairesF} F · {st.inscrits.pairesX} mixtes · {st.inscrits.pairesI} intergenre</div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
                <div className="text-lg font-bold text-emerald-900">{st.total}</div>
                <div className="text-xs text-emerald-600">matchs planifiés</div>
                <div className="text-[11px] text-emerald-500">{st.tableaux.total} tableaux · {st.tableaux.formats.poules} poules · {st.tableaux.formats.uniques} uniques · {st.tableaux.formats.direct} directs · {st.tableaux.formats.suisse} suisses</div>
                <div className="text-[11px] text-emerald-500">{st.tableaux.exempts} exempts{st.tableaux.wo > 0 ? " · " + st.tableaux.wo + " W.O." : ""}{st.tableaux.nonPlanifies > 0 ? " · ⚠️ " + st.tableaux.nonPlanifies + " non planifiés" : ""}</div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
                <div className="text-lg font-bold text-emerald-900">{st.jeu.moyenneParEngagement} min</div>
                <div className="text-xs text-emerald-600">durée moyenne de jeu par engagement</div>
                <div className="text-[11px] text-emerald-500">{st.jeu.totalH} h de jeu au total · {st.jeu.matchsParEngagement} matchs/engagement</div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-100 p-3">
                <div className="mb-2 text-sm font-semibold text-emerald-900">⏱️ Attentes (matchs)</div>
                <div className="text-xs text-emerald-700">moyenne {attFmt(st.attentes.moy)} · maximum {attFmt(st.attentes.max)} · {st.attentes.sup60} ≥ 1h</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {st.attentes.paliers.map((p, i) => (
                    <span key={p.lbl} className={(ATT_STEPS[i] || {}).cls + " rounded px-1.5 py-0.5 text-[10px] font-semibold"}>{p.lbl} : {p.n}</span>
                  ))}
                </div>
                <Note label="Vue joueurs/paires">
                <div className="mt-1 text-[11px] text-emerald-500">
                  vue joueurs/paires (repos {REPOS} min inclus) : moyenne {attFmt(st.attentesJoueurs.moy)} · max {attFmt(st.attentesJoueurs.max)} · {st.attentesJoueurs.sup60} ≥ 1h
                </div>
                </Note>
              </div>
              <div className="rounded-xl border border-emerald-100 p-3">
                <div className="mb-2 text-sm font-semibold text-emerald-900">🏸 Matchs par discipline</div>
                <div className="flex flex-wrap gap-1 text-xs">
                  {Object.keys(st.byDisc).sort().map((d) => (
                    <span key={d} className="rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">{d} : {st.byDisc[d]}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-emerald-100 text-emerald-600">
                    <th className="py-1 pr-2">Jour</th><th className="py-1 pr-2">Matchs</th><th className="py-1 pr-2">Poules</th><th className="py-1 pr-2">Finales</th>
                    <th className="py-1 pr-2">Créneau</th><th className="py-1 pr-2">Jeu</th><th className="py-1 pr-2">Occupation</th>
                    <th className="py-1 pr-2">Marge fin</th><th className="py-1 pr-2">Attente moy</th><th className="py-1 pr-2">Attente max</th><th className="py-1 pr-2">≥ 1h</th>
                  </tr>
                </thead>
                <tbody>
                  {st.jours.map((j) => (
                    <tr key={j.day} className="border-b border-emerald-50">
                      <td className="py-1 pr-2 font-medium capitalize text-emerald-900">{j.day}</td>
                      <td className="py-1 pr-2">{j.nb}</td>
                      <td className="py-1 pr-2">{j.poules}</td>
                      <td className="py-1 pr-2">{j.finales}</td>
                      <td className="py-1 pr-2">{j.debut} → {j.fin}</td>
                      <td className="py-1 pr-2">{j.jeuH} h</td>
                      <td className="py-1 pr-2">{j.occupation} % ({j.terrains} terrains)</td>
                      <td className={"py-1 pr-2 " + (j.margeReelle !== null && j.margeReelle < 0 ? "font-semibold text-red-600" : "")}>{j.margeReelle !== null ? (j.margeReelle >= 0 ? "+" : "") + j.margeReelle + " min" : "—"}</td>
                      <td className="py-1 pr-2">{j.nb ? attFmt(j.attMoy) : "—"}</td>
                      <td className="py-1 pr-2">{j.nb ? attFmt(j.attMax) : "—"}</td>
                      <td className="py-1 pr-2">{j.att60 > 0 ? "⚠️ " + j.att60 : "✅"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Note label="Effectifs estimés">
            <div className="mt-2 text-[11px] text-emerald-500">
              Effectifs estimés à partir des engagements par tableau (joueurs anonymes : un même joueur engagé dans plusieurs tableaux est compté plusieurs fois).
              Les inscriptions réelles seront intégrées avec l'import des noms (suite E).
            </div>
            </Note>
          </div>
        );
      })()}

      {statsJour.filter((s) => s.depasse).map((s) => (
        <div key={s.day} className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ⚠️ {s.day} : l'horaire de fin a dû être modifié — tous les matchs sont planifiés, le dernier finissant
          à {fmtTime(s.derniereFin)} au lieu de {fmtTime(s.fin)} (+{-s.marge} min).
          Aucun match n'a été supprimé : ajoutez un terrain, élargissez l'horaire ou basculez des tableaux sur l'autre jour.
        </div>
      ))}
      {plan.unscheduled.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ⚠️ {plan.unscheduled.length} match(s) non planifiés (plus de créneau disponible sur le(s) jour(s) autorisé(s)) :
          {" "}{[...new Set(plan.unscheduled.map((m) => plan.built[m.tid].label))].join(", ")}.
        </div>
      )}
      {statsJour.every((s) => !s.depasse) && plan.unscheduled.length === 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          ✅ Tous les matchs tiennent dans les horaires de chaque jour, avec {REPOS} min de repos respecté.
        </div>
      )}
      {att60 > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          ⏱️ {att60} match(s) avec une attente estimée ≥ 1h (maximum {attFmt(attMaxAll)}). L'ordonnancement
          sert déjà en priorité les joueurs/paires les plus attendus ; pour réduire ces attentes :
          ajouter un terrain, élargir l'horaire, ou répartir les tableaux sur les deux jours.
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          ✅ Aucune attente estimée ne dépasse 1h — enchaînements optimisés.
        </div>
      )}

      <div className="no-print flex flex-wrap gap-1 rounded-xl border border-emerald-100 bg-white p-1 shadow-sm">
        {jourKeys.map((k) => (
          <button key={k} onClick={() => setVueTab(k)}
            className={"rounded-lg px-3 py-2 text-sm font-medium " + (vueTab === k ? "bg-emerald-600 text-white" : "text-emerald-800 hover:bg-emerald-50")}>
            {jourLabels[k] || ((plan.built[+k.slice(1)] || {}).label || "Tableau")}
          </button>
        ))}
      </div>

      {/* légende du code couleur des attentes */}
      <Note label="Légende des attentes">
      <div className="rounded-xl border border-emerald-100 bg-white p-3 text-xs text-emerald-700 shadow-sm">
        <b>⏱ ATTENTE depuis le tour précédent</b> — attente totale depuis la fin du match précédent du joueur ou de la paire le plus
        attendu du match, repos de {REPOS} min inclus :
        {ATT_STEPS.map((s) => (
          <span key={s.lbl} className={"mx-1 inline-block rounded px-1.5 py-0.5 font-semibold " + s.cls}>{s.lbl}</span>
        ))}
        — plus c'est vert, plus le joueur/la paire enchaîne vite après son tour précédent ; orange à rouge = longue attente.
        Objectif : toutes les attentes &lt; 1h. Colonne ATTENTE : « — » = premier tour du joueur/de la paire
        (attente non applicable), badge « ≈ » = délai depuis la fin de la phase précédente du tableau (premier
        tour d'élimination directe issu des poules/rondes suisses). Colonne N° : numéro du match, de 1 à la fin du
        tournoi, identique dans toutes les vues et l'export CSV. Le tour du match est indiqué dans la colonne TOUR.
        Les horaires sont
        donnés à titre indicatif : en cas de dépassement réel,
        le repos de {REPOS} min passe avant l'heure affichée — les matchs suivants sont décalés, jamais compressés,
        sauf accord du juge-arbitre ou des joueurs/paires.
      </div>
      </Note>

      {vueTab === "synthese" && (() => {
        return (
          <div className="space-y-5">
            <div className={cardCls}>
              <h3 className="mb-3 font-semibold text-emerald-900">📋 Structure des tableaux — vue d'ensemble</h3>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-emerald-600">
                    <th className="py-1">Tableau</th><th>Inscrits</th><th>Poules</th><th>Sortants</th><th>Parcours</th><th>Matchs</th><th>Horaire</th><th>Fin estimée</th><th>Attente max</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.built.map((b) => {
                    const ms = plan.sched.filter((m) => m.tid === b.tid);
                    const nbForf = plan.forfaits.filter((m) => m.tid === b.tid).length;
                    const totalM = b.poolMs.length + b.playedFinals.length;
                    if (!ms.length) return (
                      <tr key={b.tid} className="border-b border-emerald-50">
                        <td className="py-1.5"><span className={"rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap " + (DISC_COLORS[b.tab.disc] || "")}>{b.label}</span></td>
                        <td className="font-mono">{b.n}</td>
                        <td colSpan={7} className="text-xs text-red-600">aucun match planifié (jour inactif ?) — {totalM - nbForf} matchs en attente{nbForf > 0 ? " · " + nbForf + " W.O." : ""}</td>
                      </tr>
                    );
                    const st = attStats(ms);
                    const prem = Math.min(...ms.map((m) => m.appel));
                    const dern = Math.max(...ms.map((m) => m.time + mduree(m)));
                    const joursAbbr = [...new Set(ms.map((m) => m.day))].map((d) => d.slice(0, 3) + ".").join(" + ");
                    // fin estimée du tableau : jour et heure du dernier match,
                    // comparés à l'horaire officiel de ce jour
                    const dernM = ms.reduce((acc, m) => (m.time + mduree(m) > acc.end ? { day: m.day, end: m.time + mduree(m) } : acc), { day: ms[ms.length - 1].day, end: -1e9 });
                    const finOff = toMin(jours[dernM.day].fin, 18 * 60);
                    const dep = dernM.end > finOff ? Math.round(dernM.end - finOff) : 0;
                    return (
                      <tr key={b.tid} className="border-b border-emerald-50">
                        <td className="py-1.5"><span className={"rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap " + (DISC_COLORS[b.tab.disc] || "")}>{b.label}</span></td>
                        <td className="font-mono">{b.n}</td>
                        <td className="text-xs">{b.suisse
                          ? <span className="text-emerald-600">ronde suisse ({b.rondes})</span>
                          : b.P === 0 ? <span className="text-emerald-600">élimination directe</span> : <span>{b.sizes.join(" + ")} <span className="text-emerald-500">({b.P})</span></span>}</td>
                        <td className="text-xs">{b.suisse
                          ? (b.seule ? "classement final" : b.Q + " qualifiés")
                          : b.P === 0 ? "—" : b.P === 1 ? "poule unique" : b.Q + "/poule → " + b.P * b.Q + " qual."}</td>
                        <td className="text-xs text-emerald-700">{parcoursStr(b, plan.cuts[b.tid])}</td>
                        <td className="font-mono">{ms.length}{nbForf > 0 && <span className="ml-1 text-xs font-normal text-amber-600">· {nbForf} W.O.</span>}{ms.length + nbForf < totalM && <span className="ml-1 text-xs font-normal text-red-600">(+{totalM - ms.length - nbForf} non planifiés)</span>}</td>
                        <td className="text-xs font-mono">{joursAbbr} · {fmtTime(prem)} → {fmtTime(dern)}</td>
                        <td className="text-xs font-mono">
                          <span className="capitalize">{dernM.day}</span> {fmtTime(dernM.end)}
                          {dep > 0 && <span className="ml-1 font-semibold" style={{ display: "inline-block", borderRadius: "6px", padding: "1px 8px", whiteSpace: "nowrap", backgroundColor: "#fee2e2", color: "#b91c1c" }} title="fin estimée au-delà de l'horaire officiel du jour">⚠️ +{dep} min</span>}
                        </td>
                        <td><AttBadge att={st.max} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              <Note label="Parcours">
              <p className="mt-2 text-xs text-emerald-600">
                Parcours : « (J2) » marque le tour où le tableau reprend le dimanche. Les poules sont composées automatiquement
                pour minimiser les matchs ; au-delà de 24 inscrits, élimination directe. Alternative par tableau : la ronde
                suisse (personne n'est éliminé, chaque inscrit joue une fois par ronde, classement final aux victoires).
              </p>
              </Note>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {statsJour.map((s) => (
                <div key={s.day} className={cardCls}>
                  <h4 className="font-semibold capitalize text-emerald-900">{s.day}</h4>
                  <p className="text-sm text-emerald-700">
                    {s.nb} matchs · {fmtTime(s.debut)} → {s.nb ? fmtTime(s.derniereFin) : "—"}
                    {s.depasse && <span className="font-semibold" style={{ display: "inline-block", borderRadius: "6px", padding: "1px 8px", whiteSpace: "nowrap", backgroundColor: "#fee2e2", color: "#b91c1c" }}> ⚠️ horaire de fin modifié : +{-s.marge} min</span>}
                  </p>
                  <p className="text-xs text-emerald-500">attente max {s.attMax} min · moyenne {s.attMoy} min</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {vueTab === "planning" && (
        <div className="space-y-5">
          {plan.days.map((day) => {
            const ms = (plan.perDay[day] || []).slice().sort((a, b) => a.time - b.time || a.court - b.court);
            const woDay = forfJour(day);
            if (!ms.length && !woDay) return null;
            // pause Déjeuner/Remise médailles du jour : bandeau inséré à sa
            // place chronologique dans le planning — aucun match n'étant
            // planifié pendant la pause, il apparaît juste avant le premier
            // match de la reprise
            const pd = toMin(jours[day].pauseDebut, null), pf = toMin(jours[day].pauseFin, null);
            const hasPause = pd !== null && pf !== null && pf > pd;
            let pausePending = hasPause;
            const pauseRow = () => (
              <tr key="pause" className="border-b border-amber-100 bg-amber-50">
                <td colSpan={live ? 9 : 8} className="py-1.5 text-center text-xs font-semibold text-amber-800">
                  🍽️ Pause Déjeuner/Remise médailles · {fmtTime(pd)} → {fmtTime(pf)} — aucun match pendant la pause
                </td>
              </tr>
            );
            const rows = [];
            ms.forEach((m) => {
              if (pausePending && m.time >= pf) { pausePending = false; rows.push(pauseRow()); }
              rows.push(
                <tr key={m.key} className={"border-b border-emerald-50" + (finis[m.key] ? " opacity-50" : "")}>
                  <td className="py-1.5 font-mono text-amber-700">{finis[m.key] ? <s>{fmtTime(m.appel)}</s> : fmtTime(m.appel)}</td>
                  <td className="font-mono">{finis[m.key] ? <s>{fmtTime(m.time)}</s> : fmtTime(m.time)}</td>
                  <td><span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">T{m.court + 1}</span></td>
                  <td className="font-mono text-xs font-semibold text-emerald-700">{m.num}</td>
                  <td><span className={"rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap " + (DISC_COLORS[plan.built[m.tid].tab.disc] || "")}>{plan.built[m.tid].label}</span></td>
                  <td className="text-xs text-emerald-600">{tourLabel(m, plan.built[m.tid])}</td>
                  <td>
                    {m.phase === "poule"
                      ? <span>{m.a} <span className="text-emerald-400">vs</span> {m.b}</span>
                      : <span className="text-emerald-700">{vlbl(plan, m, m.a)} <span className="text-emerald-400">contre</span> {vlbl(plan, m, m.b)}</span>}
                  </td>
                  <td><AttBadge att={m.att} phase={m.attPhase} /></td>
                  {live && (
                    <td className="no-print">
                      <button className={"mr-1 rounded px-2 py-0.5 text-xs font-bold " + (finis[m.key] ? "bg-emerald-600 text-white" : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50")}
                        title="marquer le match comme terminé" onClick={() => setFinis((p) => ({ ...p, [m.key]: !p[m.key] }))}>✓</button>
                      <button className="rounded border border-red-200 px-2 py-0.5 text-xs font-bold text-red-700 hover:bg-red-50"
                        title="forfait (walk-over) : le match ne se joue pas, le créneau est libéré et la journée se replanifie"
                        onClick={() => setWf((p) => ({ ...p, [m.key]: true }))}>W.O.</button>
                    </td>
                  )}
                </tr>
              );
            });
            if (pausePending) rows.push(pauseRow());
            return (
              <div key={day} className={cardCls}>
                <h3 className="mb-3 font-semibold capitalize text-emerald-900">📅 {day} — {ms.length} matchs{woDay > 0 ? " · " + woDay + " W.O." : ""}{live ? " · ✔ " + ms.filter((m) => finis[m.key]).length + "/" + ms.length + " terminés" : ""}</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-emerald-600">
                      <th className="py-1">Appel</th><th>Début</th><th>Terrain</th><th title="numéro du match : commence à 1 et s'incrémente jusqu'à la fin du tournoi (même index dans toutes les vues et l'export)">N°</th><th>Tableau</th><th title="numéro de tour en poules (ex. Tour 1) ou niveau en élimination directe (ex. 1/4 Finale)">Tour</th><th>Rencontre</th><th title="attente totale depuis la fin du match précédent, repos inclus, pour le joueur ou la paire concernée">Attente</th>
                      {live && <th className="no-print">Direct</th>}
                    </tr>
                  </thead>
                  <tbody>{rows}</tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {vueTab === "classement" && (() => {
        return (
          <div className="space-y-5">
            <Note label="Vue par classement">
            <p className="text-xs text-emerald-600">
              Matchs regroupés par classement (discipline × classement), dans l'ordre chronologique.
              Le terrain de chaque match reste indiqué, mais la répartition par terrain n'a pas de sens
              organisationnel : elle dépend de la durée réelle des matchs.
            </p>
            </Note>
            {plan.built.map((b) => {
              // tous les matchs du samedi d'abord, puis ceux du dimanche (v1.7.1)
              const ms = plan.sched.filter((m) => m.tid === b.tid).sort(ordMatches(plan));
              if (!ms.length) return null;
              const st = attStats(ms);
              const stAll = attStatsAll(ms);
              const prem = Math.min(...ms.map((m) => m.appel));
              const dern = Math.max(...ms.map((m) => m.time + mduree(m)));
              return (
                <div key={b.tid} className={cardCls}>
                  <div className={"mb-2 flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 " + (stAll.n ? attStep(stAll.max).cls : "bg-slate-100 text-slate-600")}
                    title="fond coloré selon le code couleur des attentes : attente maximale du tableau (attentes individuelles et délais ≈ de transition de phase)">
                    <span className={"rounded px-2 py-0.5 text-sm font-semibold whitespace-nowrap " + (DISC_COLORS[b.tab.disc] || "")}>{b.label}</span>
                    <span className="text-xs font-normal">
                      {ms.length} matchs · appel {fmtTime(prem)} → fin {fmtTime(dern)} · attente max {stAll.n ? attFmt(stAll.max) : "—"} · moy {stAll.n ? attFmt(stAll.moy) : "—"}
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-emerald-600">
                        <th className="py-1">Jour</th><th>Appel</th><th>Début</th><th>Terrain</th><th title="numéro du match : commence à 1 et s'incrémente jusqu'à la fin du tournoi (même index dans toutes les vues et l'export)">N°</th><th title="numéro de tour en poules (ex. Tour 1) ou niveau en élimination directe (ex. 1/4 Finale)">Tour</th><th>Rencontre</th><th title="attente totale depuis la fin du match précédent, repos inclus, pour le joueur ou la paire concernée">Attente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ms.map((m, i) => (
                        <tr key={i} className="border-b border-emerald-50">
                          <td className="py-1.5 text-xs font-semibold capitalize text-emerald-700">{m.day}</td>
                          <td className="font-mono text-amber-700">{fmtTime(m.appel)}</td>
                          <td className="font-mono">{fmtTime(m.time)}</td>
                          <td><span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">T{m.court + 1}</span></td>
                          <td className="font-mono text-xs font-semibold text-emerald-700">{m.num}</td>
                          <td className="text-xs text-emerald-600">{tourLabel(m, b)}</td>
                          <td>{m.phase === "poule"
                            ? <span>{m.a} <span className="text-emerald-400">vs</span> {m.b}</span>
                            : <span className="text-emerald-700">{vlbl(plan, m, m.a)} <span className="text-emerald-400">contre</span> {vlbl(plan, m, m.b)}</span>}</td>
                          <td><AttBadge att={m.att} phase={m.attPhase} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/^t[0-9]+$/.test(vueTab) && (() => {
        const b = plan.built[+vueTab.slice(1)];
        if (!b) return null;
        // tous les matchs du samedi d'abord, puis ceux du dimanche (v1.7.1)
        const ms = plan.sched.filter((m) => m.tid === b.tid).sort(ordMatches(plan));
        const nbForf = plan.forfaits.filter((m) => m.tid === b.tid).length;
        const stAll = attStatsAll(ms);
        return (
          <div className="space-y-4">
            <div className={cardCls}>
              <div className={"mb-2 rounded-lg px-2 py-1.5 font-semibold " + (stAll.n ? attStep(stAll.max).cls : "text-emerald-900")}
                title="fond coloré selon le code couleur des attentes : attente maximale du tableau (attentes individuelles et délais ≈ de transition de phase)">{b.label} — {b.n} {b.unit}, {b.suisse
                ? b.rondes + " ronde" + (b.rondes > 1 ? "s" : "") + " suisse" + (b.rondes > 1 ? "s" : "")
                  + (b.seule ? " — classement final aux victoires" : " — " + b.Q + " qualifié(s) → élimination directe")
                : b.P === 0 ? "élimination directe" : b.P === 1 ? "poule unique — classement final de la poule, sans suite en élimination directe" : b.P + " poule(s), " + b.Q + " sortant(s)/poule"}{exemptsTxt(b)}, {ms.length} matchs planifiés{nbForf > 0 ? " · " + nbForf + " W.O." : ""}
                {plan.cuts[b.tid] && <span className="ml-2 text-xs font-normal text-emerald-600">· jour 2 : à partir des {plan.cuts[b.tid].label.toLowerCase()}</span>} · attente max {stAll.n ? attFmt(stAll.max) : "—"}</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {b.suisse && (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2 text-xs sm:col-span-2">
                    <b className="text-emerald-800">{b.n} {b.unit} — ronde suisse</b>
                    <div className="text-emerald-700">{b.rondes} ronde{b.rondes > 1 ? "s" : ""} × {b.parRonde} match{b.parRonde > 1 ? "s" : ""}</div>
                    {b.exempts.length > 0 && (
                      <div className="text-emerald-700" title="un exempt ne joue pas cette ronde : il est réintégré à la ronde suivante">
                        <b>Exempts :</b> {b.exempts.map((e) => "Ronde " + (e.r + 1) + " → " + b.nom(e.j)).join(" · ")}
                      </div>
                    )}
                  </div>
                )}
                {b.pools.map((ids, pi) => (
                  <div key={pi} className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2 text-xs">
                    <b className="text-emerald-800">Poule {pi + 1}</b>
                    <div className="text-emerald-700">{ids.map((i) => b.nom(i)).join(", ")}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className={cardCls}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-emerald-600">
                    <th className="py-1">Jour</th><th>Appel</th><th>Début</th><th>Terrain</th><th title="numéro du match : commence à 1 et s'incrémente jusqu'à la fin du tournoi (même index dans toutes les vues et l'export)">N°</th><th title="numéro de tour en poules (ex. Tour 1) ou niveau en élimination directe (ex. 1/4 Finale)">Tour</th><th>Rencontre</th><th title="attente totale depuis la fin du match précédent, repos inclus, pour le joueur ou la paire concernée">Attente</th>
                  </tr>
                </thead>
                <tbody>
                  {ms.map((m, i) => (
                    <tr key={i} className="border-b border-emerald-50">
                      <td className="py-1.5 text-xs font-semibold capitalize text-emerald-700">{m.day}</td>
                      <td className="font-mono text-amber-700">{fmtTime(m.appel)}</td>
                      <td className="font-mono">{fmtTime(m.time)}</td>
                      <td><span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">T{m.court + 1}</span></td>
                      <td className="font-mono text-xs font-semibold text-emerald-700">{m.num}</td>
                      <td className="text-xs text-emerald-600">{tourLabel(m, b)}</td>
                      <td>{m.phase === "poule"
                        ? <span>{m.a} <span className="text-emerald-400">vs</span> {m.b}</span>
                        : <span className="text-emerald-700">{vlbl(plan, m, m.a)} <span className="text-emerald-400">contre</span> {vlbl(plan, m, m.b)}</span>}</td>
                      <td><AttBadge att={m.att} phase={m.attPhase} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      <footer className="pb-4 text-center text-xs text-emerald-600">
        {total} matchs planifiés — appel {APPEL} min avant le match, {REPOS} min de repos minimum après le dernier match,
        alternance optimisée pour minimiser l'attente (objectif &lt; 1h). 2 sets gagnants de 15 points, écart de 2, plafond 21,
        échange de côté à 8. Horaires donnés à titre indicatif — le repos réel ne descend jamais sous {REPOS} min
        sans l'accord du juge-arbitre ou des joueurs/paires.
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
</script>
</body>
</html>
