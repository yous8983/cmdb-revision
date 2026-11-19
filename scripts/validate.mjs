// Validation des données : JSON valide, id uniques (kebab-case), références et champs obligatoires.
// Usage : node scripts/validate.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function load(name) {
  try {
    const v = JSON.parse(readFileSync(join(root, 'data', name), 'utf8'));
    if (!Array.isArray(v)) errors.push(`${name} : la racine doit être un tableau`);
    return Array.isArray(v) ? v : [];
  } catch (e) {
    errors.push(`${name} : JSON invalide — ${e.message}`);
    return [];
  }
}

const themes = load('themes.json');
const notions = load('notions.json');
const questions = load('questions.json');

const allIds = new Map();
function checkId(item, file) {
  if (!item.id || typeof item.id !== 'string') { errors.push(`${file} : élément sans id`); return; }
  if (!KEBAB.test(item.id)) errors.push(`${file} : id "${item.id}" n'est pas en kebab-case`);
  if (allIds.has(item.id)) errors.push(`${file} : id "${item.id}" en double (déjà dans ${allIds.get(item.id)})`);
  allIds.set(item.id, file);
}
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

themes.forEach((t) => {
  checkId(t, 'themes.json');
  if (!nonEmpty(t.titre)) errors.push(`themes.json : "${t.id}" sans titre`);
  if (!nonEmpty(t.analogie_fil_rouge)) errors.push(`themes.json : "${t.id}" sans analogie_fil_rouge`);
});
const themeIds = new Set(themes.map((t) => t.id));

notions.forEach((n) => {
  checkId(n, 'notions.json');
  const where = `notions.json : "${n.id}"`;
  if (!themeIds.has(n.theme)) errors.push(`${where} : thème inconnu "${n.theme}"`);
  for (const k of ['titre', 'definition', 'source']) if (!nonEmpty(n[k])) errors.push(`${where} : champ "${k}" manquant`);
  if (!Array.isArray(n.points_cles) || !n.points_cles.length) errors.push(`${where} : points_cles vide`);
  if (!Array.isArray(n.pieges_examen)) errors.push(`${where} : pieges_examen doit être un tableau`);
  const a = n.analogie || {};
  for (const k of ['univers', 'image', 'fonction', 'limite']) if (!nonEmpty(a[k])) errors.push(`${where} : analogie.${k} manquant`);
});
const notionIds = new Set(notions.map((n) => n.id));

const perNotion = new Map();
questions.forEach((q) => {
  checkId(q, 'questions.json');
  const where = `questions.json : "${q.id}"`;
  if (!themeIds.has(q.theme)) errors.push(`${where} : thème inconnu "${q.theme}"`);
  if (!notionIds.has(q.notion)) errors.push(`${where} : notion inconnue "${q.notion}"`);
  else {
    const n = notions.find((x) => x.id === q.notion);
    if (n.theme !== q.theme) errors.push(`${where} : thème "${q.theme}" ≠ thème de la notion "${n.theme}"`);
  }
  for (const k of ['question', 'explication', 'analogie']) if (!nonEmpty(q[k])) errors.push(`${where} : champ "${k}" manquant`);
  if (!Array.isArray(q.choix) || q.choix.length < 2) errors.push(`${where} : au moins 2 choix requis`);
  if (!Array.isArray(q.bonnes_reponses) || !q.bonnes_reponses.length) errors.push(`${where} : bonnes_reponses vide`);
  else {
    if (new Set(q.bonnes_reponses).size !== q.bonnes_reponses.length) errors.push(`${where} : bonnes_reponses en double`);
    q.bonnes_reponses.forEach((i) => {
      if (!Number.isInteger(i) || i < 0 || i >= (q.choix || []).length) errors.push(`${where} : indice de réponse invalide ${i}`);
    });
  }
  perNotion.set(q.notion, (perNotion.get(q.notion) || 0) + 1);
});

notions.forEach((n) => {
  const c = perNotion.get(n.id) || 0;
  if (c < 2 || c > 4) warnings.push(`notion "${n.id}" : ${c} question(s) (attendu 2 à 4)`);
});

warnings.forEach((w) => console.warn('⚠ ' + w));
if (errors.length) {
  errors.forEach((e) => console.error('✘ ' + e));
  console.error(`\n${errors.length} erreur(s).`);
  process.exit(1);
}
console.log(`✔ Données valides : ${themes.length} thème(s), ${notions.length} notion(s), ${questions.length} question(s).`);
