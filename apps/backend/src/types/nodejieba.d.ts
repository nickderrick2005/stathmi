declare module 'nodejieba' {
  export function cut(sentence: string, strict?: boolean): string[];
  export function cutHmm(sentence: string): string[];
  export function cutAll(sentence: string): string[];
  export function cutForSearch(sentence: string): string[];
  export function tag(sentence: string): { word: string; tag: string }[];
  export function extract(sentence: string, threshold: number): { word: string; weight: number }[];
  export function insertWord(word: string, freq?: number, tag?: string): void;
  export function load(dict: object): void;
}
