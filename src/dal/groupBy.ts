export function groupBy<K, V>(items: readonly V[], key: (item: V) => K): Map<K, V[]> {
  const groups = new Map<K, V[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k) ?? [];
    group.push(item);
    groups.set(k, group);
  }
  return groups;
}
