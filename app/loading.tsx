/**
 * Affiché dès le clic sur un onglet, sans attendre le serveur.
 *
 * Les pages sont calculées à chaque visite : entre le clic et la réponse, il
 * s'écoule parfois une seconde ou deux — davantage si la base sort de veille.
 * Sans ce signe, on croit que le clic n'a pas été pris.
 */
export default function Chargement() {
  return (
    <div className="carte patience" role="status" aria-live="polite">
      <span className="rondelle" aria-hidden="true" />
      <span>Chargement, veuillez patienter…</span>
    </div>
  );
}
