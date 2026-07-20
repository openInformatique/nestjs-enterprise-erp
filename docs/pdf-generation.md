# Génération de PDF

## Contrat

```typescript
export interface PdfGeneratorPort {
  generate<TData>(template: string, data: TData): Promise<Buffer>;
}
```

Injection via `PDF_GENERATOR`. Un gabarit inconnu lève `RESOURCE_NOT_FOUND`.

## Implémentation

`PdfKitPdfGenerator` (PDFKit) : bibliothèque serveur stable, sans navigateur
headless. Chaque gabarit est une méthode privée ; le seul gabarit fourni est
`technical-demo` (`PDF_TEMPLATE_TECHNICAL_DEMO`) : titre, date de génération,
identifiant utilisateur, request ID et données fictives non métier.

## Démonstration

`GET /api/v1/technical-demo/pdf` (si `TECHNICAL_DEMO_ENDPOINTS_ENABLED=true`,
JWT requis) renvoie le PDF en téléchargement (`Content-Type: application/pdf`,
`Content-Disposition: attachment`), HORS enveloppe JSON. Chaque génération est
auditée (`pdf.demo.generated`).

## Ajouter un gabarit

1. déclarer la constante du nom et l'interface des données dans
   `domain/pdf-generator.port.ts` ;
2. ajouter la méthode de rendu dans `PdfKitPdfGenerator` et l'entrée dans le
   dispatch de `generate()` ;
3. créer un cas d'utilisation dédié dans le module appelant (avec audit si
   pertinent) ;
4. tester : buffer non vide, signature `%PDF-`, contenu attendu.

Si les besoins de mise en page dépassent PDFKit (HTML/CSS complexes), un
adaptateur alternatif (ex. Playwright + Chromium) peut implémenter le même
port sans impacter les consommateurs.
