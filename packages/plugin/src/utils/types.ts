export type DisableTreeShaking =
  | string
  | RegExp
  | ((name: string) => boolean)
  | Array<string>
  | Set<string>;
