/**
 * Strict validation of genuine user data (names, email, phone)
 * Rejects placeholder, test, or obviously bogus data.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
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

  // 2. Validate Email
  const cleanEmail = (data.email || '').trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const dummyEmails = [
    'test@test.com', 'test@test.fr', 'fake@fake.com', 'user@user.com',
    'demo@demo.com', 'admin@admin.com', 'a@a.com', 'b@b.com',
    'test@gmail.com', 'email@email.com', 'exemple@exemple.com'
  ];

  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    return {
      isValid: false,
      error: 'Veuillez renseigner une adresse email valide (ex: utilisateur@fasomail.bf ou nom@gmail.com).'
    };
  }

  if (dummyEmails.includes(cleanEmail) || cleanEmail.includes('fake') || cleanEmail.includes('example')) {
    return {
      isValid: false,
      error: 'Les adresses email de test ou fictives ne sont pas autorisées. Veuillez renseigner votre véritable adresse.'
    };
  }

  // Check valid domain structure (at least domain.tld with known structure)
  const parts = cleanEmail.split('@');
  if (parts.length === 2) {
    const domain = parts[1];
    if (domain.length < 4 || !domain.includes('.')) {
      return {
        isValid: false,
        error: 'Le domaine de messagerie saisi est incomplet ou invalide.'
      };
    }
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
