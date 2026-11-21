/** Distribute projects evenly across boards of three or four, in ranking order. */
export function getBoardPageSizes(count: number): number[] {
  const pages = Math.max(Math.ceil(count / 4), Math.round(count / 3.5));
  const sizes: number[] = [];
  let start = 0;
  for (let page = 1; page <= pages; page++) {
    const end = Math.round(page * count / pages);
    sizes.push(end - start);
    start = end;
  }
  return sizes;
}
