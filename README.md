# ROUTIS

Place de marché du transport : les transporteurs déclarent leurs véhicules et
leurs services, les clients décrivent leur besoin et reçoivent des prix fermes.

Pour la mise en ligne, lisez **GUIDE-INSTALLATION.md** — tout y est expliqué
pas à pas, sans prérequis technique.

---

## Ce que fait le site

**Pour le client** — décrire un transport (marchandises ou personnes), recevoir
les devis de plusieurs transporteurs vérifiés, comparer, accepter, obtenir le
contact du transporteur retenu, puis le noter une fois la mission terminée.

**Pour le transporteur** — créer sa fiche entreprise, déclarer sa flotte,
déposer ses justificatifs, recevoir les demandes correspondant à ses services et
à sa zone, y répondre par un prix.

**Pour l'administrateur** — contrôler les documents pièce par pièce, vérifier ou
suspendre une entreprise, suivre les demandes, lire le journal des e-mails.

Un transporteur n'apparaît dans l'annuaire public qu'une fois **vérifié par
l'administrateur**. C'est ce contrôle qui fait la valeur du site.

---

## Pile technique

| | |
|---|---|
| Cadre | Next.js 16.3.2 (Active LTS), React 19.2, App Router |
| Langage | TypeScript strict |
| Base | PostgreSQL, requêtes paramétrées (`pg`) |
| Mots de passe | bcrypt (`bcryptjs`, sans dépendance native) |
| Documents | Netlify Blobs en production, `.stockage/` en local |
| E-mails | API Resend en HTTP, sans SDK |
| Dépendances | 7 au total en production |

Aucun code client n'est nécessaire au fonctionnement : tout passe par des
composants serveur et des formulaires HTML. Le site reste utilisable si le
JavaScript est désactivé ou si la connexion est mauvaise.

---

## Développement

```bash
npm install
cp .env.example .env.local     # renseignez DATABASE_URL
npm run dev                    # http://localhost:3000
```

Puis ouvrez `/installer` pour créer les tables, importer les 244 pays et
6 519 villes, et créer votre compte administrateur.

```bash
npm run build                  # vérification TypeScript comprise
npx tsc --noEmit               # contrôle des types seul
```

---

## Tests

Site démarré, dans un second terminal :

```bash
node tests/parcours.mjs     # 32 contrôles fonctionnels
node tests/securite.mjs     # 43 contrôles de sécurité
```

`parcours.mjs` rejoue le cycle complet — installation, inscriptions, fiche
entreprise, véhicules, dépôt et contrôle de documents, vérification, demande,
devis, acceptation, clôture, avis, tableau de bord.

`securite.mjs` se met à la place de quelqu'un qui cherche à obtenir ce à quoi il
n'a pas droit : pages réservées, cloisonnement des rôles, téléchargement des
documents d'autrui, injections SQL, scripts injectés, vol et falsification de
cookie, essais de mot de passe en série.

Les deux suites doivent afficher **0 échecs**. Lancez `parcours.mjs` en premier :
`securite.mjs` s'appuie sur les comptes qu'il crée.

---

## Ce qui protège le site

- **Requêtes paramétrées partout.** Aucune valeur venue de l'utilisateur n'est
  concaténée dans du SQL.
- **Documents hors du web.** Un justificatif n'a pas d'adresse publique : il
  passe par `/api/fichier/[id]`, qui vérifie à chaque appel que le demandeur est
  bien le propriétaire ou un administrateur.
- **Type de fichier lu dans les octets**, pas dans l'extension : un script
  renommé `.png` est rejeté.
- **Propriété revérifiée côté serveur** à chaque action. Modifier l'identifiant
  dans un formulaire ne donne accès à rien.
- **Sessions en base**, cookie `httpOnly` + `SameSite=Lax`, identifiant de
  256 bits tiré au hasard. La déconnexion supprime la session côté serveur.
- **Essais de connexion comptés en base** — et non en mémoire, qui ne protège
  rien sur un hébergement sans serveur : cinq échecs bloquent l'adresse dix
  minutes.
- **Assistant d'installation auto-verrouillé** dès qu'un administrateur existe.

---

## Accessibilité et affichage

Contraste conforme **WCAG AA** sur l'ensemble des pages (contrôle automatisé),
et aucun débordement horizontal de 360 px à 1280 px.

---

## Structure

```
app/               pages et actions serveur
  admin/           back-office
  espace/          espace transporteur
  api/fichier/     accès contrôlé aux documents
  installer/       assistant de première installation
components/        en-tête et pied de page
lib/
  db.ts            connexion PostgreSQL mutualisée
  auth.ts          comptes, sessions, rôles
  metier.ts        référentiels et calculs
  stockage.ts      documents
  mail.ts          envoi
  notifications.ts messages types
  schema.ts        structure de la base
  donnees/         pays et villes
tests/             contrôles automatisés
```
