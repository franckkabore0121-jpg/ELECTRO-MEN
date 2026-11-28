/**
 * Strict validation of genuine user data (names, email, phone) and strong investor passwords.
 * Shared across frontend React components and Express backend routes.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'mailinator.net',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'tempmail.com',
  'tempmail.net',
  'temp-mail.org',
  'temp-mail.io',
  '10minutemail.com',
  '10minutemail.net',
  'guerrillamail.com',
  'guerrillamail.org',
  'guerrillamail.net',
  'sharklasers.com',
  'trashmail.com',
  'trashmail.net',
  'throwawaymail.com',
  'dispostable.com',
  'maildrop.cc',
  'getnada.com',
  'mohmal.com',
  'fakeinbox.com',
  'mintemail.com',
  'emailondeck.com',
  'tempr.email',
  'discard.email',
  'burnermail.io',
  'moakt.com',
  'dropmail.me',
  'crazymailing.com',
  'mailnesia.com',
  'mytemp.email',
  'spamgourmet.com',
  'jetable.org',
  'courrieltemporaire.com',
  'anonaddy.me',
  'mailcatch.com',
  'trash-mail.com'
]);

const BOGUS_EMAIL_DOMAINS = new Set([
  'test.com',
  'test.fr',
  'test.bf',
  'test.org',
  'test.net',
  'fake.com',
  'fake.fr',
  'abc.com',
  'abc.fr',
  'xyz.com',
  'qwerty.com',
  'azerty.com',
  'qwertz.com',
  'example.com',
  'example.org',
  'example.net',
  'exemple.com',
  'exemple.fr',
  'mail.test',
  'domain.com',
  'email.com',
  'nom.com',
  'user.com',
  'admin.com',
  'demo.com',
  'sample.com',
  'foobar.com',
  'asdf.com',
  'asdfgh.com',
  'qwert.com',
  '123.com',
  'aaa.com',
  'bbb.com'
]);

const INVALID_TLDS = new Set([
  'test',
  'invalid',
  'localhost',
  'local',
  'example',
  'exemple',
  'fake',
  'dummy',
  'lan',
  'home',
  'corp',
  'internal'
]);

const DUMMY_EMAIL_TOKENS = new Set([
  'test',
  'fake',
  'admin',
  'user',
  'demo',
  'client',
  'investisseur',
  'investor',
  'sample',
  'foobar',
  'null',
  'undefined',
  'azerty',
  'qwerty',
  'qwertz',
  'asdf',
  'asdfgh',
  'zxcvbn',
  'wxcvbn',
  'kjhgfdsa',
  'abc',
  'xyz',
  'nom',
  'prenom',
  'email',
  'exemple',
  'example',
  'noreply',
  'no-reply',
  'aucun',
  'personne'
]);

const KEYBOARD_MASH_SEQUENCES = [
  'azerty',
  'qwerty',
  'qwertz',
  'qsdfgh',
  'asdfgh',
  'wxcvbn',
  'zxcvbn',
  'lkjhgf',
  'kjhgfd',
  'jhgfds',
  'poiuyt',
  'mlkjhg',
  'nbvcxw',
  'abcdef',
  '123456',
  '654321'
];

function looksLikeRandomOrGibberish(token: string): boolean {
  const lower = token.toLowerCase();
  const lettersOnly = lower.replace(/[^a-z]/g, '');

  // Purely numeric local part or domain label (e.g. 12345678@gmail.com)
  if (!lettersOnly) {
    return true;
  }

  // Exact match on dummy tokens
  if (DUMMY_EMAIL_TOKENS.has(lower) || DUMMY_EMAIL_TOKENS.has(lettersOnly)) {
    return true;
  }

  // 4+ identical consecutive characters (e.g. aaaa, 1111)
  if (/([a-z])\1{3,}/i.test(lower) || /(\d)\1{4,}/.test(lower)) {
    return true;
  }

  // Obvious keyboard-mash or sequential patterns (length >= 6)
  if (KEYBOARD_MASH_SEQUENCES.some((seq) => lower.includes(seq) || lettersOnly.includes(seq))) {
    return true;
  }

  // Long letter clusters without any vowel (e.g. kjhgfdsa, qsdflkjh)
  if (lettersOnly.length >= 6 && !/[aeiouy]/.test(lettersOnly)) {
    return true;
  }

  // 6+ consecutive consonants (catches keyboard mash like kjhgfdsa without harming real names)
  if (/[bcdfghjklmnpqrstvwxz]{6,}/.test(lettersOnly)) {
    return true;
  }

  return false;
}

/**
 * Strict email validation for investor & client registration (client + server).
 * Rejects bogus syntax, short/invalid TLDs, disposable providers, and keyboard mash.
 */
export function validateStrictEmail(email: string): ValidationResult {
  if (typeof email !== 'string') {
    return {
      isValid: false,
      error: 'Veuillez saisir une adresse e-mail valide.'
    };
  }

  // Reject embedded control characters or internal whitespace
  if (/[\u0000-\u001F\u007F]/.test(email)) {
    return {
      isValid: false,
      error: 'L’adresse e-mail contient des caractères non autorisés.'
    };
  }

  const trimmed = email.trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: 'Veuillez renseigner votre adresse e-mail réelle.'
    };
  }

  if (/\s/.test(trimmed)) {
    return {
      isValid: false,
      error: 'L’adresse e-mail ne doit contenir aucun espace.'
    };
  }

  const cleanEmail = trimmed.toLowerCase();
  if (cleanEmail.length < 6 || cleanEmail.length > 254) {
    return {
      isValid: false,
      error: 'La longueur de l’adresse e-mail est invalide.'
    };
  }

  if (/[<>'"`\\;,:()\[\]]/.test(cleanEmail)) {
    return {
      isValid: false,
      error: 'L’adresse e-mail contient des caractères interdits.'
    };
  }

  const parts = cleanEmail.split('@');
  if (parts.length !== 2) {
    return {
      isValid: false,
      error: 'Format d’adresse e-mail invalide (exemple : prenom.nom@gmail.com).'
    };
  }

  const [localPart, domain] = parts;

  // Validate local part
  if (
    localPart.length < 2 ||
    localPart.length > 64 ||
    localPart.includes('..') ||
    !/^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?$/.test(localPart)
  ) {
    return {
      isValid: false,
      error: 'La partie précédant « @ » est invalide ou mal formée.'
    };
  }

  // Validate domain & TLD
  if (
    domain.length < 4 ||
    domain.length > 253 ||
    domain.includes('..') ||
    !domain.includes('.')
  ) {
    return {
      isValid: false,
      error: 'Le nom de domaine de l’adresse e-mail est incomplet ou invalide (ex: @gmail.com).'
    };
  }

  const domainLabels = domain.split('.');
  if (
    domainLabels.length < 2 ||
    domainLabels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  ) {
    return {
      isValid: false,
      error: 'Le domaine de messagerie saisi est mal formé.'
    };
  }

  const tld = domainLabels[domainLabels.length - 1];
  if (!/^[a-z]{2,24}$/.test(tld) || INVALID_TLDS.has(tld)) {
    return {
      isValid: false,
      error: 'L’extension du domaine (ex: .com, .bf, .fr) est invalide ou incomplète.'
    };
  }

  // Reject known disposable or dummy domains
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain) || BOGUS_EMAIL_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: 'Les adresses e-mail jetables, temporaires ou de test ne sont pas autorisées.'
    };
  }

  // Reject random/dummy second-level domain or local-part mash
  const sld = domainLabels[domainLabels.length - 2];
  if (sld.length < 2 || looksLikeRandomOrGibberish(sld)) {
    return {
      isValid: false,
      error: 'Le domaine de messagerie semble fictif ou aléatoire. Utilisez une adresse e-mail réelle.'
    };
  }

  const localBase = localPart.split('+')[0];
  if (
    looksLikeRandomOrGibberish(localBase) ||
    cleanEmail.includes('fake') ||
    cleanEmail.includes('example') ||
    cleanEmail.includes('exemple')
  ) {
    return {
      isValid: false,
      error: 'Cette adresse e-mail semble aléatoire ou de test. Veuillez saisir une adresse e-mail réelle et personnelle.'
    };
  }

  return { isValid: true };
}

export type PasswordStrengthLevel = 'faible' | 'moyen' | 'fort' | 'tres_fort';

export interface PasswordCriterion {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordStrengthEvaluation {
  isValid: boolean;
  error?: string;
  score: 0 | 1 | 2 | 3 | 4;
  level: PasswordStrengthLevel;
  label: string;
  criteria: PasswordCriterion[];
}

const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password123',
  'password123!',
  'motdepasse',
  'motdepasse123',
  'motdepasse123!',
  'azerty123',
  'azerty123!',
  'azertyuiop',
  'qwerty123',
  'qwerty123!',
  'qwertyuiop',
  'admin123',
  'admin123!',
  'welcome123',
  'welcome123!',
  'bienvenue123',
  'electromen',
  'electromen123',
  'electromen123!',
  'investisseur',
  'investisseur123',
  '123456789012',
  'changeme123!'
]);

const WEAK_SUBSTRINGS = [
  'password',
  'motdepasse',
  'electromen',
  'investisseur',
  'qwerty',
  'azerty',
  'qwertz',
  'admin123',
  'welcome'
];

const SEQUENTIAL_RUNS = [
  '0123456789',
  '9876543210',
  'abcdefghijklmnopqrstuvwxyz',
  'zyxwvutsrqponmlkjihgfedcba',
  'azertyuiop',
  'poiuytreza',
  'qsdfghjklm',
  'mlkjhgfdsq',
  'wxcvbn',
  'nbvcxw',
  'qwertyuiop',
  'poiuytrewq',
  'asdfghjkl',
  'lkjhgfdsa',
  'zxcvbnm',
  'mnbvcxz',
  'qwertzuiop',
  'poiuztrewq'
];

function hasSequentialRun(passwordLower: string, minRunLength = 4): boolean {
  const alnumOnly = passwordLower;
  if (alnumOnly.length < minRunLength) return false;
  for (let i = 0; i <= alnumOnly.length - minRunLength; i += 1) {
    const slice = alnumOnly.slice(i, i + minRunLength);
    if (!/^[a-z0-9]+$/.test(slice)) continue;
    if (SEQUENTIAL_RUNS.some((seq) => seq.includes(slice))) {
      return true;
    }
  }
  return false;
}

function containsPersonalToken(
  passwordLower: string,
  context?: { email?: string; firstName?: string; lastName?: string }
): boolean {
  if (!context) return false;
  const tokens: string[] = [];

  if (context.email) {
    const emailLocal = context.email.trim().toLowerCase().split('@')[0] || '';
    for (const part of emailLocal.split(/[._+-]+/)) {
      if (part.length >= 3) tokens.push(part);
    }
    if (emailLocal.length >= 3) tokens.push(emailLocal);
  }
  if (context.firstName) {
    for (const part of context.firstName.trim().toLowerCase().split(/[\s'-]+/)) {
      if (part.length >= 3) tokens.push(part);
    }
  }
  if (context.lastName) {
    for (const part of context.lastName.trim().toLowerCase().split(/[\s'-]+/)) {
      if (part.length >= 3) tokens.push(part);
    }
  }

  return tokens.some((token) => passwordLower.includes(token));
}

export function evaluatePasswordStrength(
  password: string,
  context?: { email?: string; firstName?: string; lastName?: string }
): PasswordStrengthEvaluation {
  const value = typeof password === 'string' ? password : '';
  const lower = value.toLowerCase();

  const hasControlOrEdgeSpace =
    value.length > 0 && (/[\u0000-\u001F\u007F]/.test(value) || value.trim() !== value);
  const hasMinLength = value.length >= 12 && value.length <= 128;
  const hasUppercase = /[A-Z]/.test(value);
  const hasLowercase = /[a-z]/.test(value);
  const hasDigit = /[0-9]/.test(value);
  const hasSpecial = /[^A-Za-z0-9\s]/.test(value);

  const hasRepeatedChars = /(.)\1{2,}/.test(value);
  const isCommonPassword =
    COMMON_WEAK_PASSWORDS.has(lower) ||
    WEAK_SUBSTRINGS.some((word) => lower.includes(word));
  const hasSequence = hasSequentialRun(lower, 4);
  const hasPersonalInfo = containsPersonalToken(lower, context);

  const noWeakPattern =
    value.length > 0 &&
    !hasControlOrEdgeSpace &&
    !hasRepeatedChars &&
    !isCommonPassword &&
    !hasSequence &&
    !hasPersonalInfo;

  const criteria: PasswordCriterion[] = [
    { id: 'length', label: '12 caractères minimum', met: hasMinLength },
    { id: 'upper', label: 'Au moins 1 majuscule (A-Z)', met: hasUppercase },
    { id: 'lower', label: 'Au moins 1 minuscule (a-z)', met: hasLowercase },
    { id: 'digit', label: 'Au moins 1 chiffre (0-9)', met: hasDigit },
    { id: 'special', label: 'Au moins 1 caractère spécial (!@#$…)', met: hasSpecial },
    { id: 'pattern', label: 'Sans suite simple, répétition ou info personnelle', met: noWeakPattern }
  ];

  const isValid = criteria.every((c) => c.met);
  let error: string | undefined;

  if (!value) {
    error = 'Veuillez saisir un mot de passe sécurisé.';
  } else if (hasControlOrEdgeSpace) {
    error = 'Le mot de passe ne doit pas commencer ou finir par un espace ni contenir de caractères de contrôle.';
  } else if (value.length < 12 || value.length > 128) {
    error = 'Le mot de passe doit comporter entre 12 et 128 caractères.';
  } else if (!hasUppercase) {
    error = 'Le mot de passe doit contenir au moins une lettre majuscule.';
  } else if (!hasLowercase) {
    error = 'Le mot de passe doit contenir au moins une lettre minuscule.';
  } else if (!hasDigit) {
    error = 'Le mot de passe doit contenir au moins un chiffre.';
  } else if (!hasSpecial) {
    error = 'Le mot de passe doit contenir au moins un caractère spécial (ex: ! @ # $ % & *).';
  } else if (hasPersonalInfo) {
    error = 'Le mot de passe ne doit pas contenir votre nom, prénom ou adresse e-mail.';
  } else if (isCommonPassword) {
    error = 'Ce mot de passe est trop courant ou prévisible. Choisissez une combinaison unique.';
  } else if (hasSequence) {
    error = 'Évitez les suites prévisibles (ex: 1234, abcd, azerty, qwerty).';
  } else if (hasRepeatedChars) {
    error = 'Évitez de répéter le même caractère 3 fois de suite (ex: aaa, 111).';
  }

  if (!value) {
    return { isValid: false, error, score: 0, level: 'faible', label: 'Faible', criteria };
  }

  const metCount = criteria.filter((c) => c.met).length;
  let score: 0 | 1 | 2 | 3 | 4 = 1;
  let level: PasswordStrengthLevel = 'faible';
  let label = 'Faible';

  if (isValid) {
    const specialCount = (value.match(/[^A-Za-z0-9\s]/g) || []).length;
    const digitCount = (value.match(/[0-9]/g) || []).length;
    if (value.length >= 16 || (value.length >= 14 && specialCount >= 2 && digitCount >= 2)) {
      score = 4;
      level = 'tres_fort';
      label = 'Très fort';
    } else {
      score = 3;
      level = 'fort';
      label = 'Fort';
    }
  } else if (!noWeakPattern || value.length < 8 || metCount <= 2) {
    score = 1;
    level = 'faible';
    label = 'Faible';
  } else if (metCount <= 4) {
    score = 2;
    level = 'moyen';
    label = 'Moyen';
  } else {
    // 5/6 met (e.g. missing 1 character class or length < 12)
    score = 2;
    level = 'moyen';
    label = 'Moyen';
  }

  return {
    isValid,
    error,
    score,
    level,
    label,
    criteria
  };
}

export function validateStrongPassword(
  password: string,
  context?: { email?: string; firstName?: string; lastName?: string }
): ValidationResult {
  const evaluation = evaluatePasswordStrength(password, context);
  return {
    isValid: evaluation.isValid,
    error: evaluation.error
  };
}

export function validatePersonData(data: {
  lastName: string;
  firstName?: string;
  fullName?: string;
  email: string;
  phone: string;
}): ValidationResult {
  const dummyStrings = [
    'test', 'fake', 'admin', 'user', 'demo', 'aaa', 'bbb', 'ccc', 'abc',
    'xyz', 'azerty', 'qwerty', 'client', 'investisseur', 'nom', 'prenom',
    'null', 'undefined', 'aucun', 'personne', 'sample', 'foobar'
  ];

  // 1. Validate Names
  if (data.fullName !== undefined) {
    const cleanFull = data.fullName.trim();
    if (cleanFull.length < 3) {
      return {
        isValid: false,
        error: 'Veuillez saisir votre nom et prénom complets (minimum 3 caractères).'
      };
    }
    const words = cleanFull.split(/\s+/).filter(Boolean);
    if (words.length < 2) {
      return {
        isValid: false,
        error: 'Veuillez saisir à la fois votre Nom et votre Prénom (ex: Kaboré Franck).'
      };
    }
    for (const w of words) {
      if (dummyStrings.includes(w.toLowerCase())) {
        return {
          isValid: false,
          error: `Le nom "${w}" est un terme de test ou générique. Veuillez renseigner votre véritable identité.`
        };
      }
      if (!/^[a-zA-ZÀ-ÿ\s'-]{2,30}$/.test(w)) {
        return {
          isValid: false,
          error: `Le terme "${w}" contient des caractères non autorisés. Seules les lettres sont admises.`
        };
      }
    }
  } else {
    const cleanLast = (data.lastName || '').trim();
    const cleanFirst = (data.firstName || '').trim();

    if (cleanLast.length < 2 || !/^[a-zA-ZÀ-ÿ\s'-]{2,30}$/.test(cleanLast) || dummyStrings.includes(cleanLast.toLowerCase())) {
      return {
        isValid: false,
        error: 'Veuillez renseigner un Nom de famille authentique et valide (sans chiffres ni données fictives).'
      };
    }

    if (cleanFirst.length < 2 || !/^[a-zA-ZÀ-ÿ\s'-]{2,30}$/.test(cleanFirst) || dummyStrings.includes(cleanFirst.toLowerCase())) {
      return {
        isValid: false,
        error: 'Veuillez renseigner un Prénom authentique et valide (sans chiffres ni données fictives).'
      };
    }
  }

  // 2. Validate Email strictly
  const emailCheck = validateStrictEmail(data.email);
  if (!emailCheck.isValid) {
    return emailCheck;
  }

  // 3. Validate Phone Number (minimum 8 digits, no repetitive dummy strings)
  const phoneDigits = (data.phone || '').replace(/[^0-9]/g, '');
  const dummyPhones = [
    '00000000', '11111111', '22222222', '33333333', '44444444',
    '55555555', '66666666', '77777777', '88888888', '99999999',
    '12345678', '87654321', '01234567', '0000000000', '1234567890'
  ];

  if (phoneDigits.length < 8) {
    return {
      isValid: false,
      error: 'Le numéro de téléphone / WhatsApp doit comporter au moins 8 chiffres réels.'
    };
  }

  if (dummyPhones.some((dp) => phoneDigits.includes(dp))) {
    return {
      isValid: false,
      error: 'Le numéro de téléphone saisi est une suite fictive de test. Veuillez renseigner votre véritable numéro joignable.'
    };
  }

  return { isValid: true };
}
