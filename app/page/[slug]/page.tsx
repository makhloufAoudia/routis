import Link from "next/link";
import { notFound } from "next/navigation";

const PAGES: Record<string, { titre: string; texte: string }> = {
  apropos: { titre: "Qui sommes-nous", texte: "ROUTIS met en relation les clients et les entreprises de transport vérifiées. Chaque transporteur référencé a fourni son registre de commerce, sa licence de transport et son attestation d'assurance, contrôlés avant mise en ligne." },
  contact: { titre: "Nous contacter", texte: "Écrivez-nous à contact@example.com. Nous répondons sous 24 heures ouvrées." },
  cgu: { titre: "Conditions générales", texte: "Texte à rédiger avec votre conseil juridique avant l'ouverture commerciale. Il doit préciser le rôle de la plateforme (intermédiaire ou commissionnaire de transport), les responsabilités de chaque partie, le barème d'annulation et la procédure de litige." },
  confidentialite: { titre: "Politique de confidentialité", texte: "Texte à rédiger avec votre conseil juridique. Il doit indiquer les données collectées, leur durée de conservation, les sous-traitants et les modalités d'exercice des droits d'accès, de rectification et de suppression." },
  documents: { titre: "Documents à fournir", texte: "Pour être référencé, un transporteur dépose : registre de commerce, licence de transport correspondant au tonnage, attestation d'assurance en cours de validité, contrôle technique et pièce d'identité du gérant. Chaque pièce porte une date d'expiration ; à l'échéance, l'entreprise sort automatiquement des résultats." },
  commission: { titre: "Commission et facturation", texte: "La plateforme prélève une commission sur chaque mission conclue. Elle est indiquée sur le devis et facturée au transporteur." },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: PAGES[slug]?.titre ?? "Page introuvable" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = PAGES[slug];
  if (!p) notFound();
  return (
    <div style={{ maxWidth: 720 }}>
      <h1>{p.titre}</h1>
      <div className="carte"><p style={{ margin: 0 }}>{p.texte}</p></div>
      <p><Link className="btn sec" href="/">Retour à l&apos;accueil</Link></p>
    </div>
  );
}
