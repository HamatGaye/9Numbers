export interface MigrationResult {
  needsMigration: boolean;
  migratedNumber: string;
  originalNumber: string;
}

export function migrateGambianNumber(phoneNumber: string): MigrationResult {
  const result: MigrationResult = {
    needsMigration: false,
    migratedNumber: phoneNumber,
    originalNumber: phoneNumber,
  };

  if (!phoneNumber) return result;

  // Clean the number: keep only digits and +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');

  let nationalNumber = cleaned;
  let hasCountryCode = false;
  let countryCodePrefix = '';

  // Check for international prefixes
  if (cleaned.startsWith('+220')) {
    hasCountryCode = true;
    countryCodePrefix = '+220';
    nationalNumber = cleaned.substring(4);
  } else if (cleaned.startsWith('00220')) {
    hasCountryCode = true;
    countryCodePrefix = '00220';
    nationalNumber = cleaned.substring(5);
  }

  // Determine if it's a legacy 7-digit number
  if (nationalNumber.length === 7) {
    let prefix = '';

    // Africell: starts with 7, 2, 40, 41
    if (/^[72]/.test(nationalNumber) || /^4[01]/.test(nationalNumber)) {
      prefix = '87';
    }
    // QCell: starts with 3, 5
    else if (/^[35]/.test(nationalNumber)) {
      prefix = '83';
    }
    // Comium: starts with 6
    else if (/^6/.test(nationalNumber)) {
      prefix = '86';
    }

    if (prefix) {
      result.needsMigration = true;
      const newNationalNumber = prefix + nationalNumber;
      
      // The user requested to keep the original formatting style as much as possible,
      // but for contacts, it's safer to just store the clean number or re-attach country code
      // We will do +220 87... if it had country code, else 87...
      
      if (hasCountryCode) {
        // preserve if it was +220 or 00220
        result.migratedNumber = `${countryCodePrefix} ${newNationalNumber}`;
      } else {
        result.migratedNumber = newNationalNumber;
      }
    }
  }

  return result;
}
