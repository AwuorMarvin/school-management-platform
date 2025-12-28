import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { feeStructuresApi } from '../api/feeStructures'
import { useToastStore } from '../store/toastStore'
import AppLayout from '../components/AppLayout'
import PageHeader from '../components/PageHeader'
import ContentCard from '../components/ContentCard'

/**
 * Redirect component that detects fee structure scope and routes to the appropriate form.
 * This ensures TERM-scoped structures use the termly form and YEAR-scoped use the annual form.
 */
const FeeStructureEditRedirect = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const errorToast = useToastStore((state) => state.error)
  const [_loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAndRedirect = async () => {
      if (!id) {
        errorToast('Invalid fee structure ID')
        navigate('/fee-structures')
        return
      }

      try {
        setLoading(true)
        const structure = await feeStructuresApi.get(id)
        
        // Redirect based on structure scope
        if (structure.structure_scope === 'TERM') {
          navigate(`/fee-structures/${id}/edit-termly`, { replace: true })
        } else if (structure.structure_scope === 'YEAR') {
          navigate(`/fee-structures/${id}/edit-annual`, { replace: true })
        } else {
          // Fallback for legacy structures without scope
          // Default to termly form if term_id exists, otherwise show error
          if (structure.term_id) {
            navigate(`/fee-structures/${id}/edit-termly`, { replace: true })
          } else {
            errorToast('Unable to determine fee structure type')
            navigate('/fee-structures')
          }
        }
      } catch (err: any) {
        console.error('Failed to load fee structure:', err)
        errorToast(err.response?.data?.message || 'Failed to load fee structure')
        navigate('/fee-structures')
      } finally {
        setLoading(false)
      }
    }

    loadAndRedirect()
  }, [id, navigate, errorToast])

  return (
    <AppLayout>
      <PageHeader title="Loading..." subtitle="Redirecting to edit form..." />
      <div className="p-8">
        <ContentCard>
          <div className="text-center py-12">
            <p className="text-gray-600">Loading fee structure...</p>
          </div>
        </ContentCard>
      </div>
    </AppLayout>
  )
}

export default FeeStructureEditRedirect

