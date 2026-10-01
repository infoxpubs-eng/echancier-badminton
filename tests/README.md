# Suite de tests

Tous les tests s'exécutent depuis la racine du dépôt : `node tests/<fichier>`.

| Test | Contenu |
|---|---|
| `swiss-test.js` | moteur ronde suisse : appariement, ordre des rondes, W.O., mixte poules/suisse |
| `render-views-test.js` | 19 012 cas : rendu des vues, attentes, invariants sémantiques, numéros N°, délais ≈, attente max combinée |
| `rest-test.js` | invariants de planification : repos, pauses, finales en fin de journée, forfaits |
| `render-config-test.js` | 15 840 cas : écran de configuration + marge réelle (4 scénarios) |
| `offline-render-test.js` | 95 contrôles de la version hors-ligne (dont N°, ≈, marge réelle, fonds colorés) |
| `offline-swiss-test.js` | ronde suisse dans la version hors-ligne |
| `exempts-scroll-test.js` | exempts (effectif impair) + conservation du défilement |
| `metrics.js` | métriques de référence (350 matchs, att60/attMax/attMoy, poules→demis ≤ 150) |
| `web-check.js` | compilation JSX + exécution de la version web (voir dépendances ci-dessous) |

### Dépendances de `web-check.js`

Babel et React sont nécessaires (re-téléchargeables) :

```sh
curl -sL https://unpkg.com/@babel/standalone/babel.min.js -o /tmp/babel.min.js
curl -sL https://unpkg.com/react@18/umd/react.production.min.js -o /tmp/react.min.js
node tests/web-check.js
```

### Régénération de la version web

La version web (`src/badminton-echancier-web.md`, dont `index.html` est
extrait) est régénérée depuis la source principale :

```sh
sh tests/regen-web.sh
```
