# Bureau of Meteorology (BoM)

La météo australienne dans Gladys, directement depuis le **Bureau of
Meteorology** : conditions actuelles de la station d'observation la plus
proche, prévisions horaires et à 7 jours, alertes en cours et niveau de danger
d'incendie. Aucun compte ni clé d'API nécessaire. Le BoM ne couvre que
l'**Australie**.

> Cette intégration n'est ni affiliée ni approuvée par le Bureau of
> Meteorology. Elle lit l'API publique utilisée par le site et l'application
> du BoM ; pour les alertes officielles, consultez toujours
> [bom.gov.au](https://www.bom.gov.au/) et les services d'urgence de votre
> État.

## Ce que vous obtenez

- **La météo de Gladys** : l'intégration devient le fournisseur météo de
  Gladys. Le widget météo du tableau de bord et l'assistant (« quel temps
  fera-t-il demain ? ») utilisent les données du BoM, en °C ou en °F selon
  votre profil.
- **Les alertes météo** : les alertes du BoM en cours sur votre localisation
  (orage violent, inondation, canicule, cyclone, vent marin…) et, en option,
  un danger d'incendie Élevé, Extrême ou Catastrophique, en alertes météo
  Gladys.
- **Trois widgets**, **trois déclencheurs** et **trois actions de scène**,
  décrits ci-dessous.

## Configuration

1. Installez l'intégration. L'écran d'installation demande l'accès à la
   position de vos maisons : l'intégration s'en sert pour savoir quel lieu
   surveiller quand aucune localisation n'est configurée.
2. Ouvrez l'onglet **Configuration** :
   - **Localisation** : une banlieue, une ville, un code postal (`2150`) ou
     `latitude,longitude`. Laissez vide pour utiliser la position de votre
     maison Gladys (Paramètres → Maisons). Un doute sur l'orthographe ?
     Utilisez le bouton **Rechercher un lieu**.
   - **Intervalle de vérification des alertes** : fréquence (5 à 60 minutes,
     10 par défaut) de vérification des alertes et du danger d'incendie qui
     déclenchent vos scènes.
   - **Danger d'incendie en alerte météo** : signale les niveaux Élevé,
     Extrême et Catastrophique comme alertes météo Gladys.
3. Enregistrez, puis cliquez sur **Tester la connexion** : le lieu trouvé et
   la dernière température relevée à proximité s'affichent.

## Widgets du tableau de bord

Ajoutez-les depuis l'éditeur de tableau de bord. Chaque widget a un réglage
**Localisation** optionnel pour afficher un autre lieu que celui configuré.

- **Conditions BoM** : température relevée, ressenti, humidité et vent,
  courbe de température des 24 prochaines heures, résumé du jour, pluie
  depuis 9h, danger d'incendie et indice UV maximal.
- **Prévisions BoM 7 jours** : une ligne par jour avec minimum et maximum,
  résumé et risque de pluie ; touchez un jour pour la prévision détaillée.
- **Alertes BoM** : les alertes en cours, majeures d'abord, chacune avec un
  lien vers sa page sur le site du BoM, un bouton **Actualiser** (nouvelle
  vérification immédiate) et un lien vers toutes les alertes de votre État.

## Scènes

Dans l'éditeur de scènes, les cartes sont dans la catégorie
**Intégrations**.

### Déclencheurs

- **Alerte BoM émise** : une nouvelle alerte concerne la localisation.
  Filtres optionnels : type d'alerte (inondation, orage violent, canicule,
  cyclone tropical…) et gravité (majeure, mineure). Vides, toute alerte
  correspond.
- **Fin d'alerte BoM** : une alerte a été levée ou a expiré. Mêmes filtres.
- **Danger d'incendie modifié** : le niveau de danger d'incendie du jour a
  changé ; filtrez éventuellement sur le nouveau niveau (par exemple
  seulement Extrême et Catastrophique).

Les actions suivantes peuvent lire le détail : `{{triggerEvent.data.title}}`,
`{{triggerEvent.data.area}}`, `{{triggerEvent.data.severity}}`,
`{{triggerEvent.data.expiry_time}}`, `{{triggerEvent.data.rating}}`…

La première vérification après l'installation enregistre la situation sans
rien déclencher : les déclencheurs annoncent ce qui change.

### Actions

Chaque action a un champ **Localisation** optionnel (variables de scène
acceptées) ; vide, la localisation configurée est utilisée. Les valeurs sont
métriques (°C, km/h, mm).

- **Conditions actuelles BoM** : température, ressenti, humidité, vent,
  rafales, pluie depuis 9h, minimum et maximum du jour, station.
- **Prévisions BoM** : pour aujourd'hui ou l'un des 6 jours suivants :
  minimum, maximum, résumé, texte détaillé, risque et quantité de pluie, UV,
  danger d'incendie, lever et coucher du soleil.
- **Alertes BoM en cours** : nombre d'alertes en cours (total, majeures,
  mineures), présence d'une alerte majeure, et leurs noms.

Exemple : _chaque matin à 7h, lire la prévision de demain ; si le risque de
pluie dépasse 60, envoyer « Pluie prévue : {{…summary}} » et ne pas arroser
le jardin._

## Bon à savoir

- Les textes de prévision et les titres d'alerte du BoM sont en anglais.
- Les données sont mises en cache quelques minutes (alertes 2 minutes,
  observations 5, prévisions 15) pour ménager les serveurs du BoM.
- Hors d'Australie, l'intégration refuse la demande et Gladys se rabat sur
  son autre fournisseur météo.

## Dépannage

- **« Aucune localisation »** : renseignez le champ Localisation, ou la
  position de votre maison dans Gladys.
- **« Aucun lieu australien ne correspond »** : essayez le code postal, ou
  utilisez **Rechercher un lieu**.
- **« Hors de la zone couverte »** : la position de votre maison n'est pas
  en Australie ; renseignez une Localisation.
- Logs : Intégrations → Bureau of Meteorology (BoM) → Supervision.
