import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js'

export function normalizePhone(phone: string, defaultCountry: CountryCode = 'US'): string | null {
  const parsed = parsePhoneNumberFromString(phone, defaultCountry)
  if (!parsed || !parsed.isValid()) return null
  return parsed.format('E.164')
}

export function formatPhone(phone: string): string {
  const parsed = parsePhoneNumberFromString(phone)
  if (!parsed) return phone
  return parsed.formatNational()
}

export function isValidPhone(phone: string, defaultCountry: CountryCode = 'US'): boolean {
  const parsed = parsePhoneNumberFromString(phone, defaultCountry)
  return parsed ? parsed.isValid() : false
}
