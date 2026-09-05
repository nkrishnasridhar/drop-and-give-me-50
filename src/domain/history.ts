export function groupSetsByDay<T extends { localDate: string }>(
  items: readonly T[],
): { localDate: string; items: T[] }[] {
  const groups: { localDate: string; items: T[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.localDate === item.localDate) {
      last.items.push(item);
    } else {
      groups.push({ localDate: item.localDate, items: [item] });
    }
  }
  return groups;
}

export function mergeRestOnlyDays<T>(
  groups: { localDate: string; items: T[] }[],
  restDates: readonly string[],
): { localDate: string; items: T[] }[] {
  const present = new Set(groups.map((group) => group.localDate));
  const merged = [
    ...groups,
    ...restDates
      .filter((localDate) => !present.has(localDate))
      .map((localDate) => ({ localDate, items: [] as T[] })),
  ];
  merged.sort((a, b) => (a.localDate < b.localDate ? 1 : a.localDate > b.localDate ? -1 : 0));
  return merged;
}
