import Papa from 'papaparse'

export function parseCSV(
  file: File
): Promise<{ data: Record<string, string>[]; headers: string[]; errors: Papa.ParseError[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      complete(results) {
        resolve({
          data: results.data as Record<string, string>[],
          headers: results.meta.fields || [],
          errors: results.errors,
        })
      },
      error(err: Error) {
        reject(err)
      },
    })
  })
}

export function validateCSVRow(
  row: Record<string, string>,
  mapping: Record<string, string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  const email = row[mapping.email]
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push(`Invalid email: ${email}`)
  }

  const phone = row[mapping.phone]
  if (phone && phone.replace(/\D/g, '').length < 7) {
    errors.push(`Invalid phone: ${phone}`)
  }

  if (!email && !phone) {
    errors.push('Row must have at least an email or phone')
  }

  return { valid: errors.length === 0, errors }
}
