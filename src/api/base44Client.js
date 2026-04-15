// Re-export storageAdapter as base44 for backward compatibility with existing imports.
// The adapter automatically selects localStorage (web/Electron) or
// @capacitor/preferences (native mobile) at runtime.
export { storageAdapter as base44 } from './storageAdapter';
