"use client";

import { ConfirmModal } from "@/components/ui/Modal";

interface SignOutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export default function SignOutConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: SignOutConfirmModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Leaving already?"
      message="Don’t leave me hanging — your dashboard will miss you. Are you sure you want to sign out now?"
      confirmLabel="Yes, sign out"
      cancelLabel="Stay here"
      variant="warning"
      isLoading={isLoading}
    />
  );
}
