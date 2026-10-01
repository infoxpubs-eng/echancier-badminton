/* Test de la version hors-ligne : extraction du <script> + DOM factice,
   simulation des vues et actions utilisateur. */
const fs = require("fs");
const vm = require("vm");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier-offline.md"), "utf8");
const m = src.match(/<script>\n([\s\S]*?)<\/script>\s*<\/body>/);
if (!m) { console.error("script non trouvé"); process.exit(1); }
let code = m[1];

const el = {};
const sandbox = {
  el,
  document: { getElementById: () => el, body: { classList: { toggle: () => {} } } },
  window: { scrollTo: () => {} },
  console,
  Infinity, Math, Number, String, Object, Array, Date, RegExp, JSON, Map, Set, isNaN, parseInt, parseFloat,
};
el.__html = "";
Object.defineProperty(el, "innerHTML", { get() { return this.__h || ""; }, set(v) { this.__h = v; } });

code += `
;(function tests() {
  const out = [];
  const has = (s) => el.__h.indexOf(s) >= 0;
  // 1. écran config au chargement
  out.push(["config rendu", has("Estimation de capacité") && has("Tableaux")]);
  out.push(["config sans taillePoule", !has("Taille de poule")]);
  // 1b. paramétrage de base : 25 tableaux, 5 séries × 5 catégories
  out.push(["base 25 tableaux", state.tabs.length === 25 && state.tabs[0].classement === "Série 1" && state.tabs[24].classement === "Série 5"]);
  out.push(["base 9 partout", state.tabs.every((t) => t.nb === 9)]);
  out.push(["base SM/SD/DX samedi", state.tabs.filter((t) => ["SM", "SD", "DX"].indexOf(t.disc) >= 0).every((t) => t.jour === "samedi")]);
  out.push(["base DM/DD dimanche", state.tabs.filter((t) => ["DM", "DD"].indexOf(t.disc) >= 0).every((t) => t.jour === "dimanche")]);
  out.push(["base sans intergenre", !state.tabs.some((t) => t.disc === "SI" || t.disc === "DI")]);
  out.push(["option combosTox présente et OFF par défaut", has("combinaisons toxiques") && has("Autoriser les combinaisons toxiques") && state.combosTox === false]);
  out.push(["option finalesFin par jour, OFF par défaut", has("Demis et finales en fin de journée") && state.jours.samedi.finalesFin === false && state.jours.dimanche.finalesFin === false]);
  out.push(["option par jour retirée des paramètres communs", !has("Demi-finales et finales en fin de journée</span>")]);
  out.push(["note sémantique 2h30", has("plus de 2h30 après la fin de ses propres poules")]);
  out.push(["bouton ajouter un jour", has("＋ Ajouter un jour")]);
  // 2. génération → synthèse
  App.generer();
  out.push(["synthese défaut", has("Structure des tableaux") && has("Attente max")]);
  out.push(["légende attentes", has("ATTENTE depuis le tour précédent") && has("≥ 2h")]);
  out.push(["horaires indicatifs", has("à titre indicatif")]);
  out.push(["règle repos juge-arbitre", has("juge-arbitre")]);
  out.push(["bandeau attentes", has("attente estimée ne dépasse 1h") || has("attente estimée ≥ 1h")]);
  // 2b. combosTox : option cochée → phases simples → mixte → doubles par jour
  const plTox = computePlan(state.tabs, state.jours, state.dureeMatch, state.marge, true);
  let phFail = [];
  for (const day of plTox.days) {
    const starts = { 0: [], 1: [], 2: [] };
    (plTox.perDay[day] || []).forEach((mm) => { starts[DISC_PHASE[plTox.built[mm.tid].tab.disc] || 0].push(mm.time); });
    for (let p = 0; p < 2; p++)
      if (starts[p].length && starts[p + 1].length && Math.max(...starts[p]) > Math.min(...starts[p + 1]))
        phFail.push(day + " phase " + p);
  }
  out.push(["phases sérialisées OK", phFail.length === 0]);
  App.setCombosTox(true);
  out.push(["combosTox ON rendu", has("Structure des tableaux") && state.combosTox === true]);
  App.setCombosTox(false);
  out.push(["combosTox OFF par défaut", state.combosTox === false]);
  // 2b2. finalesFin par jour : « demis et finales en fin de journée » (samedi seul)
  App.setJour("samedi", "finalesFin", true);
  out.push(["finalesFin ON (samedi)", has("Structure des tableaux") && state.jours.samedi.finalesFin === true && state.jours.dimanche.finalesFin === false]);
  // règle 2h30 : pour chaque tableau, l'attente entre la fin de SES poules et
  // son premier match tenu (demis) reste ≤ FIN_HOLD + marge d'estimation
  const plFF = computePlan(state.tabs, state.jours, state.dureeMatch, state.marge, false, true);
  let ffFail = [];
  for (const day of plFF.days) {
    const poolEndTab = {};
    (plFF.perDay[day] || []).forEach((mm) => {
      if (mm.phase !== "poule") return;
      poolEndTab[mm.tid] = Math.max(poolEndTab[mm.tid] || -1e9, mm.time + (mm.duree !== undefined ? mm.duree : 28));
    });
    (plFF.perDay[day] || []).forEach((mm) => {
      if (mm.phase === "poule") return;
      const R = Object.keys(plFF.built[mm.tid].roundsCount).length;
      if (mm.round !== R - 2) return;
      const pe = poolEndTab[mm.tid];
      if (pe === undefined) return;
      if (mm.time - pe > FIN_HOLD + 60) ffFail.push(day + " " + mm.fid + " " + (mm.time - pe));
    });
  }
  out.push(["règle 2h30 respectée", ffFail.length === 0]);
  App.setJour("samedi", "finalesFin", false);
  // 2c. marge de sécurité
  App.backToConfig();
  App.setNum("marge", "10");
  out.push(["config marge", has("Marge de sécurité")]);
  App.generer();
  out.push(["tournoi marge ok", has("Structure des tableaux")]);
  App.setNum("marge", 0);
  App.generer();
  // 3. planning
  App.setVueTab("planning");
  out.push(["planning badge", has(">Attente</th>") && has("attb")]);
  out.push(["planning colonne Tour", has(">Tour</th>")]);
  out.push(["planning Tour N", has("Tour 1 · Poule 1")]);
  // 4. classement
  App.setVueTab("classement");
  out.push(["classement rendu", has("regroupés par classement")]);
  out.push(["classement sans vue terrain", !has("Par terrain")]);
  out.push(["classement tableaux", state.tabs.filter(Boolean).length >= 1 && has("Rencontre")]);
  // 5. vue par tableau
  App.setVueTab("t0");
  out.push(["vue t0", has("poule(s)") || has("élimination directe")]);
  App.setVueTab("t1");
  out.push(["vue t1", has("matchs planifiés")]);
  // 6. retour config, tableau > 24 (direct)
  App.backToConfig();
  App.setTabNum(0, "nb", 30);
  out.push(["config direct 30", has("élimination directe")]);
  App.generer();
  out.push(["synthese direct 30", has("élimination directe")]);
  App.setVueTab("classement");
  out.push(["classement direct 30", has("(J2)") || has("Attente")]);
  // 6b. poule unique (3-5) : pas de sortants ni de suite en élimination directe
  App.backToConfig();
  App.setTabNum(0, "nb", 4);
  out.push(["config poule unique", has("poule unique de") && has("pas de sortants ni de suite en élimination directe")]);
  App.generer();
  const planU = computePlan(state.tabs, state.jours, state.dureeMatch);
  out.push(["poule unique sans tableau final", planU.built[0].P === 1 && planU.built[0].Q === 0 && planU.built[0].playedFinals.length === 0 && planU.sched.filter((mm) => mm.tid === 0).every((mm) => mm.phase === "poule")]);
  App.setVueTab("synthese");
  out.push(["synthèse poule unique", has("poule unique")]);
  App.setVueTab("t0");
  out.push(["vue série poule unique", has("poule unique — classement final de la poule")]);
  App.setVueTab("planning");
  out.push(["tooltips colonnes Tour/Attente", has("numéro de tour en poules") && has("attente totale depuis la fin du match précédent")]);
  out.push(["tooltip badge attente", has("repos de " + REPOS + " min inclus, pour le joueur ou la paire la plus attendu")]);
  // 7. cas limites
  App.backToConfig();
  App.setTabNum(0, "nb", "");
  App.setTab(0, "jour", "dimanche");
  App.setJour("dimanche", "actif", false);
  App.generer();
  out.push(["jour inactif ok", has("Structure des tableaux")]);
  App.backToConfig();
  App.setJour("dimanche", "actif", true);
  App.setJour("samedi", "actif", false);
  App.setTab(1, "jour", "les-deux");
  App.generer();
  out.push(["les-deux samedi off", has("Structure des tableaux")]);
  // 8. ajout/suppression
  App.backToConfig();
  App.ajoutTab();
  out.push(["ajoutTab", state.tabs.length === 26]);
  App.supprTab(25);
  out.push(["supprTab", state.tabs.length === 25]);
  // 8b. thème d'affichage + logo Bad18 dans l'entête des paramètres
  out.push(["sélecteur thème présent", has("Thème d'affichage") && state.theme === "classique"]);
  out.push(["logo Bad18 entête", has("Logo Bad18") && has("<svg")]);
  App.setTheme("bad18");
  out.push(["thème bad18 activable", state.theme === "bad18"]);
  App.setTheme("classique");
  out.push(["thème retour classique", state.theme === "classique"]);
  // 8b2. jours supplémentaires : ajout (max 4), select dynamique, suppression
  App.ajoutJour();
  out.push(["ajout jour 3", state.jours["jour 3"] !== undefined && has("Jour 3")]);
  out.push(["select jour dynamique", has('<option value="jour 3"')]);
  App.ajoutJour();
  out.push(["ajout jour 4", state.jours["jour 4"] !== undefined]);
  App.ajoutJour();
  out.push(["limite 4 jours", Object.keys(state.jours).length === 4]);
  App.supprTab(25);
  App.setTab(0, "jour", "jour 4");
  App.generer();
  const plJ4 = computePlan(state.tabs, state.jours, state.dureeMatch, state.marge);
  out.push(["matchs planifiés sur jour 4", plJ4.sched.some((mm) => mm.day === "jour 4") && plJ4.unscheduled.length === 0]);
  App.backToConfig();
  App.supprJour("jour 4");
  App.supprJour("jour 3");
  App.setTab(0, "jour", "samedi");
  out.push(["suppression jours", state.jours["jour 3"] === undefined && state.jours["jour 4"] === undefined && Object.keys(state.jours).length === 2]);
  // 8b3. durée et marge surchargées par jour : m.duree suit le jour
  App.setJourNum("samedi", "dureeMatch", "35");
  App.setJourNum("samedi", "marge", "5");
  App.generer();
  const plDur = computePlan(state.tabs, state.jours, state.dureeMatch, state.marge);
  out.push(["durée par jour (35+5 vs 28)", plDur.sched.every((mm) => mm.duree === (mm.day === "samedi" ? 40 : 28))]);
  App.setJourNum("samedi", "dureeMatch", "");
  App.setJourNum("samedi", "marge", "");
  App.backToConfig();
  App.generer();
  // 8c. dépassement d'horaire : horaire de fin modifié, aucun match supprimé
  App.setJour("samedi", "actif", true);
  App.setJour("samedi", "fin", "09:30");
  App.generer();
  out.push(["bandeau horaire modifié", has("horaire de fin a dû être modifié")]);
  const plOver = computePlan(state.tabs, state.jours, state.dureeMatch);
  out.push(["dépassement : tout planifié", plOver.unscheduled.length === 0 && plOver.sched.length === plOver.built.reduce((s, b) => s + b.poolMs.length + b.playedFinals.length, 0)]);
  App.setVueTab("planning");
  out.push(["badge attente « — »", has(">—</span>") && !has("1er tour")]);
  App.setJour("samedi", "fin", "21:50");
  App.backToConfig();
  App.generer();
  // 9. vérif moteur : chaque match planifié a att défini + étiquettes de tour
  App.generer();
  const plan = computePlan(state.tabs, state.jours, state.dureeMatch);
  out.push(["att défini", plan.sched.every((mm) => mm.att === null || (Number.isFinite(mm.att) && mm.att >= 0))]);
  out.push(["att mix", plan.sched.some((mm) => mm.att === null) && plan.sched.some((mm) => mm.att !== null)]);
  out.push(["tour poule ok", plan.sched.filter((mm) => mm.phase === "poule").every((mm) => /^Tour [0-9]+ · Poule [0-9]+$/.test(tourLabel(mm, plan.built[mm.tid])))]);
  out.push(["tour finale ok", plan.sched.filter((mm) => mm.phase !== "poule").every((mm) => /Finale$/.test(tourLabel(mm, plan.built[mm.tid])))]);
  App.setVueTab("planning");
  out.push(["rendu finale niveau", has("Finale") && !has("Quarts de finale</td>")]);

  // 10. pause Déjeuner/Remise médailles par jour (config + moteur + affichage)
  App.backToConfig();
  out.push(["inputs pause Déjeuner/Remise médailles", has("Pause Déjeuner/Remise médailles") && has("à (reprise)")]);
  App.setJour("samedi", "pauseDebut", "12:30");
  App.setJour("samedi", "pauseFin", "13:30");
  App.generer();
  const plP = computePlan(state.tabs, state.jours, state.dureeMatch);
  const pD = 12 * 60 + 30, pF = 13 * 60 + 30;
  out.push(["pause : aucun chevauchement", (plP.perDay.samedi || []).every((mm) => mm.time >= pF || mm.time + (mm.duree !== undefined ? mm.duree : 28) <= pD)]);
  App.setVueTab("synthese");
  out.push(["pause affichée (stats jour)", has("🍽️ Pause Déjeuner/Remise médailles : 12:30 → 13:30")]);
  App.setVueTab("planning");
  const hPlan = el.__h;
  out.push(["bandeau pause dans le planning", has("Pause Déjeuner/Remise médailles · 12:30 → 13:30 — aucun match pendant la pause")]);
  out.push(["bandeau pause : unique", hPlan.split("Pause Déjeuner/Remise médailles ·").length === 2]);
  const iBand = hPlan.indexOf("Pause Déjeuner/Remise médailles ·");
  const iBandEnd = hPlan.indexOf("aucun match pendant la pause", iBand) + "aucun match pendant la pause".length;
  const mt = hPlan.slice(iBandEnd).match(/(\\d{2}):(\\d{2})/);
  const nextT = mt ? parseInt(mt[1], 10) * 60 + parseInt(mt[2], 10) : -1;
  out.push(["bandeau pause : 1er match après la reprise", nextT >= 13 * 60 + 25, nextT]); console.log("DEBUG nextT:", nextT, "iBandEnd:", iBandEnd, "après:", JSON.stringify(hPlan.slice(iBandEnd, iBandEnd + 220)));
  App.setJour("samedi", "pauseDebut", "");
  App.setJour("samedi", "pauseFin", "");
  // 11. boutons Direct / Export CSV / PDF-Imprimer dans l'entête
  out.push(["bouton Direct", has("Suivi en direct")]);
  out.push(["bouton Export CSV", has("Export CSV")]);
  out.push(["bouton PDF / Imprimer", has("PDF / Imprimer")]);
  out.push(["no-print sur les boutons", has("no-print")]);
  // 12. suivi en direct : ✓ / W.O. par match, replanification sur forfait
  const plRef = computePlan(state.tabs, state.jours, state.dureeMatch);
  const mkey = plRef.sched[0].key;
  App.setLive(true);
  out.push(["direct ON : état", state.live === true]);
  out.push(["direct ON : boutons ✓/W.O.", has(">✓</button>") && has(">W.O.</button>")]);
  out.push(["direct ON : bandeau", has("Suivi en direct</b>")]);
  App.toggleFini(mkey);
  out.push(["match terminé coché (barré)", state.finis[mkey] === true && has("<s>")]);
  App.toggleFini(mkey);
  App.setForfait(mkey, true);
  out.push(["W.O. enregistré", state.wf[mkey] === true]);
  const plW = computePlan(state.tabs, state.jours, state.dureeMatch, state.marge, state.combosTox, state.finalesFin,
    new Set(Object.keys(state.wf).filter((k) => state.wf[k])));
  out.push(["W.O. replanifié : match retiré + compté", !plW.sched.some((mm) => mm.key === mkey) && plW.forfaits.length === 1 && plW.unscheduled.length === 0]);
  out.push(["bandeau W.O. + annulation", has("W.O. enregistrés :") && has("annuler le W.O.")]);
  App.setForfait(mkey, false);
  out.push(["W.O. annulé", state.wf[mkey] === false && !has("W.O. enregistrés :")]);
  App.setLive(false);
  out.push(["direct OFF : boutons retirés", state.live === false && !has(">W.O.</button>")]);
  // 13. colonne « Fin estimée » dans la synthèse
  App.setVueTab("synthese");
  out.push(["colonne Fin estimée", has("Fin estimée")]);
  // 14. évolutions 2026-10 : colonne N°, délais ≈, fond coloré par tableau, marge réelle
  const pln = computePlan(state.tabs, state.jours, state.dureeMatch, state.marge, state.combosTox, state.finalesFin,
    new Set(Object.keys(state.wf).filter((k) => state.wf[k])));
  const nums = pln.sched.map((mm) => mm.num);
  out.push(["N° : 1..N unique", new Set(nums).size === nums.length && Math.min.apply(null, nums) === 1 && Math.max.apply(null, nums) === pln.sched.length]);
  App.setVueTab("planning");
  out.push(["planning colonne N°", has(">N°</th>")]);
  out.push(["planning numéros affichés", el.__h.indexOf("font-weight:700;color:var(--em-d)'>") >= 0]);
  App.setVueTab("classement");
  out.push(["classement colonne N°", has(">N°</th>")]);
  out.push(["classement fond coloré attente max", /<h3 style="background:(#059669|#d1fae5|#fef08a|#fed7aa|#fecaca)/.test(el.__h)]);
  App.setVueTab("t0");
  out.push(["vue tableau colonne N°", has(">N°</th>")]);
  out.push(["vue tableau fond coloré attente max", /<h3 style="background:(#059669|#d1fae5|#fef08a|#fed7aa|#fecaca)/.test(el.__h)]);
  App.setVueTab("planning");
  const base9 = pln.built.filter((b) => b.P > 0);
  const finalsPoule = pln.sched.filter((mm) => mm.phase !== "poule" && mm.round === 0 && base9.some((b) => b.tid === mm.tid));
  out.push(["≈ : délais de phase sur premiers tours d'élimination", finalsPoule.some((mm) => mm.att === null && mm.attPhase !== null && mm.attPhase >= 0)]);
  out.push(["badge ≈ affiché (italique, tooltip phase)", has("≈ ") && has("délai entre la fin estimée du dernier match de la phase précédente")]);
  App.backToConfig();
  out.push(["estimation : colonnes Planifié + Marge réelle", has("Planifié") && has("Marge réelle")]);
  out.push(["estimation : avertissement théorique vs réel", has("une marge théorique positive ne garantit pas")]);
  App.generer();

  const fails = out.filter(([, ok]) => !ok);
  out.forEach(([n, ok]) => { if (!ok) console.log("ÉCHEC:", n); });
  console.log("offline:", out.length - fails.length + "/" + out.length, "contrôles OK");
})();`;

try {
  vm.runInNewContext(code, sandbox, { filename: "offline.js" });
} catch (e) {
  console.error("CRASH:", e.message);
  console.error(String(e.stack).split("\n").slice(0, 6).join("\n"));
  process.exit(1);
}
