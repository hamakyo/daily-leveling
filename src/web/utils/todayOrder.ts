export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const [selected] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, selected);
  return nextItems;
}
