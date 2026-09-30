# Échéancier de tournoi de badminton

Générateur **prédictif** d'échéancier de tournoi de badminton sur un week-end :
il planifie automatiquement tous les matchs (appel, heure de début, terrain,
attente) à partir du paramétrage des tableaux, sans saisir le moindre résultat.

## Fonctionnalités

- **Paramétrage par tableau** : discipline (SM, SD, DM, DD, DX), classement,
  nombre de joueurs/paires, sortants par poule, jour(s) de jeu ;
- **Formats** : poules + élimination directe, élimination directe seule,
  **ronde suisse** (seule ou suivie d'un tableau final) — appariement simulé
  par rotation, nombre de rondes réglable (auto = ⌈log₂ n⌉, min 3) ;
- **Exempts** : 1 par ronde si effectif impair (jamais le même deux fois de
  suite), affichés dans le détail du tableau ; exempts de 1er tour des
  tableaux finaux intégrés à la structure (bracket puissance de 2) ;
- **Ordonnancement** : repos minimum de 20 min (jusqu'au début du match),
  appel 5 min avant, pause déjeuner, démarrage progressif des tableaux,
  option « demis et finales en fin de journée » ;
- **Attentes** : badge d'attente **totale** (repos inclus) depuis la fin du
  match précédent du joueur ou de la paire la plus attendu(e), y compris en
  tableau final (qualifié issu de la source finie le plus tôt) ;
- **Suivi direct** : marquer un match terminé, déclarer un W.O. (replanification
  immédiate de la journée), survol/tactilité adaptés à l'iPad ;
- **Export** : CSV (Excel-friendly, BOM + points-virgules) et impression ;
- **Thèmes** : classique (vert) ou Bad18 (rouge et noir).

## Utilisation

| Version | Fichier | Prérequis |
|---|---|---|
| **Hors-ligne** (recommandée iPad) | `app/echancier-hors-ligne.html` | aucun — ouvrir dans Safari |
| **Web** | `index.html` | connexion internet (React via CDN) |

Ouvrez le fichier HTML dans un navigateur : aucune installation, aucun serveur.
La version hors-ligne est 100 % autonome (JS pur, aucune dépendance).

## Hébergement (GitHub Pages)

`index.html` est à la racine pour un hébergement direct :
**Settings → Pages → Deploy from a branch → main / (root)**.
La page sera servie sur `https://<compte>.github.io/<dépôt>/`.
NB : sur les plans gratuits, Pages n'est disponible que pour les dépôts publics.

## Structure du dépôt

```
├── README.md, CHANGELOG.md
├── index.html                    version web (React via CDN)
├── app/echancier-hors-ligne.html  version hors-ligne autonome
├── src/                          sources de vérité (app + moteur)
│   ├── badminton-echancier.md         app principale (React/JSX)
│   ├── badminton-echancier-offline.md version hors-ligne (JS pur)
│   └── badminton-echancier-web.md     version web (générée depuis la principale)
└── tests/                        suite de vérification Node (voir tests/README.md)
```

Les fichiers de `src/` incluent un en-tête markdown ; le contenu HTML/JSX
qu'ils contiennent est la source de vérité du projet. `index.html` et
`app/*.html` en sont extraits (`tests/regen-web.sh` régénère la version web).

## Tests

Node ≥ 20 requis. Depuis la racine du dépôt :

```sh
node tests/swiss-test.js            # moteur ronde suisse
node tests/render-views-test.js     # 19 012 cas de rendu
node tests/rest-test.js             # invariants de planification
node tests/render-config-test.js    # 15 840 cas d'écran configuration
node tests/offline-render-test.js   # 84 contrôles version hors-ligne
node tests/offline-swiss-test.js    # ronde suisse hors-ligne
node tests/exempts-scroll-test.js   # exempts + conservation du défilement
node tests/metrics.js               # métriques de référence (régression)
```

Voir `tests/README.md` pour les dépendances de `web-check.js` et le script
de régénération.
