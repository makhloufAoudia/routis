import Link from "next/link";
export const metadata = { title: "Accès refusé" };
export default function Page() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1>Accès refusé</h1>
      <div className="msg err">Cette page n&apos;est pas accessible avec votre type de compte.</div>
      <p><Link className="btn" href="/">Retour à l&apos;accueil</Link></p>
    </div>
  );
}
