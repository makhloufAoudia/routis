"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type Choix = { v: string; l: string; sous?: string };

/**
 * Liste déroulante que l'on filtre en tapant.
 *
 * Le composant commence par afficher une vraie liste déroulante HTML, puis la
 * remplace par le champ filtrable une fois la page active. Sans JavaScript, le
 * formulaire reste donc utilisable tel quel — c'est la liste classique qui
 * s'affiche, et elle fonctionne.
 */
export default function ListeFiltrable({
  nom,
  options,
  valeur = "",
  vide = "— choisir —",
  requis = false,
  indication,
  id,
  auChangement,
}: {
  nom: string;
  options: Choix[];
  valeur?: string;
  vide?: string;
  requis?: boolean;
  indication?: string;
  id?: string;
  auChangement?: (v: string) => void;
}) {
  const idAuto = useId();
  const idChamp = id ?? nom + idAuto;
  const [monte, setMonte] = useState(false);
  const [choisi, setChoisi] = useState(valeur);
  const [texte, setTexte] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLUListElement>(null);

  useEffect(() => setMonte(true), []);

  // Le libellé de l'option retenue, affiché tant qu'on ne filtre pas.
  const libelleChoisi = useMemo(
    () => options.find((o) => o.v === choisi)?.l ?? "",
    [options, choisi]
  );

  useEffect(() => { setChoisi(valeur); }, [valeur]);
  useEffect(() => { if (!ouvert) setTexte(""); }, [ouvert]);

  const resultats = useMemo(() => {
    // Le choix vide reste proposé : sans lui, impossible de revenir en arrière
    // une fois une option retenue.
    const tous: Choix[] = vide ? [{ v: "", l: vide }, ...options] : options;
    const t = sansAccents(texte);
    if (!t) return tous.slice(0, 60);
    const debut: Choix[] = [];
    const dedans: Choix[] = [];
    for (const o of tous) {
      const l = sansAccents(o.l);
      if (l.startsWith(t)) debut.push(o);
      else if (l.includes(t)) dedans.push(o);
      if (debut.length >= 60) break;
    }
    return [...debut, ...dedans].slice(0, 60);
  }, [options, texte, vide]);

  useEffect(() => { setActif(0); }, [texte]);

  // Refermer quand on clique ailleurs.
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      const c = e.target as Node;
      if (!champ.current?.contains(c) && !listeRef.current?.contains(c)) setOuvert(false);
    };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [ouvert]);

  // Garder l'option survolée visible.
  useEffect(() => {
    if (!ouvert || !listeRef.current) return;
    const el = listeRef.current.children[actif] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [actif, ouvert]);

  function retenir(o: Choix) {
    setChoisi(o.v);
    setOuvert(false);
    setTexte("");
    auChangement?.(o.v);
    champ.current?.focus();
  }

  function auClavier(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!ouvert) { setOuvert(true); return; }
      const pas = e.key === "ArrowDown" ? 1 : -1;
      setActif((i) => (i + pas + resultats.length) % Math.max(1, resultats.length));
      return;
    }
    if (e.key === "Enter") {
      if (ouvert && resultats[actif]) { e.preventDefault(); retenir(resultats[actif]); }
      return;
    }
    if (e.key === "Escape") { setOuvert(false); return; }
    if (e.key === "Tab") setOuvert(false);
  }

  /* Avant activation de la page — et sans JavaScript — la liste classique. */
  if (!monte) {
    return (
      <select id={idChamp} name={nom} defaultValue={valeur} required={requis}>
        {vide && <option value="">{vide}</option>}
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    );
  }

  return (
    <>
      <input type="hidden" name={nom} value={choisi} />
      <input
        id={idChamp}
        ref={champ}
        className="filtrable-champ"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={ouvert}
        aria-controls={idChamp + "-liste"}
        aria-autocomplete="list"
        aria-activedescendant={ouvert && resultats[actif] ? idChamp + "-o" + actif : undefined}
        placeholder=" "
        value={ouvert ? texte : libelleChoisi}
        onChange={(e) => { setTexte(e.target.value); setOuvert(true); }}
        onFocus={() => setOuvert(true)}
        onClick={() => setOuvert(true)}
        onKeyDown={auClavier}
        required={requis && !choisi}
      />
      <span className="filtrable-fleche" aria-hidden="true" />

      {ouvert && (
        <ul className="filtrable-liste" id={idChamp + "-liste"} role="listbox" ref={listeRef}>
          {resultats.length === 0 && (
            <li className="filtrable-rien" role="presentation">
              Aucun résultat pour « {texte} »
            </li>
          )}
          {resultats.map((o, i) => (
            <li
              key={o.v}
              id={idChamp + "-o" + i}
              role="option"
              aria-selected={o.v === choisi}
              className={"filtrable-opt" + (i === actif ? " actif" : "") + (o.v === choisi ? " retenu" : "")}
              onMouseEnter={() => setActif(i)}
              onMouseDown={(e) => { e.preventDefault(); retenir(o); }}
            >
              <span>{o.l}</span>
              {o.sous && <span className="filtrable-sous">{o.sous}</span>}
            </li>
          ))}
        </ul>
      )}

      {indication && !ouvert && <div className="aide">{indication}</div>}
    </>
  );
}

/** Comparer sans se soucier des accents ni de la casse : « Bejaia » trouve « Béjaïa ». */
function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
