import { tickCounts } from './constantsUtil'

// Forward declarations to avoid circular imports
export const isFraction = (name: string): boolean => {
    // This is a simplified version - the actual implementation would need to be moved here
    return name.includes('th') || name.includes('quarter') || name.includes('half') || name.includes('whole')
}
