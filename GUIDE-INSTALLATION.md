# ROUTIS — mise en ligne gratuite

Ce guide vous mène d'un dossier de code à un site en ligne, joignable par vos
clients, **sans rien payer**. Comptez trente minutes la première fois.

Aucune connaissance technique n'est supposée : chaque étape dit où cliquer et
quoi coller.

---

## 1. Ce que vous allez utiliser, et pourquoi

| Rôle | Service | Coût | Pourquoi celui-là |
|---|---|---|---|
| Héberger le site | **Netlify** | Gratuit | Accepte Next.js sans configuration et **autorise l'usage commercial** |
| Base de données | **Neon** (PostgreSQL) | Gratuit | Ne s'efface pas, ne se supprime pas, pas de carte bancaire |
| Documents déposés | **Netlify Blobs** | Compris | Fichiers hors du site : aucune adresse publique |
| E-mails | **Resend** | Gratuit | 3 000 messages par mois, largement suffisant au démarrage |

### Pourquoi pas Vercel, l'hébergeur de Next.js ?

Parce que son offre gratuite l'interdit. La documentation de Vercel est
explicite : *« the Hobby plan restricts users to non-commercial, personal use
only »* — le plan Hobby est réservé à un usage **personnel et non commercial**.
Un site où des transporteurs vendent des prestations est une activité
commerciale, même s'il ne rapporte encore rien. Le passage obligé est alors le
plan Pro, à 20 $ par mois et par personne.

Netlify ne pose pas cette condition sur son offre gratuite : c'est la seule
raison de ce choix. Le code, lui, reste du Next.js standard — vous pourrez
déménager chez n'importe quel hébergeur plus tard sans rien réécrire.

### Ce que « gratuit » veut dire exactement

Netlify accorde **300 crédits par mois**. Ils se consomment ainsi :

- 20 crédits par gigaoctet envoyé aux visiteurs,
- 15 crédits par mise en ligne d'une nouvelle version,
- 2 crédits par tranche de 10 000 requêtes,
- 10 crédits par gigaoctet-heure de calcul.

En pratique, c'est **la bande passante qui vous limitera** : environ 10 à 15 Go
par mois, soit largement de quoi accueillir vos premiers milliers de visiteurs.
Si le plafond est atteint, le site est mis en pause jusqu'au mois suivant — il
n'y a jamais de facture surprise.

Neon offre 0,5 Go de base et 100 heures de calcul par projet et par mois. La
base **se met en veille** après cinq minutes sans activité et se réveille toute
seule à la visite suivante : la première page après une longue inactivité peut
mettre une seconde de plus à s'afficher. Rien n'est effacé.

---

## 2. Créer la base de données (5 minutes)

1. Allez sur **neon.com** et créez un compte (bouton *Sign up*, connexion
   possible avec Google ou GitHub — aucune carte bancaire n'est demandée).
2. Créez un projet. Nommez-le `routis`.
   Choisissez la région la plus proche de vos utilisateurs — pour l'Algérie,
   **Europe (Frankfurt)** est la meilleure.
3. À la fin, Neon affiche une **connection string**. Elle ressemble à :

   ```
   postgresql://neondb_owner:AbCd1234@ep-cool-lab-12345.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

4. **Copiez-la et gardez-la de côté** : c'est la clé de votre base. Si vous la
   perdez, vous la retrouverez dans *Dashboard → Connection Details*.

> Cette adresse contient le mot de passe de votre base. Ne la publiez nulle
> part, ne la mettez pas dans un message public.

---

## 3. Mettre le code sur GitHub (5 minutes)

Netlify va chercher votre code sur GitHub. C'est aussi votre sauvegarde.

1. Créez un compte sur **github.com** si vous n'en avez pas.
2. Cliquez sur **New repository**, nommez-le `routis`, laissez-le **Private**,
   et validez.
3. GitHub affiche alors une page d'instructions. Dans le dossier du projet, sur
   votre ordinateur, ouvrez un terminal et tapez :

   ```bash
   git init
   git add .
   git commit -m "Première version de ROUTIS"
   git branch -M main
   git remote add origin https://github.com/VOTRE-COMPTE/routis.git
   git push -u origin main
   ```

   Remplacez `VOTRE-COMPTE` par votre nom d'utilisateur GitHub.

> Le fichier `.gitignore` fourni empêche l'envoi de `.env.local` et de
> `node_modules`. Vos mots de passe ne partent donc jamais sur GitHub.

---

## 4. Mettre le site en ligne (10 minutes)

1. Allez sur **netlify.com**, créez un compte, puis
   **Add new site → Import an existing project → GitHub**.
2. Autorisez Netlify à lire vos dépôts, puis choisissez `routis`.
3. Netlify détecte Next.js tout seul. Ne changez rien aux réglages de build.
4. **Avant** de cliquer sur *Deploy*, ouvrez **Add environment variables** et
   saisissez :

   | Nom | Valeur |
   |---|---|
   | `DATABASE_URL` | la connection string copiée à l'étape 2 |
   | `NOM_SITE` | `ROUTIS` |

5. Cliquez sur **Deploy**. La première mise en ligne prend deux à trois minutes.
6. Netlify vous donne une adresse du type
   `https://routis-abc123.netlify.app`. Notez-la.
7. Retournez dans **Site configuration → Environment variables** et ajoutez :

   | Nom | Valeur |
   |---|---|
   | `SITE_URL` | l'adresse que Netlify vient de vous donner |

   Puis **Deploys → Trigger deploy → Deploy site** pour que le changement soit
   pris en compte. Cette variable sert aux liens contenus dans les e-mails.

---

## 5. Installer le site (2 minutes)

1. Ouvrez `https://votre-adresse.netlify.app/installer`.
2. La page doit afficher **« la variable DATABASE_URL est bien renseignée »**.
   Si ce n'est pas le cas, revenez à l'étape 4.4.
3. Renseignez votre nom, votre adresse e-mail et un mot de passe d'au moins
   huit caractères. Ce sera votre compte **administrateur**.
4. Cliquez sur **Installer le site**. L'assistant crée les tables et importe
   **244 pays et 6 519 villes** en quelques secondes.
5. Connectez-vous. Vous arrivez sur le tableau de bord d'administration.

> **L'assistant se verrouille tout seul.** Dès qu'un administrateur existe, la
> page `/installer` refuse toute nouvelle installation. Personne ne peut
> réinstaller votre site par-dessus.

---

## 6. Activer les e-mails (facultatif, 10 minutes)

Sans cette étape, le site fonctionne : les messages sont enregistrés dans
*Administration → E-mails*, mais ne partent pas. Vos utilisateurs ne sont donc
pas prévenus des nouveaux devis. À faire dès que possible.

1. Créez un compte gratuit sur **resend.com**.
2. **Domaine** : dans *Domains → Add Domain*, saisissez votre nom de domaine
   (par exemple `routis.dz`). Resend affiche trois lignes à ajouter chez votre
   fournisseur de nom de domaine. Une fois validées, vous pourrez écrire à tout
   le monde.
   *Sans domaine à vous*, Resend n'accepte d'envoyer qu'à votre propre adresse —
   utile pour tester, pas pour ouvrir le service.
3. **Clé** : dans *API Keys → Create API Key*, copiez la clé (`re_…`).
4. Dans Netlify, ajoutez deux variables :

   | Nom | Valeur |
   |---|---|
   | `RESEND_API_KEY` | la clé `re_…` |
   | `EMAIL_EXPEDITEUR` | `ROUTIS <no-reply@votre-domaine.dz>` |

5. Relancez un déploiement.

Pour vérifier : créez une demande de devis de test, puis regardez
*Administration → E-mails*. La colonne « statut » doit afficher `envoye`.

---

## 7. Mettre votre propre nom de domaine (facultatif)

Dans Netlify : **Domain management → Add a domain**. Netlify vous donne les
lignes à recopier chez votre registraire (`.dz` : passez par votre hébergeur
algérien ; `.com` : Namecheap, OVH, Gandi…). Le certificat HTTPS est créé
automatiquement et gratuitement.

N'oubliez pas de mettre `SITE_URL` à jour avec la nouvelle adresse.

---

## 8. Vos premiers gestes d'administrateur

1. **Ouvrez les pays où vous travaillez.** Par défaut, l'Algérie, la Tunisie, le
   Maroc et la France sont actifs, avec leur monnaie et leur TVA.
2. **Attendez les inscriptions de transporteurs.** Ils créent leur compte,
   remplissent leur fiche et déposent leurs justificatifs.
3. **Contrôlez les dossiers** dans *Administration → Transporteurs*. Un
   transporteur reste invisible dans l'annuaire tant que vous ne l'avez pas
   vérifié — c'est ce qui fait la valeur de votre site auprès des clients.
4. **Ouvrez chaque document** avant de valider. Registre de commerce, licence de
   transport, assurance : ce sont ces trois pièces qui engagent votre
   responsabilité.

---

## 9. Modifier le site plus tard

Toute modification suit le même chemin :

```bash
git add .
git commit -m "ce que j'ai changé"
git push
```

Netlify détecte l'envoi et remet le site en ligne tout seul, en deux minutes.
Si la nouvelle version ne convient pas, *Deploys → Publish deploy* sur la
version précédente la rétablit instantanément.

Pour travailler sur votre ordinateur avant d'envoyer :

```bash
npm install
cp .env.example .env.local     # puis renseignez DATABASE_URL
npm run dev                    # le site tourne sur http://localhost:3000
```

---

## 10. Vérifier que tout marche

Le projet contient deux séries de contrôles automatiques. Site démarré, dans un
autre terminal :

```bash
node tests/parcours.mjs     # 32 contrôles : de l'installation à la note client
node tests/securite.mjs     # 43 contrôles : droits, injections, sessions
```

Les deux doivent afficher **0 échecs**.

---

## 11. Quand faudra-t-il payer ?

Jamais, tant que le site reste modeste. Les seuils à surveiller :

| Signe | Ce qui se passe | Solution |
|---|---|---|
| Site en pause en fin de mois | Les 300 crédits Netlify sont consommés | Netlify Personal, 9 $/mois |
| Base en lecture seule | Les 0,5 Go de Neon sont pleins | Neon Launch, 5 $/mois |
| E-mails refusés | Plus de 3 000 messages ce mois-ci | Resend, 20 $/mois |

Autrement dit : le jour où vous paierez, c'est que le site marche.

---

## En cas de problème

**« la variable DATABASE_URL est absente »** — la variable n'a pas été ajoutée
dans Netlify, ou le déploiement n'a pas été relancé depuis. Vérifiez
l'orthographe exacte, en majuscules.

**« La base de données a refusé l'opération »** — la connection string est
incomplète. Elle doit finir par `?sslmode=require`. Recopiez-la depuis Neon
sans rien couper.

**La première page est lente après plusieurs heures sans visite** — c'est la
mise en veille de Neon. Le réveil prend environ une seconde et n'arrive qu'une
fois.

**Les e-mails partent en échec** — allez dans *Administration → E-mails*, la
colonne « erreur » indique la cause. Presque toujours : le domaine de
`EMAIL_EXPEDITEUR` n'est pas encore vérifié chez Resend.

**Un transporteur n'apparaît pas dans l'annuaire** — son statut n'est pas
`vérifié`, ou il n'a coché aucun service. Les deux se corrigent depuis
*Administration → Transporteurs*.
