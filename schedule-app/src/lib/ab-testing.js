// Deterministic hashing function to map a string (userId) to a number between 0 and 99
export function hashStringToPercentage(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % 100;
}

// Determines if a user falls into the "test" bucket (variant B) based on a percentage (0-100)
// e.g., if percentage is 50, half of users will return true.
export function isUserInVariant(userId, percentage = 0) {
  if (!userId) return false;
  if (percentage <= 0) return false;
  if (percentage >= 100) return true;
  
  const userScore = hashStringToPercentage(userId);
  return userScore < percentage;
}
