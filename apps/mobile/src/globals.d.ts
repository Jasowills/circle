// Minimal process.env typing for EXPO_PUBLIC_* vars (no @types/node in this app).
declare const process: { env: Record<string, string | undefined> };
