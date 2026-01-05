/**
 * Password Validation Utility
 * 
 * Provides secure password validation with strength requirements
 * to ensure all passwords meet security standards.
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

/**
 * Validates password strength and requirements
 * 
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * 
 * @param password - The password to validate
 * @returns PasswordValidationResult with validation status and errors
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  
  // Check minimum length
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  
  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  
  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  
  // Check for number
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:',.<>?)");
  }
  
  // Check for common weak passwords
  const commonPasswords = [
    'password', 'password123', '12345678', 'qwerty', 'abc123',
    'letmein', 'welcome', 'admin', '123456', 'password1'
  ];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push("Password is too common or easily guessable");
  }
  
  // Determine strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (errors.length === 0) {
    if (password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      strength = 'strong';
    } else if (password.length >= 10) {
      strength = 'medium';
    } else {
      strength = 'strong'; // If all requirements met, it's at least strong
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Validates that password and confirm password match
 */
export function validatePasswordMatch(password: string, confirmPassword: string): boolean {
  return password === confirmPassword;
}

/**
 * Gets password strength requirements as a user-friendly message
 */
export function getPasswordRequirements(): string {
  return "Password must be at least 8 characters and include: uppercase letter, lowercase letter, number, and special character";
}




