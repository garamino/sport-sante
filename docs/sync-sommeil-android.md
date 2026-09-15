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

## 3. L'app Android : Health Connect Webhook (mcnaveen)

Pas besoin de Tasker/Macrodroid (Macrodroid ne sait pas lire le sommeil ; Tasker est payant).
On utilise une petite app open-source dédiée qui lit Health Connect (sommeil **avec stades**) et
POST vers notre webhook, avec un bouton **« Test Webhook »** = ton envoi manuel.

### Installation

- Dépôt : **github.com/mcnaveen/health-connect-webhook** (152 ⭐, open-source, gratuit).
- Télécharge le dernier **APK** dans *Releases* : `app-foss-release.apk` (ex. v1.9.20).
- Installe-le (autorise « sources inconnues » si demandé). Android 9+ requis.
- Astuce mises à jour : l'app **Obtainium** peut suivre ce dépôt et te notifier des nouvelles versions.

### Configuration (dans l'app)

1. Autorise l'app à **lire le sommeil** (et FC/HRV/SpO2/resp) dans **Health Connect**
   (Paramètres Android → Santé Connect → Autorisations des applications).
2. Dans l'app, onglet **Webhook / Config** :
   - **Webhook URL** = la valeur *Webhook URL* de l'app Sport & Santé (Paramètres → Sync sommeil).
     Elle ressemble à `https://europe-west1-sport-467df.cloudfunctions.net/hcWebhook?uid=TON_UID`.
   - **Bearer token / Auth** = ton *jeton* (même écran).
3. Onglet **Data Types** : coche au minimum **Sleep**, plus **Resting heart rate**, **HRV**,
   **Oxygen saturation (SpO2)**, **Respiratory rate** si proposés.
4. Appuie sur **Test Webhook** (ou « Sync Now »).

### Étape de calage (une fois)

La 1ʳᵉ fois, **envoie-moi le résultat** : je lis le **JSON réel** reçu dans les logs du serveur
(`firebase functions:log --only hcWebhook`) et j'ajuste le parseur au schéma exact de ta version de
l'app (noms de clés des stades, des constantes, présence ou non du coucher/réveil). Ensuite tout
tombe automatiquement au bon endroit dans l'onglet Sommeil.

### Format réel (calé sur l'app v1.9.20)

Format **plat**, heures en **UTC**, stades en **minuscules** :

```json
{
  "sleep": [
    {
      "session_end_time": "2026-09-14T07:00:00Z",
      "duration_seconds": 27000,
      "stages": [
        { "stage": "deep",  "start_time": "…T00:00:00Z", "duration_seconds": 7200 },
        { "stage": "rem",   "start_time": "…T02:00:00Z", "duration_seconds": 12600 },
        { "stage": "light", "start_time": "…T05:30:00Z", "duration_seconds": 5400 }
      ]
    }
  ],
  "heart_rate": [ { "bpm": 58, "time": "2026-09-14T06:20:00Z" } ]
}
```

Le webhook convertit UTC→heure locale (`?tz=Europe/Paris`), calcule `hoursSlept` = **somme des
stades hors éveil**, `awakeMinutes` = reste, déduit la **FC de repos** = min des bpm pendant la nuit,
et rattache HRV / SpO2 / respiration **si** l'app les envoie. Il traite **toutes** les nuits reçues
→ si l'app envoie plusieurs jours, tes nuits manquantes se remplissent d'un coup.

> Note : le bouton **Test Webhook** envoie des **données de démonstration** (une Pixel Watch fictive),
> pas ta vraie nuit — c'est normal, ça sert juste à valider le tuyau. Le **Sync Now** (données réelles)
> enverra tes vraies nuits Fitbit.

Réponse du webhook : `200 {ok:true, written:["2026-09-14", …], count:N}`.

### Note Garmin

Ta Garmin Forerunner n'écrit normalement **pas** dans Health Connect (pas de conflit).
Si un jour tu vois des doublons, c'est qu'un pont Garmin→Health Connect est actif — on filtrera alors par source.

---

## 4. Rattraper les nuits manquantes (depuis le 31 août)

L'app envoie un **historique** de plusieurs jours en un seul « Test Webhook » si tu élargis la
période dans ses réglages (ex. 30 derniers jours). Le webhook écrit chaque nuit à sa date → le
rattrapage est **automatique**. À défaut, on pourra passer par un export **Google Takeout**.
