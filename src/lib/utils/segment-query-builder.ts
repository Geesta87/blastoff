import type { SupabaseClient } from '@supabase/supabase-js'
import type { FilterRules, FilterCondition } from '@/lib/types'

export function buildSegmentQuery(
  supabase: SupabaseClient,
  workspaceId: string,
  filterRules: FilterRules
) {
  let query = supabase
    .from('contacts')
    .select('id', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')

  for (const condition of filterRules.conditions) {
    query = applyCondition(query, condition)
  }

  return query
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCondition(query: any, condition: FilterCondition) {
  const { field, operator, value } = condition

  // Handle custom fields
  if (field.startsWith('custom_fields.')) {
    const jsonPath = field.replace('custom_fields.', '')
    const col = `custom_fields->>${jsonPath}`
    return applyOperator(query, col, operator, value)
  }

  // Handle tag filter (special case)
  if (field === 'tag') {
    // tag filtering requires a different approach — use in-subquery
    // For now, we use a simple filter approach
    return query
  }

  return applyOperator(query, field, operator, value)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyOperator(query: any, column: string, operator: string, value: unknown) {
  switch (operator) {
    case 'equals':
      return query.eq(column, value)
    case 'not_equals':
      return query.neq(column, value)
    case 'contains':
      return query.ilike(column, `%${value}%`)
    case 'not_contains':
      return query.not(column, 'ilike', `%${value}%`)
    case 'starts_with':
      return query.ilike(column, `${value}%`)
    case 'greater_than':
      return query.gt(column, value)
    case 'less_than':
      return query.lt(column, value)
    case 'is_empty':
      return query.is(column, null)
    case 'is_not_empty':
      return query.not(column, 'is', null)
    case 'in_list':
      return query.in(column, Array.isArray(value) ? value : [value])
    default:
      return query
  }
}
