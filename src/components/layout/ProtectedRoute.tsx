import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { PageSpinner } from '../ui/Spinner'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuthStore()
  if (loading) return <PageSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
