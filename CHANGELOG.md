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
