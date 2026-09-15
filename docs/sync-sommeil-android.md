# Sync sommeil automatique — Google Health → app Sport & Santé

Remplit automatiquement tes nuits dans l'app depuis **Health Connect** (alimenté par ta Fitbit
via Google Health), grâce à une appli d'automatisation Android.

## Vue d'ensemble

```
Fitbit → Google Health → Health Connect (sur le tél)
                              │
           [Tasker / Macrodroid, chaque matin]
                              │  POST JSON
                              ▼
        Cloud Function  sleepIngest  (Firebase)
                              │
                              ▼
        Firestore  users/{uid}/sleep/{date}
```

Ta **qualité 1-10** reste la tienne : la sync remplit coucher / réveil / heures dormies et
propose une qualité de départ à partir du *Sleep Score* Google (arrondi /10). Tu ajustes.
La sync **ne touche jamais** une nuit que tu as saisie ou modifiée toi-même.

---

## 1. Le contrat du webhook (la partie fiable)

- **URL** : `https://europe-west1-sport-467df.cloudfunctions.net/sleepIngest`
- **Méthode** : `POST`
- **Header** : `Content-Type: application/json`
- **Corps JSON** :

```json
{
  "uid": "TON_UID",
  "secret": "TON_JETON",
  "date": "2026-09-15",
  "bedtime": "23:40",
  "wakeTime": "07:38",
  "hoursSlept": 7.0,
  "sleepScore": 82,
  "awakeMinutes": 58,
  "deepMinutes": 82,
  "lightMinutes": 240,
  "remMinutes": 98,
  "restingHeartRate": 62,
  "hrv": 42,
  "spo2": 97,
  "respiratoryRate": 13
}
```

| Champ | Obligatoire | Détail |
|---|---|---|
| `uid` | oui | Ton identifiant (Paramètres → Sync sommeil) |
| `secret` | oui | Le jeton (peut aussi être passé en header `Authorization: Bearer <jeton>`) |
| `date` | oui | `YYYY-MM-DD` — **jour du réveil** |
| `bedtime` | oui | `HH:MM` (24 h, heure locale) — début de session |
| `wakeTime` | oui | `HH:MM` — fin de session |
| `hoursSlept` | **recommandé** | Décimal = **temps réellement dormi** (durée totale − éveil). Si absent → calculé de `bedtime` à `wakeTime` (⚠ inclut l'éveil) |
| `sleepScore` | non | 0-100. Sert à proposer la qualité 1-10 |
| `awakeMinutes` | non | Minutes d'éveil pendant la session |
| `deepMinutes` / `lightMinutes` / `remMinutes` | non | Stades de sommeil (minutes) |
| `restingHeartRate` | non | FC au repos (bpm) |
| `hrv` | non | Variabilité cardiaque / HRV (ms) |
| `spo2` | non | Saturation O₂ (%) |
| `respiratoryRate` | non | Fréquence respiratoire (/min) |

Tous les champs optionnels ne sont écrits que s'ils arrivent en **nombre**. Le téléphone envoie ce qu'il sait lire.

Réponses : `200 {ok:true}` = écrit · `200 {ok:true,skipped:"manual"}` = nuit manuelle préservée ·
`401` = uid/jeton faux · `400` = date/heure mal formée.

---

## 2. Test immédiat (sans le téléphone)

Dans l'app : **Paramètres → Sync sommeil → Activer**, puis copie `uid` et `jeton`.
Remplace les valeurs ci-dessous et lance (PowerShell) :

```bash
curl -X POST "https://europe-west1-sport-467df.cloudfunctions.net/sleepIngest" -H "Content-Type: application/json" -d "{\"uid\":\"TON_UID\",\"secret\":\"TON_JETON\",\"date\":\"2026-09-15\",\"bedtime\":\"23:40\",\"wakeTime\":\"07:38\",\"sleepScore\":82}"
```

Attendu : `{"ok":true,"date":"2026-09-15","hoursSleptHHMM":"07:58"}`.
Ouvre l'onglet **Sommeil** à cette date → la nuit doit apparaître. ✅

---

## 3. Automatisation Android

> Les noms exacts d'écrans/variables changent selon la version de l'appli et de Health Connect.
> La logique ci-dessous est la référence ; adapte les libellés. En cas de doute, envoie-moi une
> capture de l'action « Health Connect » et je te donne les noms précis.

### Option A — Macrodroid (le plus simple)

1. Installe **Macrodroid** + **Health Connect**, et autorise Macrodroid à *lire les sessions de
   sommeil* dans Health Connect (Réglages Health Connect → Autorisations des applis).
2. Nouvelle macro :
   - **Déclencheur** : *Heure / Jour* → tous les jours à **10:00** (Fitbit a synchronisé la nuit).
   - **Action 1** : *Health Connect → Lire les données → Sommeil*, plage = dernières 24 h.
     Récupère début (`bedtime`), fin (`wakeTime`) de la session la plus longue, et le score si dispo.
   - **Action 2** : *Requête HTTP → POST* vers l'URL, corps = le JSON du §1 en injectant les variables.
3. Teste la macro à la main une fois. Vérifie l'onglet Sommeil.

### Option B — Tasker

1. Tasker 6.3+ a l'action native **Health Connect**. Autorise la lecture du sommeil.
2. **Profil** : Heure → 10:00.
3. **Tâche** :
   - `Health Connect` → *Read* → *Sleep Session*, plage dernières 24 h → variables de début/fin.
   - `Variable Set` : formate `bedtime`/`wakeTime` en `HH:MM`, `date` en `YYYY-MM-DD` (jour du réveil).
   - `HTTP Request` : Method `POST`, URL du §1, Header `Content-Type:application/json`,
     Body = le JSON avec tes variables.

### Gérer l'éveil et les stades (important)

Une session de sommeil Health Connect contient des **stades** : `AWAKE`, `LIGHT`, `DEEP`, `REM`,
`OUT_OF_BED`. Il ne faut **pas** faire simplement `fin − début` (ça compterait tes réveils
nocturnes comme du sommeil). Formule correcte :

- `bedtime` = début de session, `wakeTime` = fin de session
- **`hoursSlept` = durée totale − (minutes `AWAKE` + `OUT_OF_BED`)** → envoie-la explicitement
- `awakeMinutes`, `deepMinutes`, `lightMinutes`, `remMinutes` = somme des durées de chaque stade

Dans Macrodroid/Tasker, l'action « Lire le sommeil » renvoie généralement la liste des segments de
stades : additionne les minutes par type. Si ton appli ne sait pas décomposer les stades, envoie au
minimum `bedtime`/`wakeTime` + `sleepScore` (la qualité restera correcte car le score pénalise déjà
les réveils), mais `hoursSlept` sera alors surestimé.

### Choisir la bonne session

Health Connect peut contenir une sieste (ex. « sieste de 24 min ») en plus de la nuit.
→ prends **la session la plus longue** des dernières 24 h, ou celle qui **finit le matin**.
Ta Garmin Forerunner, elle, n'écrit normalement **pas** dans Health Connect (donc pas de conflit) ;
si un jour tu vois des doublons, c'est qu'un pont Garmin→Health Connect est actif — on filtrera par source.

---

## 4. Rattraper les nuits manquantes (depuis le 31 août)

Deux façons :

- **Rejouer** la macro/tâche en changeant la plage sur chaque jour manquant (fastidieux mais sûr).
- **Google Takeout** : exporte tes données Google Health, envoie-moi le fichier sommeil,
  je te fais un petit script d'import unique qui POST toutes les nuits d'un coup.

Dis-moi laquelle tu préfères quand la sync quotidienne tournera.
