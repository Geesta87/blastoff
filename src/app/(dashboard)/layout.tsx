import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { WorkspaceProvider } from '@/lib/hooks/use-workspace'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="lg:pl-64">
          <Header />
          <main className="p-4 lg:p-8">{children}</main>
        </div>
      </div>
    </WorkspaceProvider>
  )
}
