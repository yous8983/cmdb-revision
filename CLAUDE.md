# CMDB Révision — guide du projet

Web app mobile (PWA) de révision pour la certification **ServiceNow CMDB Data Foundations**, entièrement en français.

## Stack

- **HTML / CSS / JavaScript vanilla** : aucun framework, aucun build, aucun CDN. Tout est servi tel quel.
- **PWA hors ligne** : `manifest.webmanifest` + `service-worker.js` (cache-first pour l'app shell, réseau-d'abord pour `data/*.json`).
  - La constante `CACHE_VERSION` dans `service-worker.js` **doit être incrémentée à chaque modification** de contenu ou de code, sinon les utilisateurs gardent l'ancienne version en cache.
- **Hébergement** : GitHub Pages, branche `main`, dossier racine (`/`).
- **Progression** : `localStorage`, clé `cmdb-revision:progress`. Tout accès est enveloppé dans `try/catch` (navigation privée, stockage plein ou bloqué) : l'app doit fonctionner sans stockage.
- Chemins **relatifs** partout (`./css/style.css`, `data/notions.json`) car le site est servi sous `/cmdb-revision/`.

## Arborescence

```
index.html              écran d'accueil + onglets (Fiches / Quiz / Flashcards / Progression)
manifest.webmanifest    manifeste PWA
service-worker.js       cache hors ligne (CACHE_VERSION)
icons/icon.svg          icône de l'app
css/style.css           styles, mobile first, mode sombre
js/app.js               chargement des données, navigation, fiches, flashcards
js/quiz.js              moteur de quiz (QCM, réponses multiples)
js/progress.js          lecture/écriture de la progression (localStorage + try/catch)
data/themes.json        liste des thèmes
data/notions.json       notions (fiches + flashcards)
data/questions.json     questions du quiz
scripts/validate.mjs    validation JSON + unicité des id + références croisées
CHANGELOG.md            historique des contenus et versions
```

## Schémas de données

### `data/themes.json`

```json
[
  {
    "id": "cmdb-fondamentaux",
    "titre": "Fondamentaux de la CMDB",
    "description": "…",
    "analogie_fil_rouge": "La CMDB comme le carnet d'entretien complet d'un parc automobile…"
  }
]
```

### `data/notions.json`

```json
[
  {
    "id": "configuration-item",
    "theme": "cmdb-fondamentaux",
    "titre": "Configuration Item (CI) — élément de configuration",
    "definition": "…",
    "points_cles": ["…"],
    "analogie": {
      "univers": "voiture",
      "image": "Chaque pièce référencée dans le carnet d'entretien…",
      "fonction": "Ce que l'analogie fait comprendre du rôle de la notion…",
      "limite": "Où l'analogie cesse d'être vraie (et peut piéger à l'examen)…"
    },
    "pieges_examen": ["…"],
    "source": "Capture X / doc ServiceNow / module Y"
  }
]
```

### `data/questions.json`

```json
[
  {
    "id": "q-configuration-item-1",
    "theme": "cmdb-fondamentaux",
    "notion": "configuration-item",
    "question": "…",
    "choix": ["A", "B", "C", "D"],
    "bonnes_reponses": [0, 2],
    "explication": "…",
    "analogie": "Rappel de l'analogie de la notion, appliqué à la question…"
  }
]
```

- `bonnes_reponses` : **indices (base 0)** dans `choix`. Plusieurs bonnes réponses possibles ; l'UI indique alors « Plusieurs réponses ».
- `theme` doit exister dans `themes.json`, `notion` doit exister dans `notions.json`.

## Règles pédagogiques — OBLIGATOIRES

1. **Chaque notion a une analogie concrète** (voiture, maison, cuisine, bibliothèque…) qui montre sa **FONCTION** et la **distingue des notions voisines** (ex. CI vs Asset, Class vs Table).
2. **Une analogie fil rouge par thème** (`analogie_fil_rouge` dans `themes.json`) ; les analogies des notions du thème s'y rattachent autant que possible.
3. **Toujours indiquer la limite de l'analogie** (`analogie.limite`) dès qu'elle peut induire en erreur à l'examen.
4. **Les analogies sont visibles partout** : fiches, dos des flashcards et explications du quiz.
5. **Ne rien inventer.** Le contenu provient uniquement des captures / sources fournies. Si une information manque ou est ambiguë, le signaler explicitement (dans la réponse à l'utilisateur et, si utile, `"source": "… — info manquante : …"`), ne pas combler par supposition.
6. **Noms techniques ServiceNow en anglais**, expliqués en français (ex. « *Identification and Reconciliation Engine* (IRE) — moteur qui… »).

## Workflow par série de captures

Pour chaque lot de captures d'écran fourni :

1. **Extraire les notions** présentes dans les captures (sans rien inventer, signaler les manques).
2. **Mettre à jour les JSON** : `themes.json` (si nouveau thème, avec analogie fil rouge), `notions.json`.
3. **Rédiger 2 à 4 QCM par notion** dans `questions.json` (avec explication + analogie).
4. **Incrémenter `CACHE_VERSION`** dans `service-worker.js`.
5. **Mettre à jour `CHANGELOG.md`**.
6. **Valider** : `node scripts/validate.mjs` (JSON valide, id uniques, références theme/notion, indices de réponses valides, analogie complète).
7. **Commit en français** : `contenu: <thème> – N notions, M questions`
8. **Push** sur `main` (déploiement GitHub Pages automatique).

## Conventions

- **id en kebab-case**, uniques, **jamais réutilisés** (même après suppression d'une notion/question).
- **Mobile first** : conçu pour 360–430 px de large, puis élargi.
- **Zones tactiles ≥ 44 px** (boutons, onglets, choix de réponse).
- **Mode sombre** via `prefers-color-scheme` (variables CSS sur `:root`).
- Aucune dépendance externe : pas de CDN, pas de polices distantes.

## Tester en local

```bash
python3 -m http.server 8000   # puis http://localhost:8000
node scripts/validate.mjs
```
