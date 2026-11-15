import { useToast } from '../components/feedback/ToastProvider';
import { useConfirm } from '../components/feedback/ConfirmProvider';
import { useLoader } from '../components/feedback/LoadingProvider';
import { mapError } from '../utils/errorMessages';
import { useRef, useCallback } from 'react';

/**
 * Shared action runner hook that wraps:
 * 1. Optional Confirmation Modal
 * 2. Blocking Loading Modal (prevents double submits via runningRef)
 * 3. Safe async action execution
 * 4. Automatic Success / Error Toast notification
 */
export function useAction() {
  const toast = useToast();
  const confirm = useConfirm();
  const loader = useLoader();
  const isRunningRef = useRef(false);

  const run = useCallback(
    async ({
      confirm: confirmConfig = null,
      loading: loadingMessage = null,
      action,
      success = null,
      errorMessage = null,
      onSuccess = null,
      onError = null,
    }) => {
      // Ignore second call while action is executing (Double submit protection)
      if (isRunningRef.current) return;
      isRunningRef.current = true;

      try {
        // Step 1: Confirmation Modal (if provided)
        if (confirmConfig) {
          const ok = await confirm(confirmConfig);
          if (!ok) {
            isRunningRef.current = false;
            return;
          }
        }

        // Step 2: Show loading modal (if provided)
        if (loadingMessage) {
          loader.show(loadingMessage);
        }

        // Step 3: Run the actual action
        let result;
        try {
          result = await action({
            updateLoading: loader.update,
          });
        } catch (actionErr) {
          // Hide loader immediately
          if (loadingMessage) {
            await loader.hide();
          }

          // Compute user-friendly error message
          let friendlyError;
          if (typeof errorMessage === 'function') {
            friendlyError = errorMessage(actionErr);
          } else if (typeof errorMessage === 'string') {
            friendlyError = errorMessage;
          } else {
            friendlyError = mapError(actionErr);
          }

          // Trigger Error Toast
          toast.error(friendlyError);

          if (onError) {
            onError(actionErr);
          }

          isRunningRef.current = false;
          return;
        }

        // Hide loader after minimum display time
        if (loadingMessage) {
          await loader.hide();
        }

        // Step 4: Success Toast
        if (success) {
          const successMsg = typeof success === 'function' ? success(result) : success;
          toast.success(successMsg);
        }

        // Trigger onSuccess callback
        if (onSuccess) {
          onSuccess(result);
        }
      } catch (err) {
        if (loadingMessage) {
          await loader.hide();
        }
        toast.error(mapError(err));
      } finally {
        isRunningRef.current = false;
      }
    },
    [confirm, loader, toast]
  );

  return run;
}

