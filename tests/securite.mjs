/**
 * Contrôles de sécurité : chaque test se met à la place de quelqu'un qui essaie
 * d'obtenir ce à quoi il n'a pas droit. À lancer après tests/parcours.mjs,
 * qui crée les comptes et les données utilisés ici.
 *
 *   node tests/securite.mjs
 */
/* Playwright peut être installé dans le projet ou globalement ; on essaie les deux. */
let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = await import("/opt/node-tools/node_modules/playwright/index.mjs")); }

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const ADMIN = { email: "admin@routis.dz", mdp: "motdepasse123" };
const CLIENT = { email: "client@exemple.dz", mdp: "motdepasse123" };
const TRANS = { email: "transport@exemple.dz", mdp: "motdepasse123" };

let ok = 0, ko = 0;
const echecs = [];
function verifier(nom, condition, detail = "") {
  if (condition) { ok++; console.log("  ✓ " + nom); }
  else { ko++; echecs.push(nom + (detail ? " — " + detail : "")); console.log("  ✗ " + nom + (detail ? " — " + detail : "")); }
}
function titre(t) { console.log("\n" + t + "\n" + "─".repeat(t.length)); }
const texte = async (p) => (await p.locator("body").innerText()).replace(/\s+/g, " ");

/** Appelle une adresse depuis la page elle-même, avec la session en cours. */
async function appel(page, url) {
  return await page.evaluate(async (u) => {
    const r = await fetch(u, { redirect: "manual" });
    const h = {};
    r.headers.forEach((v, k) => { h[k] = v; });
    return { statut: r.status, entetes: h };
  }, url);
}

async function connecter(page, c) {
  await page.goto(BASE + "/deconnexion");
  await page.goto(BASE + "/connexion");
  await page.fill('input[name="email"]', c.email);
  await page.fill('input[name="mot_de_passe"]', c.mdp);
  await page.click('form.carte button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ locale: "fr-FR" });
const page = await ctx.newPage();

try {
  /* ---------------------------------------------------- Pages protégées */
  titre("1. Pages réservées");
  await page.goto(BASE + "/deconnexion");
  for (const url of ["/admin", "/admin/transporteurs", "/admin/documents", "/admin/emails",
                     "/espace", "/espace/documents", "/mes-demandes"]) {
    const r = await page.goto(BASE + url);
    const final = page.url();
    verifier(`${url} exige une connexion`,
      final.includes("/connexion") || r.status() === 401 || r.status() === 403, final);
  }

  titre("2. Cloisonnement des rôles");
  await connecter(page, CLIENT);
  for (const url of ["/admin", "/admin/transporteurs", "/admin/documents",
                     "/admin/demandes", "/admin/emails", "/espace/profil", "/espace/demandes"]) {
    await page.goto(BASE + url);
    verifier(`Un client n'atteint pas ${url}`, page.url().includes("acces-refuse"), page.url());
  }
  await connecter(page, TRANS);
  for (const url of ["/admin", "/admin/documents"]) {
    await page.goto(BASE + url);
    verifier(`Un transporteur n'atteint pas ${url}`, page.url().includes("acces-refuse"), page.url());
  }

  /* ---------------------------------------------------- Documents */
  titre("3. Documents déposés");
  await page.goto(BASE + "/deconnexion");
  let r;
  await page.goto(BASE + "/");
  const repAnon = await appel(page, "/api/fichier/1");
  verifier("Un visiteur ne télécharge aucun document", repAnon.statut === 401, "HTTP " + repAnon.statut);

  await connecter(page, CLIENT);
  const repClient = await appel(page, "/api/fichier/1");
  verifier("Un client ne télécharge pas le document d'un transporteur",
    repClient.statut === 403, "HTTP " + repClient.statut);

  await connecter(page, ADMIN);
  // Requête directe : le navigateur téléchargerait le PDF au lieu de l'afficher.
  const rep = await appel(page, "/api/fichier/1");
  verifier("L'administrateur y accède", rep.statut === 200, "HTTP " + rep.statut);
  const entetes = rep.entetes;
  verifier("Le document n'est jamais mis en cache",
    (entetes["cache-control"] ?? "").includes("no-store"), entetes["cache-control"]);
  verifier("Le type du fichier n'est pas deviné par le navigateur",
    entetes["x-content-type-options"] === "nosniff");

  const rep404 = await appel(page, "/api/fichier/999999");
  verifier("Un identifiant inexistant ne révèle rien", rep404.statut === 404, "HTTP " + rep404.statut);

  /* ---------------------------------------------------- Demandes d'autrui */
  titre("4. Accès aux demandes des autres");
  await connecter(page, TRANS);
  r = await page.goto(BASE + "/demande/1");
  verifier("Un transporteur n'ouvre pas la demande d'un client",
    r.status() === 404, "HTTP " + r.status());

  /* ---------------------------------------------------- Injection SQL */
  titre("5. Injection SQL");
  const charges = [
    "' OR '1'='1", "'; DROP TABLE utilisateurs; --", "1' UNION SELECT NULL,NULL,NULL--",
    "%' OR 1=1 --", "\\'; DELETE FROM transporteurs WHERE '1'='1",
  ];
  for (const charge of charges) {
    await page.goto(BASE + "/annuaire?q=" + encodeURIComponent(charge));
    const t = await texte(page);
    verifier(`L'annuaire résiste à « ${charge.slice(0, 24)}… »`,
      !t.toLowerCase().includes("syntax") && !t.toLowerCase().includes("erreur interne")
      && !t.includes("pg_") && page.url().includes("/annuaire"));
  }
  await page.goto(BASE + "/annuaire?pays=" + encodeURIComponent("DZ' OR '1'='1"));
  verifier("Un filtre pays trafiqué ne renvoie pas tout",
    !(await texte(page)).toLowerCase().includes("syntax"));

  await connecter(page, ADMIN);
  const restantes = await page.goto(BASE + "/admin");
  verifier("Les tables sont intactes après les tentatives",
    restantes.status() === 200 && (await texte(page)).includes("Transporteurs"));

  /* ---------------------------------------------------- XSS */
  titre("6. Injection de script");
  await connecter(page, TRANS);
  await page.goto(BASE + "/espace/profil");
  const poison = '<img src=x onerror="window.__xss=1">' + "<script>window.__xss=1<\/script>";
  await page.fill('textarea[name="description"]', "Description " + poison);
  await page.click('form.carte button[type="submit"]');
  await page.waitForLoadState("networkidle");
  await page.goto(BASE + "/transporteur/1");
  await page.waitForTimeout(600);
  const execute = await page.evaluate(() => Boolean(window.__xss));
  verifier("Le script injecté ne s'exécute pas sur la fiche publique", !execute);
  verifier("Il est affiché comme du texte", (await texte(page)).includes("onerror"));
  await page.goto(BASE + "/annuaire?q=" + encodeURIComponent(poison));
  await page.waitForTimeout(400);
  verifier("Ni dans les résultats de recherche",
    !(await page.evaluate(() => Boolean(window.__xss))));

  // On remet une description propre.
  await page.goto(BASE + "/espace/profil");
  await page.fill('textarea[name="description"]', "Transport national de marchandises depuis 2009.");
  await page.click('form.carte button[type="submit"]');
  await page.waitForLoadState("networkidle");

  /* ---------------------------------------------------- Session */
  titre("7. Session et mot de passe");
  const biscuits = await ctx.cookies();
  const session = biscuits.find((c) => c.name === "routis_session");
  verifier("Le cookie de session existe", Boolean(session));
  verifier("Il est inaccessible au JavaScript", session?.httpOnly === true);
  verifier("Il est protégé contre les envois inter-sites", session?.sameSite === "Lax");
  verifier("Son identifiant est imprévisible",
    Boolean(session) && /^[a-f0-9]{64}$/.test(session.value));

  await page.goto(BASE + "/espace");
  const avantVol = page.url();
  await ctx.addCookies([{ ...session, value: "f".repeat(64) }]);
  await page.goto(BASE + "/espace");
  verifier("Un cookie fabriqué de toutes pièces ne donne rien",
    page.url().includes("/connexion"), avantVol + " → " + page.url());

  await connecter(page, TRANS);
  const apres = (await ctx.cookies()).find((c) => c.name === "routis_session");
  await page.goto(BASE + "/deconnexion");
  await ctx.addCookies([apres]);
  await page.goto(BASE + "/espace");
  verifier("Une session déconnectée n'est plus réutilisable",
    page.url().includes("/connexion"), page.url());

  titre("8. Tentatives répétées");
  await page.goto(BASE + "/deconnexion");
  let bloque = false;
  for (let i = 0; i < 7; i++) {
    await page.goto(BASE + "/connexion");
    // Adresse jetable : inutile de bloquer un vrai compte pour la suite des tests.
    await page.fill('input[name="email"]', "intrus@exemple.dz");
    await page.fill('input[name="mot_de_passe"]', "mauvais" + i);
    await page.click('form.carte button[type="submit"]');
    await page.waitForLoadState("networkidle");
    const t = (await texte(page)).toLowerCase();
    if (t.includes("trop de tentatives") || t.includes("patientez") || t.includes("réessayez")) {
      bloque = true; break;
    }
  }
  verifier("Les essais de mot de passe en série sont freinés", bloque);

  /* ---------------------------------------------------- Divers */
  titre("9. Divers");
  r = await page.goto(BASE + "/installer");
  verifier("L'assistant d'installation reste verrouillé",
    (await texte(page)).includes("déjà installé"));

  r = await page.goto(BASE + "/transporteur/999999");
  verifier("Une fiche inexistante renvoie une page 404", r.status() === 404, "HTTP " + r.status());

  r = await page.goto(BASE + "/");
  verifier("Le serveur n'annonce pas la technologie employée",
    !("x-powered-by" in r.headers()), r.headers()["x-powered-by"]);
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
