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
