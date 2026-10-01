# Journal des évolutions

Chaque demande d'évolution fait l'objet d'une entrée datée ci-dessous
(et d'un ticket GitHub à la date de demande). Chaque entrée précise la
demande d'origine, la décision prise, l'état (implémenté / refusé / en
attente) et la manière dont elle a été résolue.

---

## 2026-09-30 — Lot initial (v1.0)

| Demande | Décision | État |
|---|---|---|
| Attente = temps **total** (repos 20 min inclus), tableau final = qualifié le plus attendu | Adopté | Implémenté (v1.0) |
| Libellés de tours = structure papier du bracket, niveaux étendus à 1/64 | Adopté | Implémenté (v1.0) |

## 2026-10-01 — Lot 2 (v1.1)

### 1. Numéro de match (« N° ») dans les plannings — ✅ implémenté (v1.1)

- **Demande** : ajouter le numéro d'indexation des matchs entre « Terrain »
  et « Tableau » dans les plannings par jour et par tableau ; numérotation
  de 1 jusqu'à la fin du tournoi, le même index repris dans toutes les vues
  pour un même match.
- **Résolution** : chaque match planifié reçoit `m.num` à la fin du calcul,
  dans l'ordre chronologique (jour, heure de début, terrain). Colonne « N° »
  ajoutée au planning par jour (entre Terrain et Tableau), aux vues par
  classement et par tableau (entre Terrain et Tour), et à l'export CSV.
  Vérifié par tests : numéros 1..N uniques, strictement croissants dans
  l'ordre chronologique (`tests/render-views-test.js`).

### 2. Cohérence synthèse de capacité vs planning réel — ✅ implémenté (v1.1)

- **Demande** : l'estimation et la capacité des jours restent « vert »
  alors que le planning ne tient pas dans la journée ; si la synthèse
  indique de la marge, tous les matchs devraient tenir.
- **Analyse** : la marge affichée était **théorique** — terrains ×
  (horaire ÷ durée) contre le besoin de matchs. Le planificateur garantit
  en plus un repos de 20 min, un appel de 5 min, l'alternance des tours et
  les pauses : la capacité effective est donc plus faible, sans que ce
  soit une erreur de planification.
- **Résolution** : l'estimation de capacité affiche désormais le
  **planifié réel** et la **marge réelle** (fin effective du plan vs
  horaire de fermeture, en minutes), calculés par le même moteur que
  l'échéancier. Le texte explicite qu'une marge théorique positive ne
  garantit pas que tout se joue dans l'horaire. Vérifié sur 4 scénarios
  (`tests/render-config-test.js`, contrôle « marge réelle »).

### 3. Délai de transition pour l'élimination directe (badge « ≈ ») — ✅ implémenté (v1.1)

- **Demande** : les matchs d'élimination directe sans attente (premiers
  tours issus des poules) pourraient indiquer le délai entre l'horaire
  estimé du dernier match du tour précédent (dernière poule par exemple)
  et le début du premier match d'élimination directe.
- **Résolution** : pour un match final sans attente individuelle
  mesurable, le moteur calcule le délai entre la fin de la **dernière
  poule/ronde du même tableau** et le début du match. Affiché en badge
  italique « ≈ 45 min » avec info-bulle dédiée, même code couleur. Ne
  modifie ni les attentes individuelles ni les métriques de référence.
  Vérifié par tests (`render-views-test.js` : cohérence ≈, élimination
  directe pure sans ≈ ; `offline-render-test.js` : 2 contrôles).

### 4. Fond coloré selon l'attente max par tableau — ✅ implémenté (v1.1)

- **Demande** : dans les plannings par tableau/classement, indiquer en
  fond la couleur correspondant au temps d'attente maximum de chacun.
- **Résolution** : l'en-tête de chaque carte (vues « Par classement » et
  par tableau) est teintée du code couleur des attentes selon l'attente
  maximale **combinée** du tableau (attentes individuelles + délais ≈),
  avec la valeur « attente max » affichée dans le bandeau. Vérifié par
  tests (`render-views-test.js`, `offline-render-test.js`).

### Demande transverse

- **Consigner chaque évolution demandée et sa résolution dans GitHub** :
  ce fichier (`EVOLUTIONS.md`) est le journal durable, tenu à chaque lot
  d'évolutions ; chaque demande du lot ouvre en outre un ticket GitHub
  fermé avec sa résolution (voir les tickets du 2026-10-01).

---

## Procédé de mise à jour

Chaque évolution suit le même circuit : demande consignée → implémentation
dans les trois versions (app React, web, hors-ligne) → régénération web
(`tests/regen-web.sh`) → suite complète de tests (`tests/`) → CHANGELOG →
commit descriptif → push. Les métriques de référence (base 350 matchs :
att60 = 83, max 112, moy 54 ; finalesFin 93/124/57 ; poules→demis ≤ 150 min)
servent de garde-fous de régression.
