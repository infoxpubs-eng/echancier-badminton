# CHANGELOG

## 2026-09-30 — Dépôt initial (v1.0)

Échéancier prédictif de tournoi de badminton : moteur de planification
(poules + élimination directe), ordonnancement avec repos minimum, pause
déjeuner, démarrage progressif des tableaux, suivi direct avec W.O.,
export CSV, impression, thème Bad18.

### Correctifs et améliorations intégrés à cette version

1. **Défilement du formulaire (hors-ligne)** : la page ne remonte plus en
   haut à chaque saisie ; la position est conservée pendant l'édition,
   le retour en haut n'a lieu que lors d'un changement d'écran.
2. **Format « ronde suisse »** : nouvelle option par tableau, seule ou
   suivie d'un tableau final ; appariement simulé par rotation (Berger),
   rondes réglables, une ronde ne démarre qu'une fois la précédente
   terminée.
3. **Exempts** : 1 exempt par ronde en ronde suisse si effectif impair,
   rotation sans répétition, liste affichée dans le détail du tableau.
4. **Champ « Qualifiés élim. »** : plafond de 4 retiré en ronde suisse +
   élimination directe (jusqu'à 8 qualifiés → tableau final de 8).
5. **Export CSV sur iPad/Safari** : l'ancre de téléchargement est
   attachée au document avant le clic (exigence iOS).
6. **Attente totale** : le badge d'attente inclut désormais le repos de
   20 min (temps total depuis la fin du match précédent du joueur/de la
   paire), et en tableau final il mesure le qualifié **le plus attendu**
   (celui dont la source a fini le plus tôt) — cohérent avec les poules
   et rondes suisses. Info-bulles et légende mises à jour.
7. **Libellés de tours corrigés** : chaque tour est nommé d'après la
   **structure du tableau** (nombre de matchs du tour, exempts compris)
   et non le nombre de matchs réellement joués. Un premier tour de
   bracket de 64 avec 34 engagés s'affiche « 1/32 Finale » (2 matchs
   réels + 30 exempts) au lieu du « 1/2 Finale » erroné. Support ajouté
   jusqu'au 1/64. Parcours et libellés de reprise J2 alignés.

### Métriques de référence (régression)

Base défaut (25 tableaux, 350 matchs) : att60 = 83 · attente max = 112 min ·
moyenne = 54 min. Option « demis et finales en fin de journée » : 93/124/57.
Attente max poules → demis (finales en fin de journée) : 124 min (cible ≤ 150).

## 2026-10-01 — Index de matchs, délais de phase, marge réelle, fonds colorés (v1.1)

1. **Numéro de match (colonne « N° »)** : chaque match reçoit un index
   chronologique de 1 à la fin du tournoi (jour → heure → terrain), affiché
   entre « Terrain » et « Tableau » dans le planning par jour, et entre
   « Terrain » et « Tour » dans les vues par classement et par tableau.
   Le même index désigne le même match dans toutes les vues et dans
   l'export CSV.
2. **Délais de transition de phase (badge « ≈ »)** : les premiers matchs
   d'élimination directe issus des poules ou des rondes suisses n'ont pas
   d'attente individuelle mesurable (ils affichaient « — »). Ils affichent
   désormais le délai entre la fin estimée du dernier match de la phase
   précédente du tableau et leur début — badge italique « ≈ 45 min »,
   info-bulle dédiée. L'attente individuelle (badge plein) reste inchangée,
   ainsi que toutes les métriques de référence (att60 = 83, max 112, moy 54).
3. **Marge réelle dans l'estimation de capacité** : l'estimation de capacité
   de l'écran de configuration affiche désormais deux colonnes
   supplémentaires — « Planifié » (matchs réellement planifiés) et
   « Marge réelle » (minutes entre la fin effective du plan et l'horaire
   de fermeture). La « Marge » théorique suppose les terrains occupés en
   continu ; le repos de 20 min, l'appel, l'alternance des tours et les
   pauses consomment de la capacité : une marge théorique positive ne
   garantit plus que tout se joue dans l'horaire — la marge réelle le dit.
   Un avertissement signale les matchs non planifiables.
4. **Fond coloré par tableau** : dans les vues « Par classement » et par
   tableau, l'en-tête de chaque tableau est teinté du code couleur des
   attentes selon l'attente maximale combinée du tableau (attentes
   individuelles + délais ≈), avec la valeur « attente max » affichée.

Toutes les vues, la version hors-ligne (iPad), la version web et l'export
CSV sont alignés. Suite de tests étendue : render-views (N° uniques et
croissants, délais ≈ cohérents, attente max combinée), render-config
(marge réelle sur 4 scénarios), hors-ligne 95 contrôles (84 → 95).

## 2026-10-01 — Estimation de capacité clarifiée (v1.2)

Question du juge-arbitre : « Comment est calculé le −201 ? Pour le
dimanche, tous les matchs ne semblent pas pris en compte. »

1. **Décomposition « deux-jours » dans « Planifié »** : la colonne
   « Planifié » affiche désormais le nombre de matchs venant de tableaux
   non fixés à ce jour (« les deux jours ») sous la forme
   « 68 (11 deux-jours) », avec une info-bulle détaillant la
   décomposition (deux-jours vs fixés au jour). C'est la cause de
   l'écart constaté : « Besoin fixe » ne compte que les tableaux
   affectés à CE jour, alors que les tableaux « les deux jours » se
   planifient en partie chaque jour.
2. **Info-bulles d'en-tête explicites** : « Besoin fixe », « Marge »,
   « Planifié » et « Marge réelle » expliquent chacune leur calcul.
   « Marge » est signalée comme théorique (capacité − besoin fixe
   uniquement) : ne pas s'y fier pour savoir si la journée tient.
3. **Explication du signe négatif** : une « Marge réelle » négative
   signifie que le dernier match planifié finit après la fermeture
   (ex. −201 min = fermeture 17:00, dernier match 20:21). **Aucun match
   n'est supprimé** : le moteur planifie tout, même au-delà de
   l'horaire, et l'écran tournoi le signale (⚠️ horaire de fin modifié).

Aucune modification du moteur ni des métriques de référence
(att60 = 83, max 112, moy 54) : amélioration d'affichage uniquement,
alignée sur les trois versions (React, web, hors-ligne).

## 2026-10-01 — Reprise du jour 2 ancrée sur l'horloge du jour 1 (v1.3)

Question du juge-arbitre : « Samedi 155 matchs sur 228 mais marge réelle
+178 min ; dimanche 57 matchs sur 145 mais marge réelle −118 min. Le
calcul porte-t-il bien sur chacun des jours ? Si je n'étale pas le DX 1
sur deux jours, c'est plus cohérent. »

1. **Diagnostic** : le calcul de la marge réelle est bien **par jour**
   (fermeture du jour − fin du dernier match planifié ce jour-là) ;
   c'est la planification qui était fausse. Pour un tableau « les deux
   jours », les matchs du jour 2 héritaient de l'horloge absolue du
   jour 1 : une source finie à 17:42 samedi imposait la reprise des
   demis à 18:02 dimanche (17:42 + 20 min de repos), alors que le repos
   de la nuit est acquis. D'où le tableau incohérent de la capture :
   samedi sous-rempli (+178) et dimanche « débordant » (−118) avec
   seulement 57 matchs — la finale jouée à 18:30 le dimanche.
2. **Correctif moteur** : une source jouée un **autre jour** ne
   contraignait plus l'heure de reprise — le match du jour 2 démarre à
   l'ouverture du jour. L'attente individuelle d'une source de la veille
   n'est plus mesurable (badge « — ») au lieu d'hériter d'un délai
   erroné ; le badge « ≈ » (délai de phase) ne compare plus qu'aux
   poules du même jour.
3. **Tests** : nouvel invariant dans `rest-test` et `render-views`
   (l'intercalage finale/sources ne s'applique qu'aux sources du même
   jour — le repos de nuit est acquis) ; nouveau `deux-jours-test.js`
   (11 contrôles : reprise à l'ouverture 08:30, tours ordonnés, repos
   20 min, attente des demis non mesurable, marge réelle dimanche
   positive — échoue sur le moteur d'avant correctif).

Le diagnostic de l'utilisateur était juste : sans étaler le DX 1, le
problème disparaissait (aucune dépendance inter-jours). Après correctif,
étaler un tableau sur deux jours redevient cohérent : le jour 2 reprend
à l'ouverture, toutes vues alignées (React, web, hors-ligne).

## 2026-10-01 — Nom du tableau sur une seule ligne (v1.4)

Demande du juge-arbitre (capture de la vue « Structure des tableaux ») :
« Peux-tu faire en sorte que le nom du tableau dans la première colonne
tienne sur une ligne et non deux ? »

1. **Badge de tableau insécable** : dans la version React et la version
   web, le nom du tableau (« DX Série 1 ») se répartissait sur deux
   lignes à l'intérieur du badge coloré (« DX » puis « Série 1 ») dès
   que la colonne était étroite (iPad). Les 4 badges (vue d'ensemble,
   planning par jour, en-têtes des vues par classement/tableau)
   deviennent insécables (`whitespace-nowrap`) : la colonne s'élargit
   et le tableau défile horizontalement si nécessaire. La version
   hors-ligne disposait déjà de la règle (`white-space: nowrap` sur
   `.badge`) — aucun changement moteur ni de données, métriques
   inchangées.

## 2026-10-01 — Configurations enregistrées, thème dark, palette invariante (v1.5)

Demandes du juge-arbitre (feuille de route, lot 6 — `EVOLUTIONS.md`) :
sauvegarder une configuration de départ pour y revenir ensuite ; un
thème d'affichage « dark » ; pour chaque thème, les couleurs liées aux
attentes estimées ou aux marges réelles identiques au mode classique.

1. **Configurations enregistrées** : nouvelle carte « 💾
   Configurations enregistrées » à l'écran de configuration — nommez et
   enregistrez la configuration courante (jours, tableaux, durées et
   marges, options, thème), rechargez-la plus tard ou supprimez-la.
   **Export/Import `.json`** pour archiver ou transférer une
   configuration entre appareils. **« Dernière (auto) »** : sauvegarde
   automatique écrasée à chaque génération de l'échéancier — on peut
   toujours revenir à la configuration qui a produit l'échéancier.
   Stockage sur l'appareil (localStorage) avec repli mémoire : aucune
   donnée ne quitte l'appareil. Disponible dans les trois versions
   (React, web, hors-ligne).
2. **Thème « Dark (sombre) »** : troisième entrée du sélecteur de
   thème (Classique / Bad18 / Dark) — fond bleu nuit, textes et
   accents clairs, lisible de nuit ou en salle sombre, sans changement
   moteur ni de données.
3. **Palette sémantique invariante** : les couleurs des attentes
   (tranches vert → rouge) et des marges réelles (✓ vert / ⚠ rouge)
   sont désormais **strictement identiques dans tous les thèmes**.
   Correctif inclus : le thème Bad18 recolorait encore les badges
   d'attente (les seuils verts devenaient rouges par héritage de
   palette) — les attentes utilisent maintenant des classes dédiées
   `attb-1..5` (React/web) et les marges de l'estimation comme les
   avertissements « ⚠️ horaire de fin modifié » deviennent des
   pastilles à couleurs fixes, insensibles au thème. Seul l'habillage
   (fonds, bordures, textes) change avec le thème.
4. **Nouveau test** `tests/presets-test.js` : 21 contrôles
   (enregistrement/chargement/suppression, auto-save, export/import
   JSON, thème dark, invariance des couleurs).

Aucun changement moteur ni de données : métriques inchangées
(att60=83, attMax=112, attMoy=54 ; 350 matchs).

## 2026-10-01 — Ordre des tours du tableau final : exempts fantômes (v1.5.1)

Signalement du juge-arbitre (captures d'écran DM Série 4 et SM Série 2) :
« le match 261 devrait être programmé après le 263 car le 261 et 279
dépendent des 249 et 263, en somme les 1/4 avant les 1/2 — il en va de
même pour les 1/8 qui doivent être joués avant les 1/4 ».

1. **Diagnostic** : la planification est correcte — une demi-finale ne
   démarre jamais avant la fin + repos (20 min) de SES deux sources
   réelles (invariant vérifié par les tests). L'incohérence venait de
   l'affichage : dans un bracket incomplet (ex. 6 qualifiés → bracket
   de 8, 2 exempts), les tours suivants référençaient les exempts par
   « Vainqueur T1-2 » / « Vainqueur T1-3 » — des matchs **jamais joués
   ni affichés**. La demi « 261 » affichait donc deux vainqueurs de
   matchs alors qu'un seul quart l'alimente : elle semblait dépendre
   du quart joué en parallèle (« 263 »), d'où la lecture fausse d'un
   ordre 1/2 avant 1/4.
2. **Correctif moteur (affichage de la structure)** : un exempt du
   1er tour n'est plus référencé par un match fantôme — le tour
   suivant référence le qualifié lui-même : la demi affiche
   désormais « Vainqueur T1-1 contre 1er poule 2 » (l'exempt = tête de
   série issue des poules), rendant visible qu'elle ne dépend que du
   quart T1-1 ; l'autre quart (T1-4) alimente l'autre demi et peut se
   jouer en parallèle — c'est la règle du bracket, pas une anomalie.
   Corrigé dans les trois versions (React, web, hors-ligne).
3. **Exempts visibles dans les descriptions** : les tableaux affichent
   désormais « · N exempt(s) au 1er tour » (cartes de configuration,
   vue par tableau) — ex. DM Série 4 : « 2 exempts », SM Série 2 :
   « 4 exempts ».
4. **Nouveau test** `tests/byes-test.js` : 168 tableaux testés (3 à 30
   inscrits, poules et rondes suisses, 1 à 3 sortants/poule) — aucune
   source « Vainqueur Tx-y » fantôme, exempts référencés comme
   qualifiés, invariant temporel fin + repos 20 min sur toutes les
   sources, dénombrement des exempts conforme.

Aucun changement de planification ni de données : métriques
inchangées (att60=83, attMax=112, attMoy=54 ; 350 matchs).

## 2026-10-01 — Ordre strict des tours d'un même tableau (v1.6)

Décision du juge-arbitre (suite du signalement v1.5.1) : « il faut une
limite stricte pour un même tableau/classement, sinon certains joueurs
ne pourront pas jouer les 1/2 car ils n'auront pas encore disputé les
1/4 ».

1. **Barrière stricte entre tours** : dans un même tableau final, un
   tour ne démarre plus « dès que ses sources sont terminées » — il
   attend que **tous les matchs du tour précédent du tableau soient
   terminés**. Les 1/8 se jouent avant les 1/4, les 1/4 avant les 1/2,
   les 1/2 avant la finale, sans aucun chevauchement de tours dans un
   même tableau. Le parallélisme reste possible **entre tableaux
   différents** (les joueurs ne se rencontrent pas).
2. **1er tour ancré sur la fin des poules** : le premier tour du
   tableau final ne démarrait qu'une fois tous les matchs de poules
   *planifiés* — il pouvait donc démarrer pendant que la dernière
   ronde de poules se jouait. Il démarre désormais après la **fin
   effective de la dernière poule/ronde du tableau + repos** : un
   qualifié a forcément terminé tous ses matchs de poule avant le
   premier tour. La règle, déjà appliquée aux rondes suisses, est
   unifiée pour tous les formats.
3. **Tests étendus** (`tests/byes-test.js`) : ordre strict vérifié sur
   tous les tableaux et tous les tours du tournoi témoin (demi après
   la fin du dernier quart du tableau, 1er tour après fin des poules
   + repos), en plus des contrôres v1.5.1.
4. **Nouvelles métriques de référence** (base 350 matchs) :
   att60 = 75 · attente max = 112 min · moyenne = 51 min ;
   « demis et finales en fin de journée » : 77/112/52. Attente max
   poules → demis (finales fin de journée) : 132 min (cible ≤ 150).
   L'ordre strict ne dégrade pas les attentes : au contraire, la
   moyenne baisse (54 → 51 min) car les tours regroupés réduisent
   les attentes résiduelles.

## 2026-10-01 — Dimanche après samedi, « Vainqueur 169 » (v1.7)

Deux demandes du juge-arbitre (capture d'écran : les matchs du dimanche
s'affichaient avant ceux du samedi ; sources du tableau final libellées
« Vainqueur T1-1 »).

1. **Ordre canonique des jours** : les jours suivent désormais l'ordre
   samedi → dimanche → « jour 3 », « jour 4 »…, quelle que soit
   l'ordre de saisie ou l'ordre enregistré dans une configuration
   (JSON) — une clé « dimanche » placée avant « samedi » ne change
   plus rien. Corrigé au niveau du moteur : la planification, toutes
   les vues (planning, synthèse, par classement, par tableau), l'écran
   de configuration et l'export CSV affichent le samedi en premier, et
   la **numérotation des matchs** (N° 1 → fin du tournoi) suit le même
   ordre — les numéros du dimanche ne précèdent plus ceux du samedi.
2. **« Vainqueur 169 » au lieu de « Vainqueur T1-1 »** : une source du
   tableau final s'affiche désormais par le **numéro du match gagné**
   (le même N° que dans toutes les vues et l'export) : « Vainqueur 169
   contre Vainqueur 170 ». Le juge-arbitre retrouve ainsi la source
   directement dans l'échéancier, sans décoder le code interne Tx-y.
   Repli sur le code interne uniquement si le match source n'est pas
   planifié (forfait W.O.). Appliqué dans le planning, les vues par
   classement et par tableau, et l'export CSV.
3. **Nouveau test** `tests/ordre-jours-test.js` : tri canonique des
   jours (dimanche saisi avant samedi, « jour 3 »/« jour 4 »),
   numérotation samedi avant dimanche sur une configuration inversée,
   libellé « Vainqueur <N°> » conforme à la numérotation de
   l'échéancier, libellé des sources qualifiées inchangé, repli
   forfait.

Aucun changement de planification : métriques de référence inchangées
(att60=75, attMax=112, attMoy=51 ; finalesFin 77/112/52 ; 350 matchs).

## 2026-10-01 — Correctif : dimanche avant samedi dans les vues multi-jours (v1.7.1)

Le juge-arbitre signale que la v1.7 ne réglait pas le problème dans la
vue « Par classement » (capture d'écran : les matchs du dimanche —
N° 183-185, 08:30 — s'affichaient avant ceux du samedi — N° 150-165,
17:43+). Cause : ces listes triaient les matchs d'un tableau « les deux
jours » par **heure seule** — le dimanche 08:30 passait donc avant le
samedi 17:43. La v1.7 avait corrigé l'ordre des sections par jour
(planning, configuration, numérotation) mais pas celui des listes qui
mélangent les journées d'un même tableau.

1. **Tri jour-d'abord** : les vues « Par classement » et « Par tableau »
   trient désormais par jour (ordre canonique), puis heure, puis
   terrain — tous les matchs du samedi dans l'ordre, puis ceux du
   dimanche, puis des jours suivants. Nouveau helper moteur
   `ordMatches` partagé par les trois versions.
2. **Test étendu** (`tests/ordre-jours-test.js`) : un tableau « les
   deux jours » vérifie que le premier match du dimanche arrive après
   tous ceux du samedi et que l'ordre (jour, heure, terrain) est
   croissant.

## 2026-10-01 — Option « cadence par vagues » + reproduction ITB7 (v1.8)

Restitution du tournoi réel INTO THE BAD 7 (13-14 juin 2026, Paris,
8 terrains, créneaux de 34 min) depuis son échéancier officiel BadNet
v5.0 : structure reproduite à l'identique (23 tableaux, 187 matchs
samedi + 121 dimanche, poules de 3 à 1-2 sortants, poules uniques de 4
et de 5, brackets à 2 exempts) et programmation équivalente (samedi
22:41 vs ~22:47, dimanche 18:34 vs ~18:26 ; tout tient, zéro W.O.).
Analyse comparative complète dans `docs/analyse-itb7.md` ; décisions
sur les suites : tickets #17 (clôt) et #18.

1. **Nouveau test de régression** `tests/itb7-test.js` (14ᵉ fichier) :
   reconstitution du tournoi complet depuis le PDF BadNet, garde-fous de
   structure (nombre de matchs par tableau identique à BadNet, 187/121),
   invariants (repos 20 min, ordre strict des tours, sources-fid),
   fenêtres par tableau comparées à la référence, et rejeu du tournoi à
   chaque réglage de cadence.
2. **Option « cadence par vagues »** (paramètre des trois versions) :
   `Souple (défaut)` = entrelacement actuel, priorité au joueur qui
   attend le plus ; `Resserrée` = battement régulier interpolé
   (20 min → durée d'un créneau) entre les tours d'une même poule ;
   `Vagues strictes` = le tour r d'un tableau démarre après la fin du
   tour r-1 du tableau entier (rythme cadencé type BadNet). Le repos
   minimum de 20 min reste garanti dans tous les cas ; comportement par
   défaut inchangé (8ᵉ argument de `computePlan`, inclus dans les
   configurations enregistrées et l'export JSON).
3. **Étude comparative (rejeu ITB7)** — cadence vs méthode actuelle :

   | réglage | fin sam | fin dim | att ≥ 1 h | attMax | attMoy |
   |---|---|---|---|---|---|
   | Souple (défaut) | 22:41 | 18:34 | 89 | 136 | 65 |
   | Resserrée (battement 27 min) | 22:41 | 18:41 | 89 | 136 | 65 |
   | Vagues strictes | 23:15 | 18:14 | 132 | 204 | 92 |

   Conclusion : sur ce scénario, l'entrelacement à démarrage progressif
   gagne du temps (samedi −34 min) et réduit nettement les attentes
   (89 vs 132 attentes ≥ 1 h) ; les vagues strictes n'améliorent que la
   fin du dimanche (−20 min). Le souple reste le défaut ; l'option est
   disponible pour un juge-arbitre privilégiant un rythme cadencé.

Aucun changement de planification par défaut : métriques de référence
inchangées (att60=75, attMax=112, attMoy=51 ; 350 matchs).

## 2026-10-01 — Tableau de bord statistique (v1.9)

Nouveau bouton « 📊 Statistiques » dans l'en-tête de l'écran tournoi
(versions web, React et hors-ligne) : affiche/masque un tableau de bord
de restitution chiffrée du tournoi, dérivé intégralement du plan et des
effectifs saisis — aucune donnée supplémentaire à saisir.

1. **Inscrits estimés (H/F)** — joueurs H et joueuses F ventilés par
   discipline (SM→H, SD→F, DM→2 H/paire, DD→2 F/paire, DX→1 H + 1 F par
   paire), paires totales et par type, engagements. Joueurs anonymes :
   un joueur engagé dans plusieurs tableaux est compté une fois par
   tableau (estimation, pas un dédoublonnage — attendu avec l'import
   des inscriptions, suite E).
2. **Matchs et tableaux** — total planifié, formats (poules/uniques/
   directs/suisses), exempts, W.O., non planifiés, répartition par
   discipline.
3. **Durées** — temps de jeu total (heures) et moyenne par engagement.
4. **Attentes** — moyenne/maximum/≥ 1 h sur les badges de matchs, avec
   répartition par palier (< 30 min, 30 min–1 h, 1 h–1 h30, 1 h30–2 h,
   ≥ 2 h, mêmes pastilles que la légende), et vue joueurs/paires.
5. **Par jour** — matchs, poules/finales, créneau effectif, temps de
   jeu, occupation des terrains ( %), marge réelle à la fermeture,
   attentes moyenne/max/≥ 1 h.

Ajout moteur : fonction pure `statsSummary(plan, jours, durée, marge)`
(ES5-compatible, partagée par les trois versions). Nouveau test
`tests/stats-test.js` (15ᵉ fichier de la suite) : valeurs de référence
(180 H / 180 F, 135 paires, 360 engagements, attentes 51/112/75),
reproduction ITB7 (234 H / 127 F, 133 paires, 361 engagements, 187+121
matchs), W.O. comptés, et invariants de cohérence (paliers = attentes
mesurées, jours = disciplines = total, occupation bornée 0-100 %).

Aucun changement de planification ni de métriques de référence :
15/15 tests verts (suite `suite-v19.sh`).

## Feuille de route (mise à jour 2026-10-01)

Demandes consignées (détail et analyse dans `EVOLUTIONS.md`, lot 6) :

- **v1.5 — livrée ci-dessus** — configurations nommées + export/import
  `.json` + auto-save « Dernière (auto) » ; thème « dark » ; palette
  **sémantique invariante** (couleurs d'attentes et de marges réelles
  identiques dans tous les thèmes).
- **v2.0 — différé (décision du juge-arbitre : « voir à l'usage »)** —
  profils utilisateurs avec mot de passe local : admin (voit et modifie
  tout), organisateur (périmètre restreint) ; lien public en lecture
  seule (déroulé des journées) par export d'une page autonome.
  Architecture sans serveur recommandée d'abord ; backend
  multi-appareils seulement si besoin d'édition simultanée confirmé.

Ticket GitHub ouvert : #10 (comptes/profils + lien public, différé).
Tickets fermés : #9 (presets), #11 (thème dark), #12 (couleurs
invariantes par thème) — résolus par la v1.5.
