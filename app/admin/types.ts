/**
 * Health of the managed store as surfaced to the operator — the shared
 * status vocabulary of the Admin Console's store-backed sections
 * (Likes, Stock Notifications).
 */
export type StoreStatus = 'connected' | 'unconfigured' | 'error';
