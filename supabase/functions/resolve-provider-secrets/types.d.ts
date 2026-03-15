declare module 'npm:@supabase/supabase-js@2' {
  export const createClient: (...args: any[]) => any;
}

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};
