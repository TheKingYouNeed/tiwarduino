# Système de Sécurité Arduino avec MQTT

Ce projet implémente un système de sécurité utilisant Arduino, Johnny-Five, Express et MQTT pour la communication entre les composants.

## Architecture du Système

Le système est divisé en trois composants principaux:

1. **Broker MQTT** (mqtt-broker.js): Un broker MQTT léger qui gère la communication entre les composants
2. **Serveur Web** (server.js): Gère l'interface web et les interactions utilisateur
3. **Servient** (servient.js): Contrôle le matériel Arduino et communique avec le serveur via MQTT

## Flux de Communication

### De l'Interface Web à l'Arduino

1. **Interaction Utilisateur**: L'utilisateur interagit avec l'interface web (changement de mode, contrôle de porte, etc.)
2. **Requête HTTP**: Le navigateur envoie une requête HTTP au serveur web
3. **Publication MQTT**: Le serveur publie une commande sur le broker MQTT
4. **Réception par le Servient**: Le servient reçoit la commande et contrôle le matériel Arduino
5. **Confirmation**: Le servient publie une confirmation ou un changement d'état

Exemple de flux pour le changement de mode:
```
Interface Web → Requête HTTP (/update-mode) → Serveur → 
Publication MQTT (servient/commands/mode) → Servient → 
Changement de Mode sur Arduino → Publication d'État → 
Serveur → Socket.IO → Interface Web (mise à jour)
```

### De l'Arduino à l'Interface Web

1. **Événement Matériel**: Un événement se produit sur l'Arduino (appui sur bouton, détection de présence)
2. **Détection par le Servient**: Le servient détecte l'événement via Johnny-Five
3. **Publication MQTT**: Le servient publie l'événement sur le broker MQTT
4. **Réception par le Serveur**: Le serveur reçoit l'événement et met à jour son état
5. **Transmission Socket.IO**: Le serveur transmet l'événement à tous les clients web connectés
6. **Mise à Jour de l'Interface**: L'interface web se met à jour pour refléter le nouvel état

Exemple de flux pour l'entrée de code:
```
Appui sur Bouton → Détection par Johnny-Five → Servient → 
Publication MQTT (servient/events) → Serveur → 
Traitement de l'Événement → Socket.IO → 
Interface Web (affichage du code entré)
```

## Fonctionnalités Principales

### 1. Contrôle de la Porte

- **Ouverture/Fermeture**: Via l'interface web ou en entrant un code valide
- **Mécanisme**: Un servomoteur contrôle la position de la porte (0° fermée, 90° ouverte)
- **Flux de Communication**:
  - Interface Web → Serveur → MQTT → Servient → Servomoteur
  - Servient → MQTT → Serveur → Socket.IO → Interface Web (mise à jour de l'état)

### 2. Système d'Alarme

- **Modes**: Simple (LED suit le capteur) ou Alarme (détection de présence)
- **Détection**: Le capteur de luminosité détecte une présence
- **Délai**: 10 secondes pour entrer un code valide, puis 20 secondes supplémentaires avant l'alarme complète
- **Désactivation**: Entrer un code valide à tout moment arrête l'alarme
- **Flux de Communication**:
  - Détection → Servient → MQTT → Serveur → Socket.IO → Interface Web (alerte)
  - Entrée de Code → Servient → Vérification → MQTT → Serveur → Socket.IO → Interface Web

### 3. Entrée de Code de Sécurité

- **Méthode**: Séquence de boutons physiques (1 et 2)
- **Validation**: Vérification après 4 chiffres entrés
- **Actions**: Ouverture de porte, désactivation d'alarme
- **Flux de Communication**:
  - Appui sur Bouton → Servient → MQTT → Serveur → Socket.IO → Interface Web (affichage)
  - Code Complet → Vérification → Actions → MQTT → Serveur → Socket.IO → Interface Web

### 4. Changement de Mode

- **Modes Disponibles**: Simple ou Alarme
- **Interface**: Sélection via menu déroulant dans l'interface web
- **Flux de Communication**:
  - Sélection de Mode → Serveur → MQTT → Servient → Changement de Comportement
  - Servient → MQTT → Serveur → Socket.IO → Interface Web (confirmation)

## Structure des Topics MQTT

1. **Commandes** (Interface Web → Arduino):
   - `servient/commands/mode` - Pour changer le mode de fonctionnement
   - `servient/commands/door` - Pour contrôler la porte
   - `servient/commands/alarm` - Pour contrôler l'alarme

2. **Événements et État** (Arduino → Interface Web):
   - `servient/events` - Pour tous les événements (appuis sur boutons, entrées de code, etc.)
   - `servient/state` - Pour l'état actuel du système

## Configuration Matérielle

- Carte Arduino connectée au port COM6
- Capteur de luminosité sur la broche analogique A0
- LED d'état sur la broche 8
- LED d'alarme sur la broche 9
- Servomoteur de porte sur la broche 7
- Boutons pour l'entrée de code sur les broches 2 et 3

## Codes de Sécurité

Chaque personne a son propre code de sécurité:
- John: 1212
- Alice: 2121
- Bob: 1122
- Emma: 2211

## Installation

1. Installer Node.js et npm
2. Exécuter `npm install` pour installer les dépendances
3. Connecter votre carte Arduino au port COM6
4. Exécuter `start.bat` ou `node start-all.js` pour démarrer tous les composants

## Utilisation

1. Accéder à l'interface web à l'adresse http://localhost:3000
2. Choisir entre le mode Simple (LED suit le capteur) et le mode Alarme (système de sécurité)
3. En mode Alarme, lorsqu'une présence est détectée, entrer le code correct dans les 30 secondes
4. Contrôler la porte depuis l'interface web

## Documentation

Une documentation détaillée du projet est disponible dans le fichier `documentation.html`. Vous pouvez y accéder en ouvrant ce fichier dans votre navigateur ou en visitant http://localhost:3000/documentation.html lorsque le serveur est en cours d'exécution.

## Dépendances

- express: Framework de serveur web
- socket.io: Communication en temps réel
- johnny-five: Interface Arduino
- mqtt: Client MQTT
- body-parser: Analyse du corps des requêtes
- aedes: Broker MQTT léger
