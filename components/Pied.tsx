import Link from "next/link";

export default function Pied() {
  return (
    <footer className="pied">
      <div className="pied-in">
        <div>
          <p className="cta">Commencer avec <span>routis</span> aujourd&apos;hui.</p>
          <p className="small">Trouvez un transporteur vérifié, obtenez un prix ferme, suivez votre mission.
            Inscription gratuite.</p>
          <p><Link className="btn" href="/inscription?type=transporteur">Inscrire mon entreprise</Link></p>
        </div>
        <div>
          <h4>Clients</h4>
          <Link href="/devis?type=fret">Transporter des marchandises</Link>
          <Link href="/devis?type=pax">Transport de personnes</Link>
          <Link href="/annuaire">Annuaire des transporteurs</Link>
          <Link href="/mes-demandes">Suivre mes demandes</Link>
        </div>
        <div>
          <h4>Transporteurs</h4>
          <Link href="/inscription?type=transporteur">Inscrire mon entreprise</Link>
          <Link href="/espace">Mon espace</Link>
          <Link href="/page/documents">Documents à fournir</Link>
          <Link href="/page/commission">Commission et facturation</Link>
        </div>
        <div>
          <h4>Informations</h4>
          <Link href="/page/apropos">Qui sommes-nous</Link>
          <Link href="/page/contact">Nous contacter</Link>
          <Link href="/page/cgu">Conditions générales</Link>
          <Link href="/page/confidentialite">Confidentialité</Link>
        </div>
      </div>
      <div className="pied-bas">
        <div className="pied-bas-in">
          <span>© {new Date().getFullYear()} ROUTIS</span>
          <span className="sp" />
          <span>Commission plateforme : 15 %</span>
        </div>
      </div>
    </footer>
  );
}
