import { useSyncExternalStore } from 'react';

// Tracks every Firestore write so the UI can tell "saved on the server" apart
// from "only sitting in this browser's cache". A Firestore write promise resolves
// only once the server acknowledges it, so an outstanding write is honestly unsaved.
let state = { pending: 0, offline: false, error: null };
const listeners = new Set();

const update = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

const describeError = (label, error) => ({
  label,
  code: error?.code || error?.message || String(error),
});

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useSyncState = () => useSyncExternalStore(subscribe, () => state);

// A snapshot served from cache means this device hasn't reached the server yet.
export const reportSnapshot = (snap) => {
  if (state.offline !== snap.metadata.fromCache) {
    update({ offline: snap.metadata.fromCache });
  }
};

export const reportListenerError = (label, error) => {
  console.error(`Firestore read failed: ${label}`, error);
  update({ error: describeError(label, error) });
};

export const trackWrite = async (label, run) => {
  update({ pending: state.pending + 1 });
  try {
    await run();
    update({ pending: state.pending - 1, error: null });
    return true;
  } catch (error) {
    console.error(`Firestore write failed: ${label}`, error);
    update({ pending: state.pending - 1, error: describeError(label, error) });
    return false;
  }
};

export const dismissSyncError = () => update({ error: null });
