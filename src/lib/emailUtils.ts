/**
 * Email Validation Utilities
 * 
 * Handles institutional email validation and parsing
 */

export const INSTITUTIONAL_EMAIL_DOMAIN = '@stu.ui.edu.ng';

/**
 * Check if email is an institutional email
 */
export function isInstitutionalEmail(email: string): boolean {
  return email.toLowerCase().endsWith(INSTITUTIONAL_EMAIL_DOMAIN);
}

/**
 * Extract student info from institutional email
 * 
 * Format: [first_letter][lastname][last3digits]@stu.ui.edu.ng
 * Example: aadetayo856@stu.ui.edu.ng
 *   - First letter: 'a' (first letter of first name)
 *   - Last name: 'adetayo'
 *   - Last 3 digits of matric: '856' (matric could be 123856, 236856, etc.)
 * 
 * Returns hints that should be confirmed with Google/Firebase data
 */
export function parseInstitutionalEmail(email: string): {
  firstNameInitial?: string;
  lastNameHint?: string;
  matricLast3Digits?: string;
} {
  if (!isInstitutionalEmail(email)) {
    return {};
  }

  const localPart = email.split('@')[0].toLowerCase();
  
  // Pattern: [letter][letters...][3digits]
  const match = localPart.match(/^([a-z])([a-z]+?)(\d{3})$/);
  
  if (!match) {
    return {};
  }

  const [, firstLetter, possibleLastName, last3Digits] = match;

  return {
    firstNameInitial: firstLetter.toUpperCase(),
    lastNameHint: capitalizeFirstLetter(possibleLastName),
    matricLast3Digits: last3Digits
  };
}

/**
 * Capitalize first letter of a string
 */
function capitalizeFirstLetter(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Validate matric number format
 * UI matric numbers are exactly 6 digits (e.g., 236856, 123456)
 */
export function isValidMatricNumber(matricNumber: string): boolean {
  return /^\d{6}$/.test(matricNumber);
}

/**
 * Verify if matric number ends with expected last 3 digits
 * (used to confirm institutional email matches matric number)
 */
export function matricMatchesEmail(matricNumber: string, last3Digits: string): boolean {
  if (!matricNumber || !last3Digits) return false;
  return matricNumber.endsWith(last3Digits);
}
