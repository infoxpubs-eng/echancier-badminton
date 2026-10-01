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

## 2026-10-01 — Lot 4 (v1.3)

### 1. Marge réelle dimanche incohérente avec un tableau étalé sur deux jours — ✅ implémenté (v1.3)

- **Demande** (capture d'estimation) : « Samedi 155 matchs sur 228,
  marge réelle +178 min ; dimanche 57 sur 145, marge réelle −118 min.
  Est-ce que le calcul de la marge réelle porte bien sur chacun des
  jours ? Il semblerait que si je n'étale pas le DX 1 sur deux jours
  cela soit plus cohérent. »
- **Analyse** : le calcul de la marge réelle est correct (par jour :
  fermeture du jour − fin du dernier match planifié ce jour-là).
  Le défaut était dans la planification : pour un tableau « les deux
  jours », les dépendances du jour 2 (demis → quarts joués la veille)
  étaient évaluées dans l'horloge absolue du jour 1 — une source
  finie à 17:42 samedi imposait une reprise des demis à 18:02
  dimanche (repos de 20 min appliqué sur des horaires de la veille),
  alors que le repos de la nuit est acquis. Résultat : la finale du
  DX jouée à 18:30 le dimanche alors que la journée était presque
  vide, samedi terminant tôt de son côté. Le diagnostic de
  l'utilisateur était exact : sans tableau étalé, aucune dépendance
  inter-jours, donc pas de symptôme.
- **Résolution** : une source jouée un autre jour ne contraint plus
  l'heure de reprise — le match du jour 2 démarre à l'ouverture du
  jour (vérifié : reprise à 08:30 au lieu de 13:30 sur le scénario de
  reproduction). L'attente d'une source de la veille est non
  mesurable (« — ») au lieu d'un délai hérité ; le badge « ≈ » ne
  compare plus qu'aux poules du même jour. Invariants de tests
  ajustés (intercalage sources du même jour uniquement) et nouveau
  `tests/deux-jours-test.js` (échoue sur le moteur d'avant
  correctif). Métriques de référence inchangées (att60 = 83,
  max 112, moy 54 — aucun tableau « les deux jours » dans la base).

---

## 2026-10-01 — Lot 3 (v1.2)

### 1. Clarification de l'estimation de capacité (« comment est calculé le −201 ? ») — ✅ implémenté (v1.2)

- **Demande** : capture d'écran de l'estimation de capacité — « Vois-tu
  un problème avec l'estimation ? En particulier pour le dimanche,
  j'ai l'impression que tous les matchs ne sont pas pris en compte,
  ou alors comment est calculé le −201 ? »
- **Analyse** : ce n'est pas un bug. « Marge réelle » = fermeture du
  jour − fin du dernier match planifié (ex. −201 = fermeture 17:00,
  dernier match 20:21) ; le moteur ne supprime jamais de matchs. La
  confusion venait de la colonne « Marge » théorique, qui ne déduit
  que le besoin **fixe** du jour : les tableaux « les deux jours »
  n'y sont pas comptés alors qu'ils se planifient en partie chaque
  jour (d'où Besoin fixe dimanche 57 vs Planifié 68 sur la capture).
- **Résolution** : colonne « Planifié » complétée du suffixe
  « (N deux-jours) » avec info-bulle de décomposition ; info-bulles
  explicites sur « Besoin fixe », « Marge », « Planifié », « Marge
  réelle » ; paragraphe d'explication étendu (définition de la marge
  réelle négative, rappel qu'aucun match n'est supprimé). Appliqué aux
  trois versions (React, web, hors-ligne). Métriques inchangées.

---

## Procédé de mise à jour

Chaque évolution suit le même circuit : demande consignée → implémentation
dans les trois versions (app React, web, hors-ligne) → régénération web
(`tests/regen-web.sh`) → suite complète de tests (`tests/`) → CHANGELOG →
commit descriptif → push. Les métriques de référence (base 350 matchs :
att60 = 83, max 112, moy 54 ; finalesFin 93/124/57 ; poules→demis ≤ 150 min)
servent de garde-fous de régression.
