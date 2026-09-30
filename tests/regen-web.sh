#!/bin/sh
# Régénère le canvas web (badminton-echancier-web) depuis le canvas principal
# (badminton-echancier). L'en-tête HTML (jusqu'au script de repli inclus) est
# conservé tel quel ; le corps est recopié depuis le canvas principal à partir
# de sa ligne 8 (après l'import React), avec la signature App adaptée.
set -e
cd "$(dirname "$0")/.."
# en-tête : tout ce qui précède le corps JS, y compris la balise
# <script type="text/babel"> et la ligne « const { useMemo, useState } = React; »
awk '/^<script type="text\/babel"/ {print; getline; print; exit} {print}' src/badminton-echancier-web.md > /tmp/web-header.html
# corps : canvas principal ligne 8 → fin, sans l'import React
tail -n +8 src/badminton-echancier.md | sed 's/^export default function App() {$/function App() {/' > /tmp/web-body.html
# pied : montage React + fermeture du document
printf '\nReactDOM.createRoot(document.getElementById("root")).render(<App />);\n</script>\n</body>\n</html>\n' > /tmp/web-footer.html
cat /tmp/web-header.html /tmp/web-body.html /tmp/web-footer.html > src/badminton-echancier-web.md
echo "regénéré : $(wc -l < src/badminton-echancier-web.md) lignes"
