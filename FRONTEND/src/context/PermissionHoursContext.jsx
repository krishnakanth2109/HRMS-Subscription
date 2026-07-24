import { createContext } from 'react';

/**
 * Context for managing Permission Hours requests.
 *
 * This context provides:
 * - A list of permission hour requests, filtered by month and year.
 * - State and setters for the filters.
 * - Functions for an admin to approve or reject requests.
 */
export const PermissionHoursContext = createContext(null);