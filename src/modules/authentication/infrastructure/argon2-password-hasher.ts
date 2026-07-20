import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PasswordHasherPort } from '../domain/password-hasher.port';

/**
 * Hachage de mots de passe avec Argon2id.
 *
 * Argon2id est l'algorithme recommandé (résistant aux attaques par GPU
 * et par canaux auxiliaires). Les paramètres par défaut de la
 * bibliothèque suivent les recommandations OWASP.
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasherPort {
  async hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, { type: argon2.argon2id });
  }

  async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, plainPassword);
    } catch {
      // Hash illisible ou corrompu : refus, jamais d'exception technique
      // remontée au consommateur.
      return false;
    }
  }
}
