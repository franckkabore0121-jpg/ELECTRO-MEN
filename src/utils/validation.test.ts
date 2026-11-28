import { describe, expect, it } from 'vitest';
import {
  evaluatePasswordStrength,
  validatePersonData,
  validateStrictEmail,
  validateStrongPassword
} from './validation.ts';

describe('validateStrictEmail', () => {
  it('accepts genuine personal and corporate email addresses', () => {
    expect(validateStrictEmail('franckkabore0121@gmail.com').isValid).toBe(true);
    expect(validateStrictEmail('moussa.ouedraogo@fasomail.bf').isValid).toBe(true);
    expect(validateStrictEmail('contact@electromen.bf').isValid).toBe(true);
    expect(validateStrictEmail('aminata-traore92@yahoo.fr').isValid).toBe(true);
    expect(validateStrictEmail('k.compaore+ir@proton.me').isValid).toBe(true);
  });

  it('rejects malformed, missing-TLD, or short-TLD emails', () => {
    expect(validateStrictEmail('azerty123@qwerty').isValid).toBe(false);
    expect(validateStrictEmail('test@test.c').isValid).toBe(false);
    expect(validateStrictEmail('nom prenom@gmail.com').isValid).toBe(false);
    expect(validateStrictEmail('invalide@@gmail.com').isValid).toBe(false);
    expect(validateStrictEmail('a@gmail.com').isValid).toBe(false);
  });

  it('rejects gibberish, keyboard mash, bogus domains, and disposable email services', () => {
    expect(validateStrictEmail('kjhgfdsa@abc.com').isValid).toBe(false);
    expect(validateStrictEmail('azerty123@gmail.com').isValid).toBe(false);
    expect(validateStrictEmail('qsdflkjh@yahoo.fr').isValid).toBe(false);
    expect(validateStrictEmail('aaaaaaa@gmail.com').isValid).toBe(false);
    expect(validateStrictEmail('12345678@gmail.com').isValid).toBe(false);
    expect(validateStrictEmail('ibrahim@yopmail.com').isValid).toBe(false);
    expect(validateStrictEmail('ibrahim@mailinator.com').isValid).toBe(false);
    expect(validateStrictEmail('ibrahim@example.com').isValid).toBe(false);
    expect(validateStrictEmail('ibrahim@domain.test').isValid).toBe(false);
  });
});

describe('evaluatePasswordStrength & validateStrongPassword', () => {
  const context = {
    email: 'ibrahim.ouedraogo@fasomail.bf',
    firstName: 'Ibrahim',
    lastName: 'Ouedraogo'
  };

  it('rejects short passwords or passwords missing required character classes', () => {
    expect(validateStrongPassword('Abc!1234', context).isValid).toBe(false);
    expect(validateStrongPassword('monmotdepasselong1!', context).isValid).toBe(false); // no uppercase
    expect(validateStrongPassword('MONMOTDEPASSELONG1!', context).isValid).toBe(false); // no lowercase
    expect(validateStrongPassword('MonMotDePasseLong!!', context).isValid).toBe(false); // no digit
    expect(validateStrongPassword('MonMotDePasseLong12', context).isValid).toBe(false); // no special
  });

  it('rejects common weak passwords, sequential runs, repeated chars, and personal info', () => {
    expect(validateStrongPassword('Password123!@', context).isValid).toBe(false);
    expect(validateStrongPassword('Azerty987!Xy', context).isValid).toBe(false);
    expect(validateStrongPassword('Faso1234!Kyr', context).isValid).toBe(false);
    expect(validateStrongPassword('FasoAbcd!97K', context).isValid).toBe(false);
    expect(validateStrongPassword('Faaa97!KyrZp', context).isValid).toBe(false);
    expect(validateStrongPassword('Ibrahim97!KyrZ', context).isValid).toBe(false);
    expect(validateStrongPassword('Ouedraogo9!K', context).isValid).toBe(false);
  });

  it('accepts strong unique passwords of 12+ chars and computes strength levels accurately', () => {
    const fort = evaluatePasswordStrength('K@bore97#Faso', context);
    expect(fort.isValid).toBe(true);
    expect(fort.level).toBe('fort');
    expect(fort.score).toBe(3);

    const tresFort = evaluatePasswordStrength('F@s0-K@b0re!2026#Ir', context);
    expect(tresFort.isValid).toBe(true);
    expect(tresFort.level).toBe('tres_fort');
    expect(tresFort.score).toBe(4);
  });
});

describe('validatePersonData', () => {
  it('enforces strict email rules inside full identity validation', () => {
    expect(
      validatePersonData({
        lastName: 'Ouedraogo',
        firstName: 'Ibrahim',
        email: 'kjhgfdsa@abc.com',
        phone: '70123456'
      }).isValid
    ).toBe(false);

    expect(
      validatePersonData({
        lastName: 'Ouedraogo',
        firstName: 'Ibrahim',
        email: 'ibrahim.ouedraogo@fasomail.bf',
        phone: '70123456'
      }).isValid
    ).toBe(true);
  });
});
