/**
 * Parcours complet du site, du premier écran d'installation à la note laissée
 * par le client. Chaque étape vérifie ce que l'utilisateur voit réellement.
 *
 *   node tests/parcours.mjs
 */
/* Playwright peut être installé dans le projet ou globalement ; on essaie les deux. */
let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = await import("/opt/node-tools/node_modules/playwright/index.mjs")); }
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const ADMIN = { email: "admin@routis.dz", mdp: "motdepasse123", nom: "Administrateur" };
const CLIENT = { email: "client@exemple.dz", mdp: "motdepasse123", nom: "Nadia Client" };
const TRANS = { email: "transport@exemple.dz", mdp: "motdepasse123", nom: "Karim Gérant",
                raison: "SARL Transports Atlas" };

let ok = 0, ko = 0;
const echecs = [];
function verifier(nom, condition, detail = "") {
  if (condition) { ok++; console.log("  ✓ " + nom); }
  else { ko++; echecs.push(nom + (detail ? " — " + detail : "")); console.log("  ✗ " + nom + (detail ? " — " + detail : "")); }
}
function titre(t) { console.log("\n" + t + "\n" + "─".repeat(t.length)); }

const texte = async (p) => (await p.locator("body").innerText()).replace(/\s+/g, " ");

/** Attend qu'un texte apparaisse : une action serveur redessine la page après le réseau. */
async function attendre(page, motif, ms = 6000) {
  try { await page.locator(`text=${motif}`).first().waitFor({ timeout: ms }); return true; }
  catch { return false; }
}

/** Choisit une valeur dans une liste filtrable : on tape, puis on prend la 1re. */
async function choisir(page, id, texte) {
  await page.click("#" + id);
  await page.fill("#" + id, texte);
  await page.waitForSelector("#" + id + "-liste .filtrable-opt", { timeout: 8000 });
  await page.locator("#" + id + "-liste .filtrable-opt").first().click();
}

async function connecter(page, email, mdp) {
  await page.goto(BASE + "/deconnexion");
  await page.goto(BASE + "/connexion");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="mot_de_passe"]', mdp);
  await page.click('form.carte button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

/* Un vrai PDF minimal, pour que la vérification des octets d'en-tête passe. */
function pdfExemple(chemin) {
  const contenu = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n";
  fs.writeFileSync(chemin, contenu);
  return chemin;
}

const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ locale: "fr-FR" });
const page = await ctx.newPage();
const dossier = fs.mkdtempSync("/tmp/routis-");
const monPdf = pdfExemple(path.join(dossier, "registre.pdf"));

try {
  /* ------------------------------------------------------------ 1. Installation */
  titre("1. Installation");
  await page.goto(BASE + "/installer");
  let t = await texte(page);
  if (t.includes("Installation de ROUTIS")) {
    await page.fill('input[name="nom"]', ADMIN.nom);
    await page.fill('input[name="email"]', ADMIN.email);
    await page.fill('input[name="mot_de_passe"]', ADMIN.mdp);
    const debut = Date.now();
    await page.click('form.carte button[type="submit"]');
    await page.waitForLoadState("networkidle");
    console.log(`  (import terminé en ${((Date.now() - debut) / 1000).toFixed(1)} s)`);
  }
  t = await texte(page);
  verifier("L'installation aboutit", t.includes("Installation terminée") || t.includes("déjà installé"));

  await page.goto(BASE + "/installer");
  verifier("L'assistant se verrouille une fois installé",
    (await texte(page)).includes("déjà installé"));

  /* ------------------------------------------------------------ 2. Comptes */
  titre("2. Création des comptes");
  for (const [c, type, extra] of [[CLIENT, "client", null], [TRANS, "transporteur", TRANS.raison]]) {
    await page.goto(BASE + "/deconnexion");
    await page.goto(BASE + "/inscription?type=" + type);
    if (extra) await page.fill('input[name="raison_sociale"]', extra);
    await page.fill('input[name="nom"]', c.nom);
    await page.fill('input[name="email"]', c.email);
    await page.fill('input[name="telephone"]', "0550 11 22 33");
    await page.fill('input[name="mot_de_passe"]', c.mdp);
    await page.click('form.carte button[type="submit"]');
    await page.waitForLoadState("networkidle");
    const u = page.url();
    verifier(`Inscription ${type}`, !u.includes("erreur="), u);
  }

  /* Le type de compte doit être visible et modifiable sur le formulaire lui-même :
     c'est un choix définitif, personne ne doit le subir sans le voir. */
  await page.goto(BASE + "/deconnexion");
  await page.goto(BASE + "/inscription");
  verifier("Le formulaire propose les deux types de compte",
    (await page.locator('.choix-role input[name="type"]').count()) === 2);
  verifier("Par défaut, c'est un compte client",
    await page.locator('.choix-role input[value="client"]').isChecked());
  verifier("La raison sociale est masquée pour un client",
    !(await page.locator('input[name="raison_sociale"]').isVisible()));
  await page.locator('.choix-role input[value="transporteur"]').check();
  verifier("Choisir « transporteur » fait apparaître la raison sociale",
    await page.locator('input[name="raison_sociale"]').isVisible());
  await page.goto(BASE + "/inscription?type=transporteur");
  verifier("Le lien direct pré-sélectionne le compte transporteur",
    await page.locator('.choix-role input[value="transporteur"]').isChecked());

  await page.goto(BASE + "/deconnexion");
  await page.goto(BASE + "/inscription?type=client");
  await page.fill('input[name="nom"]', "Doublon");
  await page.fill('input[name="email"]', CLIENT.email);
  await page.fill('input[name="mot_de_passe"]', "motdepasse123");
  await page.click('form.carte button[type="submit"]');
  await page.waitForLoadState("networkidle");
  verifier("Une adresse déjà prise est refusée",
    (await texte(page)).toLowerCase().includes("existe déjà"));

  /* ------------------------------------------------------------ 3. Fiche transporteur */
  titre("3. Fiche entreprise et véhicules");
  await connecter(page, TRANS.email, TRANS.mdp);
  await page.goto(BASE + "/espace/profil");
  await page.fill('input[name="raison_sociale"]', TRANS.raison);
  await page.fill('input[name="forme"]', "SARL");
  await page.fill('input[name="registre"]', "16/00-1234567 B 24");
  await choisir(page, "pays", "Algérie");
  await page.click("#ville_id");
  await page.fill("#ville_id", "");
  await page.waitForSelector("#ville_id-liste .filtrable-opt");
  const villes = await page.locator("#ville_id-liste .filtrable-opt").count();
  verifier("La liste des villes se filtre", villes > 20, villes + " propositions");
  await choisir(page, "ville_id", "Alger");
  await page.fill('input[name="telephone"]', "021 45 67 89");
  await page.fill('textarea[name="description"]', "Transport national de marchandises depuis 2009.");
  await page.check('input[name="service"][value="fret"]');
  await page.check('input[name="equip"][value="hayon"]');
  await page.click('form.carte button[type="submit"]');
  await page.waitForLoadState("networkidle");
  verifier("La fiche entreprise est enregistrée", (await texte(page)).includes("Fiche enregistrée"));

  await page.goto(BASE + "/espace/vehicules");
  await page.selectOption('select[name="categorie"]', "c20");
  await page.fill('input[name="immatriculation"]', "00123-116-16");
  await page.fill('input[name="marque"]', "Renault");
  await page.fill('input[name="modele"]', "Midlum");
  await page.click('form.carte button[type="submit"]');
  await page.waitForLoadState("networkidle");
  verifier("Le véhicule est ajouté", (await texte(page)).includes("Camion 20"));

  /* ------------------------------------------------------------ 4. Documents */
  titre("4. Dépôt et contrôle des documents");
  await page.goto(BASE + "/espace/documents");
  await page.setInputFiles('input[type="file"]', monPdf);
  await page.locator('form:has(input[type="file"]) button[type="submit"]').first().click();
  await page.waitForLoadState("networkidle");
  t = await texte(page);
  verifier("Le document est déposé", t.includes("registre.pdf") || t.includes("en attente"));

  const lien = await page.locator('a[href^="/api/fichier/"]').first().getAttribute("href");
  verifier("Le document n'a pas d'adresse publique devinable",
    Boolean(lien) && lien.startsWith("/api/fichier/"));

  await connecter(page, ADMIN.email, ADMIN.mdp);
  verifier("L'en-tête signale les dossiers à contrôler",
    (await page.locator(".gnav .pastille").count()) > 0,
    await texte(page).then((t) => t.slice(0, 60)));
  await page.goto(BASE + "/admin/documents");
  verifier("Le document apparaît dans la file admin",
    (await texte(page)).includes(TRANS.raison));
  await page.locator('form button:has-text("Valider")').first().click();
  await page.waitForLoadState("networkidle");
  verifier("Le document est validé", (await texte(page)).includes("Document validé"));

  /* ------------------------------------------------------------ 5. Vérification */
  titre("5. Vérification du transporteur");
  await page.goto(BASE + "/admin/transporteurs");
  await page.locator('button:has-text("Vérifier et publier")').first().click();
  await page.waitForLoadState("networkidle");
  verifier("Le transporteur est vérifié", (await texte(page)).includes("vérifié"));

  await page.goto(BASE + "/annuaire");
  verifier("Il apparaît dans l'annuaire public", (await texte(page)).includes(TRANS.raison));

  await page.goto(BASE + "/annuaire?q=Atlas");
  verifier("La recherche par nom le retrouve", (await texte(page)).includes(TRANS.raison));

  /* ------------------------------------------------------------ 6. Demande de devis */
  titre("6. Demande de devis");
  await connecter(page, CLIENT.email, CLIENT.mdp);
  await page.goto(BASE + "/devis?type=fret");
  await choisir(page, "depart", "Alger");
  await choisir(page, "arrivee", "Oran");
  verifier("Le filtre retrouve la ville tapée",
    (await page.inputValue("#arrivee")) === "Oran", await page.inputValue("#arrivee"));
  await page.fill('input[name="nature"]', "Palettes de carrelage");
  await page.fill('input[name="poids"]', "2400");
  await page.click('form.carte button[type="submit"]');
  await page.waitForLoadState("networkidle");
  const urlDemande = page.url();
  verifier("La demande est créée", /\/demande\/\d+/.test(urlDemande), urlDemande);
  const idDemande = parseInt(urlDemande.split("/demande/")[1] ?? "0", 10);
  t = await texte(page);
  verifier("La distance est calculée", /\d+\s*km/.test(t));

  /* ------------------------------------------------------------ 7. Devis */
  titre("7. Réponse du transporteur");
  await connecter(page, TRANS.email, TRANS.mdp);
  verifier("Le transporteur voit qu'une demande l'attend",
    (await page.locator(".gnav .pastille").innerText()).trim().startsWith("1"),
    await page.locator(".gnav .pastille").count() ? "présent" : "absent");
  await page.goto(BASE + "/espace/demandes");
  verifier("Le transporteur voit la demande", (await texte(page)).includes("Palettes de carrelage"));
  await page.fill('form input[name="prix"]', "48000");
  await page.fill('form input[name="delai"]', "Enlèvement sous 48 h");
  await page.fill('form input[name="message"]', "Camion 20 m³ avec hayon, chauffeur expérimenté.");
  await page.locator('form button:has-text("Envoyer mon devis")').first().click();
  await page.waitForLoadState("networkidle");
  verifier("Le devis part au client", (await texte(page)).includes("Devis envoyé"));

  /* ------------------------------------------------------------ 8. Acceptation */
  titre("8. Acceptation et mission");
  await connecter(page, CLIENT.email, CLIENT.mdp);
  await page.goto(BASE + "/demande/" + idDemande);
  t = await texte(page);
  verifier("Le client voit le devis", t.includes("48 000") || t.includes("48000"));
  verifier("Le prix est affiché en dinars", t.includes("DZD"));
  await page.locator('button:has-text("Accepter")').first().click();
  await page.waitForLoadState("networkidle");
  t = await texte(page);
  verifier("Le devis est accepté", await attendre(page, "Votre transporteur"));
  verifier("Le contact du transporteur est révélé après acceptation",
    t.includes("021 45 67 89"));

  await page.locator('button:has-text("Marquer la mission terminée")').first().click();
  await page.waitForLoadState("networkidle");
  verifier("La mission peut être clôturée", await attendre(page, "Noter "));

  await page.fill('textarea[name="commentaire"]', "Ponctuel et soigneux, je recommande.");
  await page.locator('form button:has-text("Publier mon avis")').first().click();
  await page.waitForLoadState("networkidle");
  verifier("L'avis est enregistré", await attendre(page, "recommande"));

  await page.goto(BASE + "/transporteur/1");
  t = await texte(page);
  verifier("L'avis apparaît sur la fiche publique", t.includes("recommande"));
  verifier("La note est calculée", /\/\s*5/.test(t));

  /* ------------------------------------------------------------ 9. Côté transporteur */
  titre("9. Suivi côté transporteur");
  await connecter(page, TRANS.email, TRANS.mdp);
  await page.goto(BASE + "/espace/demandes");
  verifier("Le transporteur garde sa mission gagnée sous les yeux",
    (await texte(page)).includes("Mission gagnée"));

  /* ------------------------------------------------------------ 10. Admin */
  titre("10. Tableau de bord");
  await connecter(page, ADMIN.email, ADMIN.mdp);
  await page.goto(BASE + "/admin");
  t = await texte(page);
  verifier("Les compteurs sont alimentés", t.includes("Transporteurs") && t.includes("Devis"));
  verifier("Le journal enregistre les actions", t.includes("devis_accepte") || t.includes("connexion"));
  await page.goto(BASE + "/admin/demandes");
  verifier("La demande figure dans l'administration", (await texte(page)).includes("RTS-"));
  await page.goto(BASE + "/admin/emails");
  verifier("Le journal des e-mails est consultable", (await texte(page)).includes("Journal des e-mails"));
} catch (e) {
  ko++;
  echecs.push("Exception : " + e.message);
  console.log("\n✗ Exception : " + e.message);
} finally {
  await navigateur.close();
}

console.log(`\n${"═".repeat(52)}\n${ok} réussites · ${ko} échecs`);
if (echecs.length) { console.log("\nÀ corriger :"); echecs.forEach((e) => console.log(" • " + e)); }
process.exit(ko ? 1 : 0);
