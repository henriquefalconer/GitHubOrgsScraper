export const wait = (milliseconds: number) =>
  new Promise((res) => setTimeout(res, milliseconds));
