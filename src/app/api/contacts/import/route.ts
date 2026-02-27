import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/utils/workspace'

interface ImportContact {
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  source?: string
}

function normalizePhone(phone: string | undefined): string | null {
  if (!phone) return null
  // Strip everything except digits and leading +
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (!cleaned) return null
  return cleaned
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const BATCH_SIZE = 500

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 401 })
    }

    const supabase = await createServerClient()
    const body = await request.json()
    const {
      contacts,
      tag_ids,
      duplicate_handling = 'skip',
    }: {
      contacts: ImportContact[]
      tag_ids?: string[]
      duplicate_handling: 'skip' | 'update'
    } = body

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: 'contacts array is required and must not be empty' },
        { status: 400 }
      )
    }

    let imported = 0
    let updated = 0
    let skipped = 0
    const errors: { row: number; error: string }[] = []

    // Fetch existing contacts for duplicate checking
    const existingEmails = new Set<string>()
    const existingPhones = new Set<string>()
    const existingContactsByEmail = new Map<string, { id: string; status: string }>()
    const existingContactsByPhone = new Map<string, { id: string; status: string }>()

    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('id, email, phone, status')
      .eq('workspace_id', workspaceId)

    if (existingContacts) {
      for (const c of existingContacts) {
        if (c.email) {
          existingEmails.add(c.email.toLowerCase())
          existingContactsByEmail.set(c.email.toLowerCase(), {
            id: c.id,
            status: c.status,
          })
        }
        if (c.phone) {
          existingPhones.add(c.phone)
          existingContactsByPhone.set(c.phone, {
            id: c.id,
            status: c.status,
          })
        }
      }
    }

    // Process contacts in batches
    for (let batchStart = 0; batchStart < contacts.length; batchStart += BATCH_SIZE) {
      const batch = contacts.slice(batchStart, batchStart + BATCH_SIZE)

      const toInsert: Array<Record<string, unknown>> = []
      const toUpdate: Array<{ id: string; data: Record<string, unknown> }> = []

      for (let i = 0; i < batch.length; i++) {
        const rowIndex = batchStart + i
        const raw = batch[i]

        // Normalize
        const phone = normalizePhone(raw.phone)
        const email = raw.email?.trim().toLowerCase() || null

        // Validate
        if (!email && !phone) {
          errors.push({ row: rowIndex, error: 'Must have email or phone' })
          continue
        }
        if (email && !isValidEmail(email)) {
          errors.push({ row: rowIndex, error: `Invalid email: ${email}` })
          continue
        }

        // Check for duplicates
        const existingByEmail = email
          ? existingContactsByEmail.get(email)
          : undefined
        const existingByPhone = phone
          ? existingContactsByPhone.get(phone)
          : undefined
        const existingRecord = existingByEmail || existingByPhone

        if (existingRecord) {
          if (duplicate_handling === 'skip') {
            skipped++
            continue
          }

          // duplicate_handling === 'update'
          const updateData: Record<string, unknown> = {}
          if (raw.first_name) updateData.first_name = raw.first_name
          if (raw.last_name) updateData.last_name = raw.last_name
          if (email) updateData.email = email
          if (phone) updateData.phone = phone
          if (raw.source) updateData.source = raw.source

          // Never change status from 'unsubscribed' back to 'active'
          // We skip status changes entirely during import updates

          toUpdate.push({ id: existingRecord.id, data: updateData })
          continue
        }

        // New contact
        toInsert.push({
          workspace_id: workspaceId,
          email,
          phone,
          first_name: raw.first_name || null,
          last_name: raw.last_name || null,
          source: raw.source || 'import',
        })

        // Track to avoid intra-batch duplicates
        if (email) {
          existingEmails.add(email)
          existingContactsByEmail.set(email, { id: 'pending', status: 'active' })
        }
        if (phone) {
          existingPhones.add(phone)
          existingContactsByPhone.set(phone, { id: 'pending', status: 'active' })
        }
      }

      // Execute batch insert
      if (toInsert.length > 0) {
        const { data: insertedContacts, error: insertError } = await supabase
          .from('contacts')
          .insert(toInsert)
          .select('id')

        if (insertError) {
          // Mark entire batch as errored
          for (let i = 0; i < toInsert.length; i++) {
            errors.push({
              row: batchStart + i,
              error: insertError.message,
            })
          }
        } else if (insertedContacts) {
          imported += insertedContacts.length

          // Add tags if provided
          if (tag_ids && tag_ids.length > 0) {
            const tagRows = insertedContacts.flatMap((contact) =>
              tag_ids.map((tagId: string) => ({
                contact_id: contact.id,
                tag_id: tagId,
              }))
            )
            await supabase.from('contact_tags').insert(tagRows)
          }

          // Log contact activities for imported contacts
          const activityRows = insertedContacts.map((contact) => ({
            workspace_id: workspaceId,
            contact_id: contact.id,
            activity_type: 'contact_imported',
            metadata: { source: 'import' },
          }))
          await supabase.from('contact_activities').insert(activityRows)
        }
      }

      // Execute batch updates
      for (const item of toUpdate) {
        const { error: updateError } = await supabase
          .from('contacts')
          .update(item.data)
          .eq('id', item.id)
          .eq('workspace_id', workspaceId)

        if (updateError) {
          errors.push({
            row: batchStart,
            error: updateError.message,
          })
        } else {
          updated++
        }
      }
    }

    return NextResponse.json({
      imported,
      updated,
      skipped,
      errors,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
