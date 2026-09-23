export const SOCIAL_VIEW_ITEMS = Object.freeze([
  { id: "overview", label: "Overview" },
  { id: "friends", label: "Friends" },
  { id: "groups", label: "Groups" },
]);

export function filterSocialFriends(friends, { query = "", filter = "all", getStatus = () => null } = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return friends.filter(friend => {
    if (normalizedQuery && !friend.name.toLocaleLowerCase().includes(normalizedQuery)) return false;
    if (filter === "favourites") return Boolean(friend.isFavourite);

    const state = getStatus(friend)?.state;
    if (filter === "free") return state === "free";
    if (filter === "busy") return state === "busy";
    return true;
  });
}
