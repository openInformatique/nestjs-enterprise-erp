/**
 * Rôles applicatifs de l'ERP (RBAC simple à trois niveaux).
 *
 * ADMIN    : gestion des utilisateurs et des rôles, suppression de données.
 * MANAGER  : gestion métier courante (contacts, catalogue, devis...).
 * EMPLOYEE : consultation et opérations du quotidien (rôle par défaut).
 *
 * La valeur (chaîne) est stockée telle quelle en base : ne JAMAIS
 * renommer une valeur existante sans migration de données.
 */
export enum UserRole {
  Admin = 'ADMIN',
  Manager = 'MANAGER',
  Employee = 'EMPLOYEE',
}
