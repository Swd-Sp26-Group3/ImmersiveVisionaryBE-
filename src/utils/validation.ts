export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePassword = (password: string): boolean => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
  return passwordRegex.test(password)
}

export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^(\+84|84|0)[3|5|7|8|9][0-9]{8}$/
  return phoneRegex.test(phone)
}

export const validateIdentityCard = (identityCard: string): boolean => {
  // Vietnamese ID card: 9 or 12 digits
  const idRegex = /^[0-9]{9}$|^[0-9]{12}$/
  return idRegex.test(identityCard)
}

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '')
}

export const validateDateOfBirth = (dateString: string): boolean => {
  const date = new Date(dateString)
  const now = new Date()
  const minAge = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate())

  return date <= now && date >= minAge
}

export const validateYearOfBirth = (year: number): boolean => {
  const currentYear = new Date().getFullYear()
  return year >= currentYear - 120 && year <= currentYear
}
