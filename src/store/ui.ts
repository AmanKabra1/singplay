"use client";

import { create } from "zustand";

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: "info" | "success" | "error";
};

/** Why we're asking a guest to sign up — shapes the copy in the prompt. */
export type SignupReason =
  | "playback"
  | "karaoke"
  | "dj"
  | "playlist"
  | "favorite"
  | null;

type UiState = {
  toasts: Toast[];
  signupReason: SignupReason;
  queueOpen: boolean;
  nowPlayingOpen: boolean;
  online: boolean;

  toast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  promptSignup: (reason: Exclude<SignupReason, null>) => void;
  closeSignupPrompt: () => void;
  setQueueOpen: (open: boolean) => void;
  setNowPlayingOpen: (open: boolean) => void;
  setOnline: (online: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  signupReason: null,
  queueOpen: false,
  nowPlayingOpen: false,
  online: true,

  toast: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    // Errors stay long enough to read and act on; confirmations are brief.
    const ttl = toast.variant === "error" ? 7000 : 3500;
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, ttl);
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  promptSignup: (reason) => set({ signupReason: reason }),
  closeSignupPrompt: () => set({ signupReason: null }),
  setQueueOpen: (queueOpen) => set({ queueOpen }),
  setNowPlayingOpen: (nowPlayingOpen) => set({ nowPlayingOpen }),
  setOnline: (online) => set({ online }),
}));

export const toast = {
  success: (title: string, description?: string) =>
    useUiStore.getState().toast({ title, description, variant: "success" }),
  error: (title: string, description?: string) =>
    useUiStore.getState().toast({ title, description, variant: "error" }),
  info: (title: string, description?: string) =>
    useUiStore.getState().toast({ title, description, variant: "info" }),
};
