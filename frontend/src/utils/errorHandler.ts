/**
 * Utility functions for handling API errors consistently across the application.
 */

interface ApiError {
  response?: {
    data?: {
      error_code?: string
      message?: string
      recovery?: string
      details?: {
        fields?: Record<string, string[]>
      }
      detail?: {
        message?: string
        fields?: Record<string, string[]>
      }
    }
  }
  message?: string
}

/**
 * Extracts a user-friendly error message from an API error.
 * Handles validation errors with field-specific messages.
 * 
 * @param err - The error object from an API call
 * @returns A user-friendly error message string
 */
export function getErrorMessage(err: ApiError): string {
  const responseData = err.response?.data

  if (!responseData) {
    return err.message || 'An unexpected error occurred. Please try again.'
  }

  // Prioritize the message from response (backend formats it nicely)
  if (responseData.message) {
    return responseData.message
  }

  // Check for validation errors with field details (fallback if no message)
  const fieldErrors = responseData.details?.fields || responseData.detail?.fields

  if (fieldErrors) {
    // Format field errors into a readable message
    const errorMessages: string[] = []
    
    for (const [field, messages] of Object.entries(fieldErrors)) {
      // Format field name for display (e.g., "father.phone_number" -> "Father Phone Number")
      const displayField = field
        .replace(/_/g, ' ')
        .replace(/\./g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      
      // Add each error message for this field
      messages.forEach(msg => {
        errorMessages.push(`${displayField}: ${msg}`)
      })
    }

    if (errorMessages.length > 0) {
      return errorMessages.join('\n')
    }
  }

  // Check detail.message (for some error formats)
  if (responseData.detail?.message) {
    return responseData.detail.message
  }

  // Final fallback
  return 'An error occurred. Please try again.'
}

