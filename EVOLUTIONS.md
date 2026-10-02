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

## 2026-10-01 — Lot 5 (v1.4)

### 1. Nom du tableau sur deux lignes dans la première colonne — ✅ implémenté (v1.4)

- **Demande** (capture de la vue « Structure des tableaux ») : « Au
  niveau de l'affichage peux-tu faire en sorte que le nom du tableau
  dans la première colonne tienne sur une ligne et non deux ? »
- **Analyse** : les badges de tableau des versions React et web
  n'interdisaient pas le retour à la ligne — sur iPad, « DX Série 1 »
  s'affichait « DX » puis « Série 1 ». La version hors-ligne avait déjà
  `white-space: nowrap` sur `.badge`.
- **Résolution** : les 4 badges des versions React et web passent en
  `whitespace-nowrap` (vue d'ensemble, planning par jour, en-têtes par
  classement/tableau) ; la colonne s'élargit, le tableau défile
  horizontalement si l'écran est étroit. Aucun changement moteur.

### 2. Confirmation du comportement « les deux jours » — ✅ validé (v1.3, sans changement)

- **Demande** : « Le DX 1 n'a pas besoin de démarrer tard le dimanche
  ou à la suite de l'horaire du samedi — les matchs peuvent être
  programmés en matinée ou ailleurs dans la journée. Est-ce ok aussi
  pour toi ? »
- **Analyse** : la capture fournie montrait l'état d'avant correctif
  v1.3 (demis du dimanche à 17:09, finale à 18:30 — le −118 min de la
  capture précédente). Le correctif v1.3 répond exactement au besoin :
  le jour 2 ne s'ancre plus sur l'horloge du jour 1 ; les matchs du
  tableau étalé démarrent à l'ouverture du jour (08:30) ou s'intercalent
  librement dans la journée selon la disponibilité des terrains.
- **Résolution** : rien à changer — comportement conforme (vérifié par
  `tests/deux-jours-test.js` : reprise à 08:30, ordre des tours, repos
  20 min, marge réelle dimanche positive).

---

## 2026-10-01 — Lot 6 : comptes, presets, thème dark

### 1. Sauvegarder une configuration de départ pour y revenir — ✅ implémenté (v1.5)

- **Demande** : « la possibilité de sauvegarder une configuration de
  départ pour y revenir ensuite ».
- **Proposition** : configurations nommées stockées sur l'appareil
  (localStorage, compatible iPad/hors-ligne) — « Enregistrer sous… »,
  « Charger », « Dupliquer », « Supprimer ». Sauvegarde automatique de
  la dernière configuration au moment de la génération. Export/import
  d'un fichier `.json` pour partager entre appareils. Contenu : jours
  (horaires, terrains, pauses, demis-finales en fin de journée),
  tableaux (discipline, classement, inscrits, format, jour(s), rondes,
  qualifiés), paramètres communs (durée, marge, combinaisons toxiques,
  thème).

### 2. Comptes utilisateurs (login + mot de passe) avec profils — ⏳ différé (v2.0), décision du juge-arbitre : « voir à l'usage »

- **Demande** : « créer des comptes utilisateurs avec des profils
  dédiés : admin (peut tout voir et tout modifier), organisateur (ne
  voit et ne peut modifier que son périmètre), puis un lien public
  pour voir juste le déroulé des journées ».
- **Analyse** : l'application est 100 % côté client (GitHub Pages,
  aucun serveur) — une vraie authentification multi-appareils impose
  une infrastructure (base + authentification). Deux trajectoires :
  - **Option A — profils locaux (recommandée d'abord)** : plusieurs
    profils sur l'appareil protégés par mot de passe local (garde-fou,
    données restant sur l'iPad) ; chaque organisateur a son périmètre
    (ses configurations/tableaux), l'admin voit et modifie tout ;
    « lien public » = export d'une page HTML autonome en lecture
    seule (déroulé des journées, aucune action), partageable par
    fichier ou publiée sur une URL dédiée. Aucune dépendance externe,
    hors-ligne, données personnelles minimales.
  - **Option B — backend hébergé** (nécessaire seulement si plusieurs
    organisateurs modifient simultanément depuis des appareils
    différents) : auth e-mail + mot de passe (ex. Supabase), tournois
    par organisateur, admin global, URL publique en lecture seule par
    tournoi. Coût : hébergement, protection des comptes (RGPD),
    complexité.
- **Proposition** : v2.0 = option A ; option B différée jusqu'à besoin
  réel démontré d'édition simultanée.

### 3. Thème d'affichage « dark » — ✅ implémenté (v1.5)

- **Demande** : « un thème d'affichage "dark" ».
- **Proposition** : palette sombre pilotée par les variables CSS (la
  version hors-ligne les utilise déjà ; React/web aligné), intégrée au
  sélecteur de thème existant (classique / Bad18 / dark).

### 4. Couleurs d'attentes et de marges identiques dans tous les thèmes — ✅ implémenté (v1.5)

- **Demande** : « pour chaque thème, les couleurs liées aux attentes
  estimées ou aux marges réelles doivent être les mêmes que dans le
  mode classique ».
- **Proposition** : palette **sémantique invariante** — les seuils
  d'attente (vert ≤ 1 h, ambre 1–2 h, rouge ≥ 2 h) et les marges
  (✓ vert / ⚠ rouge) conservent exactement leurs accents quel que
  soit le thème ; seul le fond général change. Contrôle automatisé
  dans la suite de tests.

### Phasage proposé

- **v1.5 — ✅ livrée (2026-10-01)** : presets de configuration + thème
  dark + palette sémantique invariante (ticket #10 excepté).
- **v2.0** : profils locaux (mot de passe local + périmètres) + page
  publique lecture seule par export — différé, décision du juge-arbitre
  (« voir à l'usage »).
- **v2.1+** (conditionnel) : backend multi-appareils si le besoin
  d'édition simultanée est confirmé.

---

## 2026-10-01 — Lot 7 : exempts du tableau final (v1.5.1)

Signalement du juge-arbitre : « le match 261 devrait être programmé après
le 263… les 1/4 avant les 1/2 ». Diagnostic : le moteur était correct (une
demi ne démarre jamais avant fin + repos de ses vraies sources), mais dans
les tableaux incomplets (ex. 6 qualifiés → tableau de 8), les tours
suivants référençaient les créneaux d'exempt par un « Vainqueur Tx-y »
fantôme — un quart inexistant — d'où l'impression d'un parallélisme
illégitime demi/quarter.

- **Correctif moteur** : les tours suivant le 1er tour d'un tableau final
  référencent désormais le qualifié exempté lui-même (plus jamais un
  « Vainqueur » de match jamais joué).
- **Exempts affichés** : mention « · N exempt(s) au 1er tour » ajoutée dans
  les descriptions des tableaux concernés (les 4 endroits par version).
- **Nouveau test** `byes-test.js` : 168 tableaux, 297 exempts, sources
  toutes réelles, invariant sources-fid (fin + repos 20 min) vérifié.

---

## 2026-10-01 — Lot 8 : ordre strict des tours d'un même tableau (v1.6)

Décision du juge-arbitre à la suite du diagnostic v1.5.1 : « il faut une
limite stricte pour un même tableau/classement, sinon certains joueurs ne
pourront pas jouer les 1/2 car ils n'auront pas encore disputé les 1/4 ».

- **Barrière stricte entre tours** : un tour r d'un tableau final attend
  que tous les matchs du tour r-1 du MÊME tableau soient terminés
  (`roundLeft` nul + barrière `roundEnd`). Fini le parallélisme
  demi/quart à l'intérieur d'un tableau ; il reste possible entre
  tableaux différents (joueurs disjoints).
- **1er tour ancré sur la fin des poules** : le 1er tour démarre après
  la FIN de la dernière poule/ronde du tableau + repos (règle déjà
  appliquée aux rondes suisses, unifiée pour tous les formats) — plus
  de quart qui démarre pendant la dernière ronde de poules.
- **Métriques de référence mises à jour** (garde-fous v1.6) : base
  350 matchs, att60 = 75, max 112, moy 51 ; finalesFin 77/112/52 ;
  poules→demis 132 min (≤ 150). L'ordre strict ne dégrade pas les
  attentes : la moyenne baisse (54 → 51).
- **Tests** : `byes-test.js` étendu — ordre strict vérifié sur tous
  les tableaux et tours du tournoi témoin (demi après la fin du
  dernier quart de son tableau, 1er tour après fin des poules + repos).

---

## 2026-10-01 — Lot 9 : ordre des jours + « Vainqueur N° » (v1.7)

Deux demandes du juge-arbitre : « les matchs du Dimanche devraient être
indiqués après ceux du samedi » et « plutôt que "Vainqueur T1-1",
indique le numéro de match dont il est vainqueur (ex. "Vainqueur 169") ».

- **Ordre canonique des jours** : tri `daySort` (samedi, dimanche, puis
  « jour 3 », « jour 4 »…) appliqué dans le moteur (planification,
  numérotation) et dans toutes les vues — une configuration enregistrée
  avec les jours dans un autre ordre ne change plus l'affichage ni
  les N° de matchs.
- **Libellés « Vainqueur <N°> »** : helper `vlbl` — une source fid du
  tableau final s'affiche par le numéro du match gagné (numérotation
  commune à toutes les vues et à l'export CSV) ; repli sur le code
  interne si le match source n'est pas planifié (forfait).
- **Nouveau test** `ordre-jours-test.js` (13 fichiers au total) :
  tri canonique, numérotation samedi avant dimanche sur une
  configuration inversée, libellés « Vainqueur <N°> », repli forfait.
- Métriques inchangées (v1.6 : att60=75, max 112, moy 51).

---

## 2026-10-01 — Lot 10 : correctif listes multi-jours (v1.7.1)

Le juge-arbitre signale que le dimanche s'affichait toujours avant le
samedi dans la vue « Par classement ». Diagnostic : les listes qui
mélangent les journées d'un même tableau (« les deux jours ») triaient
par heure seule — le dimanche 08:30 passait avant le samedi 17:43. La
v1.7 avait corrigé l'ordre des sections par jour, pas celui de ces
listes.

- **Helper `ordMatches`** : tri jour-d'abord (ordre canonique), puis
  heure, puis terrain — appliqué aux vues « Par classement » et
  « Par tableau » des trois versions.
- **Test étendu** `ordre-jours-test.js` : les-deux-jours — premier
  match du dimanche après tous ceux du samedi, ordre (jour, heure,
  terrain) croissant.

---

## 2026-10-01 — Lot 11 : analyse ITB7 + option « cadence par vagues » (v1.8)

Demandes (tickets #17 et #18) : consigner la restitution du tournoi
réel INTO THE BAD 7 (fait : `docs/analyse-itb7.md`), arbitrer les
suites A-M, puis implémenter B « cadence par vagues » avec étude
comparative contre la méthode actuelle — l'invariant étant qu'un
joueur/paire ne peut pas jouer son tour suivant sans un repos minimum
de 20 min.

| Demande | Décision | État |
|---|---|---|
| A. Test de reproduction ITB7 dans la suite | Retenu | Implémenté (v1.8) |
| B. Cadence par vagues + étude comparative | Retenu | Implémenté (v1.8) — le souple domine sur ITB7 |
| C. Créneaux différenciés par tour (34/60 min finales) | Retenu, en option dans les paramètres | À faire |
| D. Optimisation locale (fonction de coût réglable) | Différé | À reproposer plus tard |
| E. Import d'inscriptions réelles + seed par cote | Différé | À reproposer plus tard |
| F. Durées par discipline (simple vs double) | Retenu | À faire |
| G. Terrains variables en cours de journée (± X/Y avec heure de changement) | Retenu | À faire |
| H. Vue « mon planning joueur » | Différé (conditionné à E) | En attente |
| I. Suivi direct enrichi (dérive cumulée, replanification) | Retenu | À faire |
| J. Disponibilités par joueur | Différé (conditionné à E) | En attente |
| K. Mode what-if | Retenu | À faire |
| L. Export PDF officiel + écrans de salle | Retenu | À faire |
| M. Profils utilisateurs / lien public | Différé — v3.0 | En attente |

- **Implémentation B** : 8ᵉ argument `cadence` de `computePlan`
  (0 → 1). À mi-course, battement minimal interpolé entre la fin du
  tour précédent d'une poule et le début du suivant (20 min → durée
  d'un créneau) ; à 1, vague stricte par tableau (le tour r attend la
  fin du tour r-1 du tableau entier). Sélecteur dans les paramètres des
  trois versions, inclus dans snapshot/import JSON. Repos 20 min
  garanti dans tous les cas.
- **Étude comparative (rejeu ITB7, 308 matchs)** : souple 89 attentes
  ≥ 1 h (max 136, moy 65), samedi fini 22:41 ; vagues strictes 132
  attentes ≥ 1 h (max 204, moy 92), samedi 23:15, dimanche 18:14.
  Conformément au critère retenu (« ne retenir une méthode que si elle
  finit plus tôt à contraintes égales ou réduit sensiblement les
  attentes ≥ 1 h sans retarder la fin »), **l'hypothèse de travail est
  invalidée par la mesure sur ce scénario** : l'entrelacement souple à
  démarrage progressif gagne du temps et réduit les attentes ; les
  vagues strictes ne conservent comme avantage que la régularité
  organisationnelle du rythme (et −20 min sur la fin du dimanche).
  Le souple reste donc le comportement par défaut, l'option est
  disponible au cas par cas.
- **Test A** : `tests/itb7-test.js` — structure 23/23 identique
  (187/121 matchs, exempts inclus), invariants, fenêtres vs BadNet,
  rejeu aux trois réglages de cadence.

---

## 2026-10-01 — Lot 12 : tableau de bord statistique (v1.9)

- **Demande** : restituer en un clic les statistiques principales du
  tournoi — joueurs H/F estimés, paires, matchs prévus, durées moyennes,
  temps d'attente et tout indicateur utile, via un bouton dédié.
- **Réponse** : bouton « 📊 Statistiques » dans l'en-tête de l'écran
  tournoi (les trois versions), panneau déroulant dérivé d'une fonction
  moteur pure `statsSummary(plan, jours, durée, marge)` : inscrits
  estimés ventilés H/F par discipline (SM→H, SD→F, DM→2 H, DD→2 F,
  DX→1 H + 1 F par paire), paires par type, engagements, matchs et
  formats de tableau, exempts/W.O./non planifiés, temps de jeu total et
  moyenne par engagement, attentes (moy/max/≥ 1 h + répartition par
  palier aux couleurs de la légende + vue joueurs/paires), et tableau
  par jour (matchs, poules/finales, créneau, occupation des terrains,
  marge réelle, attentes).
- **Limite assumée** : joueurs anonymes → effectifs estimés par
  engagement (un joueur multi-tableaux est compté plusieurs fois) ;
  le dédoublonnage arrivera avec l'import des inscriptions (suite E).
- **Test** : `tests/stats-test.js` — valeurs de référence (180 H /
  180 F, 135 paires, 360 engagements, attentes 51/112/75 alignées sur
  `metrics.js`), reproduction ITB7 (234 H / 127 F, 133 paires,
  361 engagements, 187 + 121 matchs), W.O. comptés, cohérence interne
  (paliers = attentes, jours = disciplines = total, occupation 0-100 %).

---

## 2026-10-02 — Lot 13 : notes dépliables (v1.10)

- **Demande** : masquer tous les textes explicatifs, notes et
  informations ; pouvoir en lire une en la dépliant.
- **Réponse** : chaque note devient une poignée « ℹ️ + libellé » à
  bordure pointillée qui se déplie d'un clic (`<details>`/`<summary>`
  natifs, aucune donnée d'état). Couverture : écran configuration
  (fonctionnement, journée, repos/appel, marge de sécurité, explication
  des combinaisons toxiques — la case à cocher reste visible —,
  demis/finales, configurations enregistrées, estimation de capacité,
  tableaux sur deux jours, détail par tableau hors-ligne) et écran
  tournoi (légende des attentes, notes du tableau de bord statistique,
  parcours, vue par classement).
- **Hors périmètre** : bulles d'alerte/notifications (⚠️ / ✅), cartes
  d'indicateurs, libellés de saisie, contenus des vues — inchangés.
- **Impression/PDF** : les notes repliées n'apparaissent pas.
- **Thèmes** : poignée verte (classique), rouge (Bad18), bleu ciel
  (dark) — même mécanique que v1.9.1.
- **Tests** : aucun nouveau fichier (UI pure) — suite 15/15 verts,
  dont les 15 840 + 19 012 cas de rendu et les 95 contrôles hors-ligne
  (les textes des notes restent présents dans le DOM, simplement
  repliés).

---

## Procédé de mise à jour

Chaque évolution suit le même circuit : demande consignée → implémentation
dans les trois versions (app React, web, hors-ligne) → régénération web
(`tests/regen-web.sh`) → suite complète de tests (`tests/`) → CHANGELOG →
commit descriptif → push. La suite compte 15 fichiers de test (dont
`presets-test.js` depuis la v1.5, `byes-test.js` depuis la v1.5.1 —
étendu en v1.6 pour l'ordre strict des tours —, `ordre-jours-test.js`
depuis la v1.7, `itb7-test.js` depuis la v1.8 et `stats-test.js`
depuis la v1.9). Les métriques de
référence depuis
la v1.6 (base 350 matchs : att60 = 75, max 112, moy 51 ; finalesFin
77/112/52 ; poules→demis ≤ 150 min) servent de garde-fous de régression.
