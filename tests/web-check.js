/* Vérifie que le script Babel du canvas web compile (transformation JSX) puis
   s'exécute avec React 18 UMD en Node (DOM factice). */
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "src", "badminton-echancier-web.md"), "utf8");
const m = src.match(/<script type="text\/babel"[^>]*>\n([\s\S]*?)\n<\/script>/);
if (!m) { console.error("script babel non trouvé"); process.exit(1); }
const babel = require("/tmp/babel.min.js");
let out;
try {
  out = babel.transform(m[1], { presets: ["react"] }).code;
  console.log("JSX compile OK (" + out.length + " chars)");
} catch (e) {
  console.error("JSX ERROR:", e.message.split("\n").slice(0, 12).join(" | "));
  process.exit(1);
}
const React = require("/tmp/react.min.js");
let rendered = false;
const ReactDOM = {
  createRoot: () => ({ render: () => { rendered = true; } }),
};
global.React = React;
global.ReactDOM = ReactDOM;
global.document = { getElementById: () => ({}), body: { classList: { toggle: () => {} } } };
global.window = { scrollTo: () => {}, addEventListener: () => {} };
global.navigator = { userAgent: "node-test" };
try {
  eval(out);
  console.log("exécution OK — render(<App />) appelé:", rendered);
} catch (e) {
  console.error("RUNTIME ERROR:", e.message.split("\n").slice(0, 8).join(" | "));
  process.exit(1);
}
