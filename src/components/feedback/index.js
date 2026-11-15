import React from 'react';
import { ToastProvider, useToast } from './ToastProvider';
import { ConfirmProvider, useConfirm } from './ConfirmProvider';
import { LoadingProvider, useLoader } from './LoadingProvider';

/**
 * Unified FeedbackProvider mounting ToastProvider, ConfirmProvider, and LoadingProvider.
 */
export function FeedbackProvider({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <LoadingProvider>{children}</LoadingProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export { useToast, useConfirm, useLoader };

