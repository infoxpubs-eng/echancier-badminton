# INTO THE BAD 7 (2026) — Restitution comparative

**Tournoi** : INTO THE BAD 7 (2026), Paris, Centre Sportif Micheline Ostermeyer, 13-14 juin — 8 terrains, créneaux de 34 min.
**Source** : échéancier officiel BadNet v5.0 (PDF, 5 pages).

## 1. Reproduction du tournoi — résultats

Le tournoi complet a été reconstruit dans le moteur de l'échéancier (v1.7.1) à partir du PDF BadNet, puis re-planifié avec les mêmes bornes (8 terrains, créneaux 34 min, repos min 20 min, ordre strict des tours).

### Structure : identique à 100 %

- **23/23 tableaux** avec exactement le même nombre de matchs que BadNet (poules, tours, brackets, exempts confondus).
- Samedi : **187 matchs** · dimanche : **121 matchs** — comme BadNet.
- Formats particuliers reproduits sans écart : poules de 3 (1 ou 2 sortants), poules de 4, **poule unique de 5** (MX N2-N3), brackets incomplets à 2 exempts.

### Programmation : équivalente

| | Notre moteur | BadNet |
|---|---|---|
| Samedi | 08:45 → **22:41** | 08:45 → ~22:47 |
| Dimanche | 08:30 → **18:34** | 08:30 → ~18:26 (ou 18:52, cf. limites) |

Écart : −6 min samedi, +8 min dimanche — de l'ordre du bruit sur ~308 matchs. Tout tient dans les deux cas (aucun match non planifié, zéro W.O.).

### Organisation des journées

- **BadNet sérialise par vagues régulières** : tous les tours 1, puis tous les tours 2, discipline par discipline (SH le matin, MX l'après-midi, SD et SH R6-D7 le soir) ; créneaux de 60 min pour les vagues finales.
- **Notre moteur entrelace** avec démarrage progressif : chaque tableau démarre dès qu'un terrain se libère. Plusieurs tableaux finissent plus tôt chez nous (ex. dimanche DM P10-NC : 15:18 vs 16:52), d'autres plus tôt chez BadNet (samedi SM P10-NC : 15:33 vs 17:15, priorisé le matin).
- **Repos** : ~34 min effectif chez BadNet entre tours consécutifs d'une même poule ; 20 min minimum garanti chez nous (plus serré).

### Temps d'attente

| | Notre moteur | BadNet (estimé, structure) |
|---|---|---|
| Attente max | **136 min** (exempts de bracket) | ~102-136 min (sauts de tour, exempts) |
| Attente moyenne | **55 min** (joueurs de poules) | ~45-55 min |
| Attentes ≥ 1 h | **89** | ~65 |
| Battement consécutif | 34-68 min (repos min 20) | 34 min réguliers |

Lecture : BadNet, par ses vagues cadencées, offre un rythme très régulier. Notre moteur optimise globalement (priorité au joueur qui attend le plus) mais laisse plus d'attentes résiduelles ≥ 1 h (sauts de tour dans les poules de 3, exempts de bracket). Aucune des deux approches ne domine sur tous les critères.

## 2. Limites de la comparaison

1. **Joueurs anonymes dans le PDF** : les attentes BadNet sont estimées à partir de la structure (34 min consécutif, 102 min en cas de saut de tour, 68 min quart → demi, 136 min pour un exempt). Une comparaison exacte suppose les données BadNet (noms + heures réelles).
2. **Vagues finales BadNet espacées de 60 min** (21:13 → 22:13 samedi ; 16:52 → 17:52 dimanche) : la fin réelle du dimanche est 18:26 (créneau 34) ou 18:52 (créneau 60) selon l'interprétation.
3. **Numérotation** : les n° BadNet sont structurels (par poule), pas chronologiques ; les nôtres chronologiques.
4. Un match MX N2-N3 illisible (OCR) mais le total de 187 matchs confirme la structure (poule unique de 5 = 10 matchs).

## 3. Améliorations imaginables (question 1)

Court terme :
- Durée par discipline (simple vs double) et par tour (créneau renforcé pour les finales, comme BadNet).
- Nombre de terrains variable en cours de journée (le club libère 2 terrains à 17:00).
- Import d'inscriptions réelles (CSV : noms, cotes min/max) et seed du bracket par cote plutôt que par classement de poule.
- Suivi direct enrichi : heure réelle de fin saisie → dérive cumulée affichée, re-planification automatique.

Moyen terme :
- Contraintes de disponibilité par joueur (« pas avant 10:00 »).
- Mode what-if : ajouter/enlever un tableau et voir l'impact sur les métriques avant de valider.
- Export PDF officiel (grille terrains × horaires) et affichage écrans de salle.
- Profils utilisateurs / lien public (déjà différé, ticket #10).

## 4. Évoluer la priorisation sous contraintes terrains/horaires (question 2)

Les bornes (terrains, horaires, repos 20 min, ordre strict des tours v1.6) ne bougent pas : le seul levier est **l'ordre et l'affectation**. Trois niveaux, du plus simple au plus puissant :

1. **Paramètre « cadence par vagues »** : resserrer les tours d'une même poule à un battement régulier (comportement BadNet) au lieu de l'entrelacement souple actuel. Réglable de 0 (souple) à 1 (vagues strictes). Effet attendu : moins d'attentes ≥ 1 h, au prix de fins de tableaux un peu plus tardives.
2. **Créneaux différenciés par tour** : 34 min en poules/quarts/demis, 60 min en finale — sécurise les finales sans changer les bornes.
3. **Optimisation locale après planification gloutonne** (hill-climbing / recuit simulé) : échanger des créneaux pour minimiser une fonction de coût réglable — attente max (équité), attente moyenne (efficacité), ou heure de fin. Chaque échange validé par les invariants existants (repos, ordre strict, pause), mesure rejouée sur les métriques de référence.

Une cible de fin de journée (« tout fini avant 22:30 ») peut servir de contrainte directrice : planification des vagues finales à rebours depuis l'heure de remise des prix.

## 5. Suites — décisions (octobre 2026)

| # | Proposition | Décision | Détail |
|---|---|---|---|
| A | Intégrer le test de reproduction ITB7 à la suite (14ᵉ fichier) | **Retenu — implémenté (v1.8)** | Scénario réel de régression (23/23 tableaux, 187/121 matchs) |
| B | Option « cadence par vagues » pour l'ordonnancement | **Retenu — implémenté (v1.8)** avec étude comparative | Voir § 6-7 : le souple domine sur ce scénario ; l'option reste disponible |
| C | Créneaux différenciés par tour (34/60 min finales) | **Retenu — en option** | Proposé en paramètre, pas en comportement par défaut |
| D | Optimisation locale (hill-climbing / recuit) | **Différé** | À reproposer plus tard |
| E | Import d'inscriptions réelles + seed par cote | **Différé** | À reproposer plus tard |
| F | Durées par discipline (simple vs double) | **Retenu** | |
| G | Terrains variables en cours de journée | **Retenu — dans les deux sens** | Ajouter X terrains si X disponibles, retirer Y terrains si non jouables (travaux, luminosité, dégradation…) ; heure de changement à indiquer explicitement |
| H | Vue « mon planning joueur » | **Différé** | Conditionné à l'intégration des noms et paires réelles (E) |
| I | Suivi direct enrichi (dérive cumulée, re-planification) | **Retenu** | |
| J | Contraintes de disponibilité par joueur | **Différé** | Conditionné à E, comme H |
| K | Mode what-if | **Retenu** | |
| L | Export PDF officiel + écrans de salle | **Retenu** | |
| M | Profils utilisateurs / lien public | **Différé — v3.0** | Recale le « v2.0 » initial du ticket #10 |

## 6. Méthode de l'étude B — cadence par vagues vs entrelacement

**Invariant commun** : un joueur ou une paire ne peut pas jouer son tour suivant sans un repos **minimum de 20 min** (les deux méthodes le garantissent ; c'est une contrainte, pas un réglage).

**Étape 1 — Paramètre** : cadence par vagues comme option par tournoi, réglable de 0 (entrelacement souple actuel) à 1 (vagues strictes type BadNet) ; à mi-course, battement régulier interpolé (20 min → durée d'un créneau) entre les tours d'une même poule.

**Étape 2 — Mesure** : rejeu du scénario ITB7 (23 tableaux, 308 matchs) aux réglages 0, 0.5 et 1. Métriques : heure de fin de journée, attente max, attente moyenne, nombre d'attentes ≥ 1 h.

**Étape 3 — Critère de choix** : une méthode n'est retenue que si elle finit la journée plus tôt à contraintes égales, ou si elle réduit sensiblement les attentes ≥ 1 h sans retarder la fin.

**Hypothèse de travail initiale** : conserver l'entrelacement avec démarrage progressif comme défaut — auto-correcteur le jour J (retards, forfaits, W.O.) là où des vagues strictes se dégradent en cascade dès qu'un match déborde.

## 7. Résultat de l'étude — cadence par vagues (v1.8)

L'option est implémentée dans les trois versions (paramètre « Cadence des tours de poule » : Souple / Resserrée / Vagues strictes). Le tournoi a été rejoué aux trois réglages (`tests/itb7-test.js`) :

| Réglage | Fin samedi | Fin dimanche | Attentes ≥ 1 h | Attente max | Attente moy |
|---|---|---|---|---|---|
| Souple (défaut — entrelacement + démarrage progressif) | 22:41 | 18:34 | **89** | 136 | **65** |
| Resserrée (battement 27 min entre tours d'une poule) | 22:41 | 18:41 | 89 | 136 | 65 |
| Vagues strictes (type BadNet) | 23:15 | **18:14** | 132 | 204 | 92 |

Conformément au critère de l'étape 3, **l'hypothèse de travail est confirmée par la mesure** : l'entrelacement souple gagne du temps (samedi −34 min) et réduit nettement les attentes (89 vs 132 ≥ 1 h ; max 136 vs 204) ; les vagues strictes ne conservent que la régularité organisationnelle du rythme et −20 min sur la fin du dimanche. **Le souple reste le comportement par défaut** ; l'option « cadence par vagues » reste disponible pour un juge-arbitre qui privilégie un rythme cadencé tour par tour.
