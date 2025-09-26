import { useCallback } from 'react';
import { useToast } from '../components/common/ToastNotification';
import { useAppDispatch } from '../store/hooks';
import { setGlobalError, addNotification } from '../store/slices/uiSlice';

export interface ErrorHandlerOptions {
  showToast?: boolean;
  showGlobalError?: boolean;
  logToConsole?: boolean;
  retryAction?: () => void;
  customMessage?: string;
  persistent?: boolean;
}

export interface ErrorContext {
  component?: string;
  operation?: string;
  userId?: string;
  timestamp?: Date;
  additionalData?: Record<string, unknown>;
}

export const useErrorHandler = () => {
  const dispatch = useAppDispatch();
  const { showError, showWarning } = useToast();

  const handleError = useCallback((
    error: Error | string | unknown,
    context?: ErrorContext,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      showToast = true,
      showGlobalError = false,
      logToConsole = true,
      retryAction,
      customMessage,
      persistent = false
    } = options;

    // Normalize error to Error object
    let normalizedError: Error;
    if (error instanceof Error) {
      normalizedError = error;
    } else if (typeof error === 'string') {
      normalizedError = new Error(error);
    } else {
      normalizedError = new Error('An unknown error occurred');
    }

    // Enhanced error message with context
    const errorMessage = customMessage || normalizedError.message;
    const contextInfo = context ? ` (${context.component || 'Unknown'}: ${context.operation || 'Unknown operation'})` : '';
    const fullMessage = `${errorMessage}${contextInfo}`;

    // Log to console if enabled
    if (logToConsole) {
      console.error('Error handled:', {
        error: normalizedError,
        context,
        options,
        stack: normalizedError.stack
      });
    }

    // Show toast notification
    if (showToast) {
      const actions = retryAction ? [
        { label: 'Retry', action: 'retry', data: { retryAction } },
        { label: 'Dismiss', action: 'dismiss' }
      ] : undefined;

      showError(
        getErrorTitle(normalizedError, context),
        errorMessage,
        {
          persistent,
          actions,
          duration: persistent ? undefined : 8000
        }
      );
    }

    // Set global error state
    if (showGlobalError) {
      dispatch(setGlobalError(fullMessage));
    }

    // Return error details for further handling
    return {
      error: normalizedError,
      message: errorMessage,
      context,
      handled: true
    };
  }, [dispatch, showError]);

  const handleAsyncError = useCallback(async <T>(
    asyncOperation: () => Promise<T>,
    context?: ErrorContext,
    options: ErrorHandlerOptions = {}
  ): Promise<T | null> => {
    try {
      return await asyncOperation();
    } catch (error) {
      handleError(error, context, options);
      return null;
    }
  }, [handleError]);

  const handleWarning = useCallback((
    message: string,
    context?: ErrorContext,
    options: Omit<ErrorHandlerOptions, 'showGlobalError'> = {}
  ) => {
    const {
      showToast = true,
      logToConsole = true,
      customMessage,
      persistent = false
    } = options;

    const warningMessage = customMessage || message;
    const contextInfo = context ? ` (${context.component || 'Unknown'}: ${context.operation || 'Unknown operation'})` : '';
    const fullMessage = `${warningMessage}${contextInfo}`;

    if (logToConsole) {
      console.warn('Warning:', { message: warningMessage, context });
    }

    if (showToast) {
      showWarning(
        'Warning',
        warningMessage,
        {
          persistent,
          duration: persistent ? undefined : 6000
        }
      );
    }

    return {
      message: warningMessage,
      context,
      handled: true
    };
  }, [showWarning]);

  const clearGlobalError = useCallback(() => {
    dispatch(setGlobalError(undefined));
  }, [dispatch]);

  return {
    handleError,
    handleAsyncError,
    handleWarning,
    clearGlobalError
  };
};

// Helper function to get appropriate error title
function getErrorTitle(error: Error, context?: ErrorContext): string {
  if (context?.operation) {
    return `${context.operation} Failed`;
  }

  // Check for specific error types
  if (error.name === 'NetworkError' || error.message.includes('network')) {
    return 'Network Error';
  }
  
  if (error.name === 'AuthenticationError' || error.message.includes('authentication')) {
    return 'Authentication Error';
  }
  
  if (error.name === 'ValidationError' || error.message.includes('validation')) {
    return 'Validation Error';
  }
  
  if (error.name === 'PermissionError' || error.message.includes('permission')) {
    return 'Permission Error';
  }

  return 'Error';
}

// AWS-specific error handler
export const useAWSErrorHandler = () => {
  const { handleError, handleWarning } = useErrorHandler();

  const handleAWSError = useCallback((
    error: any,
    operation: string,
    options: ErrorHandlerOptions = {}
  ) => {
    let customMessage = '';
    let isWarning = false;

    // Handle specific AWS error codes
    if (error.name === 'CredentialsError' || error.code === 'CredentialsError') {
      customMessage = 'AWS credentials are invalid or expired. Please re-authenticate.';
    } else if (error.name === 'UnauthorizedOperation' || error.code === 'UnauthorizedOperation') {
      customMessage = 'You do not have permission to perform this operation. Check your IAM policies.';
    } else if (error.name === 'AccessDenied' || error.code === 'AccessDenied') {
      customMessage = 'Access denied. Verify your permissions and try again.';
    } else if (error.name === 'ThrottlingException' || error.code === 'ThrottlingException') {
      customMessage = 'Request was throttled. Please wait a moment and try again.';
      isWarning = true;
    } else if (error.name === 'ServiceUnavailable' || error.code === 'ServiceUnavailable') {
      customMessage = 'AWS service is temporarily unavailable. Please try again later.';
    } else if (error.name === 'InvalidParameterValue' || error.code === 'InvalidParameterValue') {
      customMessage = 'Invalid parameter provided. Please check your input and try again.';
    } else if (error.name === 'ResourceNotFound' || error.code === 'ResourceNotFound') {
      customMessage = 'The requested AWS resource was not found.';
    } else if (error.name === 'NetworkingError' || error.code === 'NetworkingError') {
      customMessage = 'Network error occurred while connecting to AWS. Check your internet connection.';
    } else {
      customMessage = error.message || 'An AWS operation failed';
    }

    const context: ErrorContext = {
      component: 'AWS',
      operation,
      timestamp: new Date(),
      additionalData: {
        errorCode: error.code,
        errorName: error.name,
        requestId: error.requestId,
        region: error.region
      }
    };

    if (isWarning) {
      return handleWarning(customMessage, context, options);
    } else {
      return handleError(error, context, { ...options, customMessage });
    }
  }, [handleError, handleWarning]);

  return { handleAWSError };
};

// Hook for handling form validation errors
export const useFormErrorHandler = () => {
  const { handleError } = useErrorHandler();

  const handleValidationErrors = useCallback((
    errors: Record<string, string[]>,
    formName?: string
  ) => {
    const errorMessages = Object.entries(errors)
      .map(([field, fieldErrors]) => `${field}: ${fieldErrors.join(', ')}`)
      .join('\n');

    handleError(
      new Error(errorMessages),
      {
        component: 'Form',
        operation: formName ? `${formName} Validation` : 'Form Validation'
      },
      {
        customMessage: 'Please correct the following errors:',
        showGlobalError: false,
        persistent: true
      }
    );
  }, [handleError]);

  return { handleValidationErrors };
};