declare module 'node:fs/promises' {
  export function stat(path: string): Promise<{
    birthtimeMs: number;
    ctimeMs: number;
    mtimeMs: number;
  }>;
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string;
}
