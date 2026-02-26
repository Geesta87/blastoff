'use client'

import { useWorkspace } from '@/lib/hooks/use-workspace'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function WorkspaceSwitcher() {
  const { workspace, workspaces, switchWorkspace } = useWorkspace()

  if (workspaces.length <= 1) return null

  return (
    <Select value={workspace?.id || ''} onValueChange={switchWorkspace}>
      <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
        <SelectValue placeholder="Select workspace" />
      </SelectTrigger>
      <SelectContent>
        {workspaces.map((ws) => (
          <SelectItem key={ws.id} value={ws.id}>
            {ws.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
