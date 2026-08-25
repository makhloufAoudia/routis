/**
 * ROUTIS — structure de la base PostgreSQL.
 * Chaque instruction est exécutée une par une par l'assistant d'installation.
 */
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS pays (
     code       CHAR(2) PRIMARY KEY,
     nom        VARCHAR(120) NOT NULL,
     devise     CHAR(3) NOT NULL DEFAULT 'EUR',
     continent  CHAR(2) NOT NULL DEFAULT '',
     indicatif  VARCHAR(6) NOT NULL DEFAULT '',
     actif      BOOLEAN NOT NULL DEFAULT false,
     tva        NUMERIC(5,2) NOT NULL DEFAULT 0
   )`,

  `CREATE TABLE IF NOT EXISTS villes (
     id         SERIAL PRIMARY KEY,
     nom        VARCHAR(120) NOT NULL,
     pays       CHAR(2) NOT NULL,
     lat        NUMERIC(9,5) NOT NULL,
     lon        NUMERIC(9,5) NOT NULL,
     population INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE INDEX IF NOT EXISTS idx_villes_pays ON villes (pays)`,
  `CREATE INDEX IF NOT EXISTS idx_villes_nom  ON villes (lower(nom))`,

  `CREATE TABLE IF NOT EXISTS utilisateurs (
     id                 SERIAL PRIMARY KEY,
     role               VARCHAR(15) NOT NULL DEFAULT 'client',
     email              VARCHAR(190) NOT NULL UNIQUE,
     telephone          VARCHAR(40) NOT NULL DEFAULT '',
     nom                VARCHAR(150) NOT NULL,
     mot_de_passe       VARCHAR(255) NOT NULL,
     statut             VARCHAR(15) NOT NULL DEFAULT 'actif',
     cree_le            TIMESTAMPTZ NOT NULL DEFAULT now(),
     derniere_connexion TIMESTAMPTZ
   )`,

  `CREATE TABLE IF NOT EXISTS sessions (
     id             CHAR(64) PRIMARY KEY,
     utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
     expire_le      TIMESTAMPTZ NOT NULL,
     cree_le        TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions (expire_le)`,

  `CREATE TABLE IF NOT EXISTS transporteurs (
     id             SERIAL PRIMARY KEY,
     utilisateur_id INTEGER NOT NULL UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
     raison_sociale VARCHAR(190) NOT NULL,
     forme          VARCHAR(40) NOT NULL DEFAULT '',
     registre       VARCHAR(80) NOT NULL DEFAULT '',
     pays           CHAR(2) NOT NULL DEFAULT 'DZ',
     ville_id       INTEGER,
     adresse        VARCHAR(220) NOT NULL DEFAULT '',
     telephone      VARCHAR(40) NOT NULL DEFAULT '',
     site_web       VARCHAR(190) NOT NULL DEFAULT '',
     description    TEXT,
     annee_creation SMALLINT,
     effectif       VARCHAR(20) NOT NULL DEFAULT '',
     couverture     VARCHAR(20) NOT NULL DEFAULT 'nationale',
     statut         VARCHAR(15) NOT NULL DEFAULT 'brouillon',
     motif_refus    VARCHAR(255) NOT NULL DEFAULT '',
     note           NUMERIC(3,2) NOT NULL DEFAULT 0,
     nb_missions    INTEGER NOT NULL DEFAULT 0,
     cree_le        TIMESTAMPTZ NOT NULL DEFAULT now(),
     verifie_le     TIMESTAMPTZ
   )`,
  `CREATE INDEX IF NOT EXISTS idx_tr_statut ON transporteurs (statut)`,
  `CREATE INDEX IF NOT EXISTS idx_tr_pays   ON transporteurs (pays)`,

  `CREATE TABLE IF NOT EXISTS transporteur_services (
     transporteur_id INTEGER NOT NULL REFERENCES transporteurs(id) ON DELETE CASCADE,
     service         VARCHAR(20) NOT NULL,
     PRIMARY KEY (transporteur_id, service)
   )`,

  `CREATE TABLE IF NOT EXISTS transporteur_equipements (
     transporteur_id INTEGER NOT NULL REFERENCES transporteurs(id) ON DELETE CASCADE,
     equipement      VARCHAR(20) NOT NULL,
     PRIMARY KEY (transporteur_id, equipement)
   )`,

  `CREATE TABLE IF NOT EXISTS vehicules (
     id              SERIAL PRIMARY KEY,
     transporteur_id INTEGER NOT NULL REFERENCES transporteurs(id) ON DELETE CASCADE,
     categorie       VARCHAR(10) NOT NULL,
     immatriculation VARCHAR(40) NOT NULL DEFAULT '',
     marque          VARCHAR(60) NOT NULL DEFAULT '',
     modele          VARCHAR(60) NOT NULL DEFAULT '',
     annee           SMALLINT,
     charge_kg       INTEGER,
     volume_m3       NUMERIC(6,2),
     places          SMALLINT,
     actif           BOOLEAN NOT NULL DEFAULT true,
     cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  `CREATE TABLE IF NOT EXISTS documents (
     id              SERIAL PRIMARY KEY,
     transporteur_id INTEGER NOT NULL REFERENCES transporteurs(id) ON DELETE CASCADE,
     type            VARCHAR(30) NOT NULL,
     cle_fichier     VARCHAR(190) NOT NULL,
     nom_origine     VARCHAR(190) NOT NULL DEFAULT '',
     type_mime       VARCHAR(80) NOT NULL DEFAULT '',
     taille          INTEGER NOT NULL DEFAULT 0,
     expire_le       DATE,
     statut          VARCHAR(15) NOT NULL DEFAULT 'en_attente',
     motif_refus     VARCHAR(255) NOT NULL DEFAULT '',
     controle_par    INTEGER,
     controle_le     TIMESTAMPTZ,
     cree_le         TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (transporteur_id, type)
   )`,

  `CREATE TABLE IF NOT EXISTS demandes (
     id                 SERIAL PRIMARY KEY,
     reference          VARCHAR(20) NOT NULL UNIQUE,
     client_id          INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
     type               VARCHAR(10) NOT NULL DEFAULT 'fret',
     ville_depart       INTEGER NOT NULL,
     ville_arrivee      INTEGER NOT NULL,
     distance_km        INTEGER NOT NULL DEFAULT 0,
     date_souhaitee     DATE,
     nature             VARCHAR(120) NOT NULL DEFAULT '',
     poids_kg           INTEGER,
     volume_m3          NUMERIC(6,2),
     palettes           SMALLINT,
     passagers          SMALLINT,
     equipements        VARCHAR(190) NOT NULL DEFAULT '',
     precisions         TEXT,
     transporteur_cible INTEGER,
     statut             VARCHAR(15) NOT NULL DEFAULT 'ouverte',
     cree_le            TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_dem_client ON demandes (client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_dem_statut ON demandes (statut)`,

  `CREATE TABLE IF NOT EXISTS devis (
     id              SERIAL PRIMARY KEY,
     demande_id      INTEGER NOT NULL REFERENCES demandes(id) ON DELETE CASCADE,
     transporteur_id INTEGER NOT NULL REFERENCES transporteurs(id) ON DELETE CASCADE,
     prix            NUMERIC(12,2) NOT NULL,
     devise          CHAR(3) NOT NULL DEFAULT 'DZD',
     delai           VARCHAR(120) NOT NULL DEFAULT '',
     message         TEXT,
     valide_jusqu_au DATE,
     statut          VARCHAR(15) NOT NULL DEFAULT 'envoye',
     cree_le         TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (demande_id, transporteur_id)
   )`,

  `CREATE TABLE IF NOT EXISTS avis (
     id              SERIAL PRIMARY KEY,
     demande_id      INTEGER NOT NULL UNIQUE REFERENCES demandes(id) ON DELETE CASCADE,
     transporteur_id INTEGER NOT NULL REFERENCES transporteurs(id) ON DELETE CASCADE,
     client_id       INTEGER NOT NULL,
     note            SMALLINT NOT NULL,
     commentaire     TEXT,
     cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  `CREATE TABLE IF NOT EXISTS jetons (
     id             SERIAL PRIMARY KEY,
     utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
     jeton          CHAR(64) NOT NULL UNIQUE,
     usage_prevu    VARCHAR(30) NOT NULL DEFAULT 'mot_de_passe',
     expire_le      TIMESTAMPTZ NOT NULL,
     utilise_le     TIMESTAMPTZ,
     cree_le        TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  `CREATE TABLE IF NOT EXISTS emails (
     id           SERIAL PRIMARY KEY,
     destinataire VARCHAR(190) NOT NULL,
     sujet        VARCHAR(190) NOT NULL,
     corps        TEXT NOT NULL,
     statut       VARCHAR(10) NOT NULL DEFAULT 'envoye',
     erreur       VARCHAR(255) NOT NULL DEFAULT '',
     cree_le      TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  `CREATE TABLE IF NOT EXISTS journal (
     id             SERIAL PRIMARY KEY,
     utilisateur_id INTEGER,
     action         VARCHAR(60) NOT NULL,
     cible          VARCHAR(120) NOT NULL DEFAULT '',
     details        VARCHAR(255) NOT NULL DEFAULT '',
     cree_le        TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  `CREATE TABLE IF NOT EXISTS reglages (
     cle    VARCHAR(60) PRIMARY KEY,
     valeur TEXT NOT NULL
   )`,
];
