import { createContext } from 'react';

/**
 * Context for managing Over Time (OT) requests.
 *
 * Provides:
 * - The list of all OT requests.
 * - State and setters for filters (month, year).
 * - Filtered requests based on the selected criteria.
 * - Functions to approve or reject OT requests.
 */
export const OvertimeContext = createContext(null);