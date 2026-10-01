/* Test v1.5 hors-ligne : configurations enregistrées (save/charger/
   supprimer/auto-save/export/import), thème dark, palette invariante
   (chips de marge à couleurs fixes, attentes hex inchangés). Sandbox SANS
   localStorage : vérifie le repli sur la mémoire de session. */
const fs = require("fs");
const vm = require("vm");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier-offline.md"), "utf8");
const m = src.match(/<script>\n([\s\S]*?)<\/script>\s*<\/body>/);
if (!m) { console.error("script non trouvé"); process.exit(1); }
let code = m[1];

const el = {};
const cls = {};
const sandbox = {
  el,
  cls,
  document: { getElementById: () => el, body: { classList: { toggle: (c, on) => { cls[c] = !!on; } } } },
  window: { scrollTo: () => {} },
  console,
  Infinity, Math, Number, String, Object, Array, Date, RegExp, JSON, Map, Set, isNaN, parseInt, parseFloat,
};
el.__html = "";
Object.defineProperty(el, "innerHTML", { get() { return this.__h || ""; }, set(v) { this.__h = v; } });
// PAS de localStorage dans le sandbox → repli mémoire CFG_MEM

code += `
;(function tests() {
  const out = [];
  const has = (s) => el.__h.indexOf(s) >= 0;
  // 1. carte des configurations présente à l'écran config
  out.push(["carte Configurations enregistrées", has("Configurations enregistrées") && has("Exporter JSON") && has("Importer JSON")]);
  out.push(["champ nom présent", has("Nom de la configuration")]);
  out.push(["aucune config au départ", cfgNames().length === 0]);
  // 2. sauvegarde nommée puis restauration
  App.saveCfg("Test A");
  out.push(["saveCfg nommé", cfgNames().length === 1 && cfgNames()[0] === "Test A"]);
  App.setNum("dureeMatch", "32");
  out.push(["état modifié", state.dureeMatch === 32]);
  App.chargerCfg(0);
  out.push(["chargerCfg restaure la config", state.dureeMatch === 28]);
  // 3. export JSON → round-trip import
  const data = App.exportCfg();
  let parsed = null;
  try { parsed = JSON.parse(data); } catch (e) {}
  out.push(["exportCfg JSON valide", !!parsed && parsed.app === "echancier-badminton" && parsed.config && parsed.config.dureeMatch === 28]);
  App.setNum("marge", "10");
  App.importCfgData(data);
  out.push(["importCfgData restaure la marge", state.marge === 0]);
  App.importCfgData("{pas du json");
  out.push(["importCfgData ignore un JSON invalide", true]);
  // 4. auto-save « Dernière (auto) » à la génération
  App.generer();
  out.push(["auto-save Dernière (auto)", cfgNames().indexOf("Dernière (auto)") === 0 && state.phase === "tournoi"]);
  App.backToConfig();
  out.push(["retour config", state.phase === "config"]);
  // 5. suppression (indices sur la liste triée : auto en tête)
  App.saveCfg("Test B");
  out.push(["deux configs + auto", cfgNames().join("|") === "Dernière (auto)|Test A|Test B"]);
  App.supprCfg(2);
  out.push(["supprCfg retire Test B", cfgNames().join("|") === "Dernière (auto)|Test A"]);
  // 6. thème dark : état, classe body, sélecteur
  out.push(["option dark dans le sélecteur", has("Dark (sombre)")]);
  App.setTheme("dark");
  out.push(["setTheme dark", state.theme === "dark" && cls["theme-dark"] === true && cls["theme-bad18"] === false]);
  App.setTheme("bad18");
  out.push(["setTheme bad18", state.theme === "bad18" && cls["theme-bad18"] === true && cls["theme-dark"] === false]);
  App.setTheme("nimporte");
  out.push(["valeur inconnue → classique", state.theme === "classique"]);
  // 7. palette invariante : chips de marge à couleurs fixes (pas de var(--em))
  App.setTheme("dark");
  out.push(["chips marge présentes (fond + couleur fixes)", el.__h.indexOf("border-radius:6px;padding:1px 8px;white-space:nowrap;font-weight:700;background:#dcfce7;color:#065f46") >= 0 || el.__h.indexOf("border-radius:6px;padding:1px 8px;white-space:nowrap;font-weight:700;background:#fee2e2;color:#b91c1c") >= 0]);
  const avant = ATT_STEPS.map((s) => s.bg + "/" + s.fg).join(",");
  App.generer();
  out.push(["attentes inchangées en thème dark", ATT_STEPS.map((s) => s.bg + "/" + s.fg).join(",") === avant && avant.indexOf("#059669") === 0]);
  out.push(["légende attentes en hex fixes", has("background:#059669") && has("background:#fecaca")]);
  out.push(["CSS dark dans la page (source)", ${JSON.stringify(src.indexOf("body.theme-dark") >= 0)}]);

  const fails = out.filter(([, ok]) => !ok);
  out.forEach(([n, ok]) => { if (!ok) console.log("ÉCHEC:", n); });
  console.log("presets:", out.length - fails.length + "/" + out.length, "contrôles OK");
  if (fails.length) process.exitCode = 1;
})();`;

try {
  vm.runInNewContext(code, sandbox, { filename: "presets.js" });
} catch (e) {
  console.error("CRASH:", e.message);
  console.error(String(e.stack).split("\n").slice(0, 6).join("\n"));
  process.exit(1);
}
