/**
 * Contrat de génération de PDF.
 *
 * `template` identifie un gabarit connu de l'implémentation ;
 * `data` porte les données typées attendues par ce gabarit.
 * Le résultat est un Buffer prêt à être renvoyé en téléchargement.
 */
export interface PdfGeneratorPort {
  generate<TData>(template: string, data: TData): Promise<Buffer>;
}

/** Jeton d'injection du générateur PDF. */
export const PDF_GENERATOR = Symbol('PDF_GENERATOR');

/** Gabarits disponibles dans cette version du socle. */
export const PDF_TEMPLATE_TECHNICAL_DEMO = 'technical-demo';

/** Données du gabarit de démonstration technique. */
export interface TechnicalDemoPdfData {
  generatedAt: Date;
  userId: string;
  requestId: string | null;
}
