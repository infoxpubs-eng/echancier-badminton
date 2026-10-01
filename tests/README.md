# Suite de tests

Tous les tests s'exécutent depuis la racine du dépôt : `node tests/<fichier>`.

| Test | Contenu |
|---|---|
| `swiss-test.js` | moteur ronde suisse : appariement, ordre des rondes, W.O., mixte poules/suisse |
| `render-views-test.js` | 19 012 cas : rendu des vues, attentes, invariants sémantiques, numéros N°, délais ≈, attente max combinée |
| `rest-test.js` | invariants de planification : repos, pauses, finales en fin de journée, forfaits |
| `deux-jours-test.js` | tableaux « les deux jours » : reprise du jour 2 à l'ouverture (pas d'ancrage sur l'horloge du jour 1), ordre des tours, repos, attentes inter-jours non mesurables |
| `render-config-test.js` | 15 840 cas : écran de configuration + marge réelle (4 scénarios) |
| `offline-render-test.js` | 95 contrôles de la version hors-ligne (dont N°, ≈, marge réelle, fonds colorés) |
| `presets-test.js` | 21 contrôles v1.5 : configurations enregistrées (save/charger/supprimer, auto-save « Dernière (auto) », export/import JSON), thème dark (état + classes body), palette invariante (chips de marge à couleurs fixes, attentes hex inchangés) |
| `byes-test.js` | Exempts du tableau final (v1.5.1) : tours suivants référencent le qualifié exempté (sources toutes réelles, jamais un « Vainqueur Tx-y » fantôme), 168 tableaux / 297 exempts testés, invariant sources-fid (fin + repos 20 min) ; **v1.6** : ordre strict des tours d'un même tableau vérifié sur tous les tableaux et tours (un tour démarre après la FIN de tous les matchs du tour précédent du tableau ; 1er tour après fin des poules + repos) |
| `ordre-jours-test.js` | Ordre des jours + « Vainqueur N° » (v1.7) : tri canonique samedi → dimanche → « jour 3 » (même si une configuration enregistrée inverse l'ordre), numérotation des matchs du samedi toutes inférieures à celles du dimanche, libellé « Vainqueur <N° du match gagné> » conforme à l'échéancier, libellé des sources qualifiées inchangé, repli « Vainqueur Tx-y » si le match source est forfait (non planifié) ; **v1.7.1** : listes multi-jours d'un tableau « les deux jours » (vues par classement/par tableau) — tous les matchs du samedi avant le premier du dimanche, ordre (jour, heure, terrain) croissant |
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
