import { useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  startOperation, 
  updateOperationProgress, 
  completeOperation, 
  cancelOperation,
  OperationStatus 
} from '../store/slices/uiSlice';

export interface OperationConfig {
  name: string;
  canCancel?: boolean;
  estimatedDuration?: number; // in milliseconds
  progressSteps?: string[]; // Array of step descriptions
}

export interface ProgressUpdate {
  progress: number; // 0-100
  message?: string;
  currentStep?: number;
  estimatedCompletion?: Date;
}

export const useOperationStatus = () => {
  const dispatch = useAppDispatch();
  const operationStatus = useAppSelector(state => state.ui.operationStatus);
  const cancelCallbackRef = useRef<(() => void) | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  const startOperationWithStatus = useCallback((
    config: OperationConfig,
    cancelCallback?: () => void
  ) => {
    startTimeRef.current = new Date();
    cancelCallbackRef.current = cancelCallback || null;
    
    dispatch(startOperation({
      operation: config.name,
      canCancel: config.canCancel || false
    }));

    // If estimated duration is provided, set up automatic progress updates
    if (config.estimatedDuration) {
      const estimatedCompletion = new Date(Date.now() + config.estimatedDuration);
      dispatch(updateOperationProgress({
        progress: 0,
        estimatedCompletion
      }));
    }
  }, [dispatch]);

  const updateProgress = useCallback((update: ProgressUpdate) => {
    const { progress, message, currentStep, estimatedCompletion } = update;
    
    // Calculate estimated completion if not provided
    let calculatedEstimation = estimatedCompletion;
    if (!calculatedEstimation && startTimeRef.current && progress > 0) {
      const elapsed = Date.now() - startTimeRef.current.getTime();
      const totalEstimated = (elapsed / progress) * 100;
      calculatedEstimation = new Date(startTimeRef.current.getTime() + totalEstimated);
    }

    dispatch(updateOperationProgress({
      progress: Math.max(0, Math.min(100, progress)),
      message,
      estimatedCompletion: calculatedEstimation
    }));
  }, [dispatch]);

  const completeOperationWithStatus = useCallback((
    success: boolean,
    message?: string
  ) => {
    startTimeRef.current = null;
    cancelCallbackRef.current = null;
    
    dispatch(completeOperation({
      success,
      message
    }));
  }, [dispatch]);

  const cancelOperationWithStatus = useCallback(() => {
    if (cancelCallbackRef.current) {
      cancelCallbackRef.current();
    }
    
    startTimeRef.current = null;
    cancelCallbackRef.current = null;
    
    dispatch(cancelOperation());
  }, [dispatch]);

  // Helper function to run an async operation with automatic progress tracking
  const runOperation = useCallback(async <T>(
    config: OperationConfig,
    operation: (updateProgress: (update: ProgressUpdate) => void) => Promise<T>,
    onCancel?: () => void
  ): Promise<T | null> => {
    try {
      startOperationWithStatus(config, onCancel);
      
      const result = await operation(updateProgress);
      
      completeOperationWithStatus(true, `${config.name} completed successfully`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      completeOperationWithStatus(false, `${config.name} failed: ${errorMessage}`);
      throw error;
    }
  }, [startOperationWithStatus, updateProgress, completeOperationWithStatus]);

  // Helper for operations with known steps
  const runSteppedOperation = useCallback(async <T>(
    config: OperationConfig & { steps: string[] },
    operation: (
      updateStep: (stepIndex: number, message?: string) => void,
      updateProgress: (progress: number, message?: string) => void
    ) => Promise<T>,
    onCancel?: () => void
  ): Promise<T | null> => {
    const updateStep = (stepIndex: number, message?: string) => {
      const progress = ((stepIndex + 1) / config.steps.length) * 100;
      const stepMessage = message || config.steps[stepIndex] || 'Processing...';
      updateProgress({ progress, message: stepMessage, currentStep: stepIndex });
    };

    const updateProgressOnly = (progress: number, message?: string) => {
      updateProgress({ progress, message });
    };

    return runOperation(
      config,
      (progressCallback) => operation(updateStep, updateProgressOnly),
      onCancel
    );
  }, [runOperation, updateProgress]);

  // Helper for batch operations
  const runBatchOperation = useCallback(async <T, R>(
    config: OperationConfig,
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    onCancel?: () => void
  ): Promise<R[]> => {
    const results: R[] = [];
    let cancelled = false;

    const cancelHandler = () => {
      cancelled = true;
      if (onCancel) onCancel();
    };

    try {
      startOperationWithStatus(config, cancelHandler);

      for (let i = 0; i < items.length; i++) {
        if (cancelled) {
          throw new Error('Operation was cancelled');
        }

        const progress = ((i + 1) / items.length) * 100;
        updateProgress({
          progress,
          message: `Processing item ${i + 1} of ${items.length}`
        });

        const result = await processor(items[i], i);
        results.push(result);
      }

      completeOperationWithStatus(true, `Processed ${items.length} items successfully`);
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch operation failed';
      completeOperationWithStatus(false, errorMessage);
      throw error;
    }
  }, [startOperationWithStatus, updateProgress, completeOperationWithStatus]);

  // Helper to check if an operation is currently running
  const isOperationRunning = useCallback((operationName?: string) => {
    if (!operationStatus.isLoading) return false;
    if (!operationName) return true;
    return operationStatus.operation === operationName;
  }, [operationStatus]);

  // Helper to get operation progress percentage
  const getOperationProgress = useCallback(() => {
    return operationStatus.progress || 0;
  }, [operationStatus.progress]);

  // Helper to get estimated time remaining
  const getEstimatedTimeRemaining = useCallback(() => {
    if (!operationStatus.estimatedCompletion || !operationStatus.startTime) {
      return null;
    }

    const now = new Date();
    const remaining = operationStatus.estimatedCompletion.getTime() - now.getTime();
    
    if (remaining <= 0) return null;

    return Math.ceil(remaining / 1000); // Return seconds remaining
  }, [operationStatus.estimatedCompletion, operationStatus.startTime]);

  // Helper to format time remaining
  const formatTimeRemaining = useCallback((seconds: number | null) => {
    if (!seconds || seconds <= 0) return null;

    if (seconds < 60) {
      return `${seconds}s remaining`;
    } else if (seconds < 3600) {
      const minutes = Math.ceil(seconds / 60);
      return `${minutes}m remaining`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.ceil((seconds % 3600) / 60);
      return `${hours}h ${minutes}m remaining`;
    }
  }, []);

  return {
    // Current operation status
    operationStatus,
    isLoading: operationStatus.isLoading,
    currentOperation: operationStatus.operation,
    progress: operationStatus.progress,
    canCancel: operationStatus.canCancel,
    
    // Operation control
    startOperation: startOperationWithStatus,
    updateProgress,
    completeOperation: completeOperationWithStatus,
    cancelOperation: cancelOperationWithStatus,
    
    // High-level operation runners
    runOperation,
    runSteppedOperation,
    runBatchOperation,
    
    // Utility functions
    isOperationRunning,
    getOperationProgress,
    getEstimatedTimeRemaining,
    formatTimeRemaining
  };
};