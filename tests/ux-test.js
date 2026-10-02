/* Test UX v2.0-rc (hors-ligne) : navigation rapide, validation en direct,
   estimation live, barre d'action collante, suppression en deux clics,
   bouton « Tout déplier », onglets collants et retour en haut. */
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
  console, Infinity, Math, Number, String, Object, Array, Date, RegExp, JSON, Map, Set, isNaN, parseInt, parseFloat,
};
el.__html = "";
Object.defineProperty(el, "innerHTML", { get() { return this.__h || ""; }, set(v) { this.__h = v; } });

code += `
;(function tests() {
  const out = [];
  const has = (s) => el.__h.indexOf(s) >= 0;
  const okAll = () => out.every((o) => o[1]);

  // 1. écran config : navigation rapide et estimation live
  const est = state.tabs.reduce(function (s, t) { const b = buildTab(t, 0); return s + b.poolMs.length + b.playedFinals.length; }, 0);
  out.push(["quicknav présente", has("Accès rapide") && has("#sec-jours") && has("#sec-parametres") && has("#sec-configs") && has("#sec-estimation") && has("#sec-tableaux")]);
  out.push(["ancres id posées", has('id="sec-jours"') && has('id="sec-parametres"') && has('id="sec-configs"') && has('id="sec-estimation"') && has('id="sec-tableaux"')]);
  out.push(["bouton tout déplier (config)", has("ℹ️ Tout déplier")]);
  out.push(["barre d'action collante", has("actbar")]);
  out.push(["estimation live correcte", new RegExp("≈ " + est + " matchs").test(el.__h) && est === 350]);
  out.push(["aucune bannière en config saine", !has("Vérification de la configuration")]);

  // 2. validation en direct : fin avant début → bannière ambrée
  App.setJour("samedi", "fin", "07:00");
  out.push(["bannière fin < début", has("Vérification de la configuration") && has("la fin (07:00) est avant ou égale au début (08:30)")]);
  out.push(["compteur dans la barre d'action", has("1 point(s) à vérifier")]);
  App.setJour("samedi", "fin", "21:50");
  out.push(["bannière retirée après correction", !has("Vérification de la configuration")]);

  // 3. terrains hors bornes + pause incomplète
  App.setJourNum("samedi", "terrains", "99");
  render();
  out.push(["terme hors bornes signalé", has("99 terrain(s)")]);
  App.setJourNum("samedi", "terrains", "8");
  render();
  out.push(["terme corrigé non signalé", !has("99 terrain(s)")]);
  App.setJour("samedi", "pauseDebut", "12:30");
  out.push(["pause incomplète signalée", has("pause incomplète")]);
  App.setJour("samedi", "pauseFin", "13:30");
  out.push(["pause complète non signalée", !has("pause incomplète")]);

  // 4. suppression d'un jour en deux clics (jour 3 ajouté puis retiré)
  App.ajoutJour();
  const nJours = Object.keys(state.jours).length;
  out.push(["jour ajouté", nJours === 3]);
  const j3 = Object.keys(state.jours).filter((j) => j.indexOf("jour ") === 0).pop();
  App.askSuppr("jour", j3);
  out.push(["1er clic arme (jour)", has("Confirmer ✕ ?")]);
  App.supprJour(j3);
  out.push(["2ᵉ clic supprime (jour)", Object.keys(state.jours).length === nJours - 1 && state.confirmDel === null && !has("Confirmer ✕ ?")]);

  // 5. suppression d'un tableau en deux clics
  const nTabs = state.tabs.length;
  App.askSuppr("tab", 0);
  out.push(["1er clic arme (tableau)", has("Confirmer ✕ ?") && !has(">✕ Retirer</button>") === false]);
  out.push(["action directe sans armement", (() => { App.supprTab(0); return state.tabs.length === nTabs - 1; })()]);

  // 6. suppression d'une configuration en deux clics
  App.saveCfg("UX Test");
  const iCfg = cfgNames().indexOf("UX Test");
  out.push(["config enregistrée", iCfg >= 0]);
  App.askSuppr("cfg", iCfg);
  out.push(["1er clic arme (config)", has("Confirmer ✕ ?")]);
  App.supprCfg(iCfg);
  out.push(["2ᵉ clic supprime (config)", cfgNames().indexOf("UX Test") < 0 && state.confirmDel === null]);

  // 7. réinitialisation de l'armement par une autre action
  App.askSuppr("tab", 0);
  out.push(["armement posé", has("Confirmer ✕ ?")]);
  App.setTab(0, "classement", "X");
  out.push(["mutation réinitialise l'armement", state.confirmDel === null && !has("Confirmer ✕ ?")]);

  // 8. écran tournoi : onglets collants, tout déplier, retour en haut
  App.generer();
  out.push(["retour en haut flottant", has("backtop") && has("remonter en haut de la page")]);
  out.push(["onglets collants", has("position:sticky;top:6px")]);
  out.push(["bouton tout déplier (tournoi)", has("ℹ️ Tout déplier")]);
  out.push(["toggleNotes exposé", typeof App.toggleNotes === "function"]);

  // 9. exécution des notes (DOM factice : vérification de l'existence seulement)
  out.push(["notes dépliables présentes", has("note-sum")]);

  console.log(out.map((o) => (o[1] ? "OK   " : "ÉCHEC ") + o[0]).join("\\n"));
  if (!okAll()) { throw new Error("UX-TEST ÉCHEC"); }
  console.log("UX-TEST : " + out.length + "/" + out.length + " SONT OK");
})();
`;

try {
  vm.runInNewContext(code, sandbox, { timeout: 60000 });
} catch (e) {
  console.error("ERREUR:", e.message);
  process.exit(1);
}
