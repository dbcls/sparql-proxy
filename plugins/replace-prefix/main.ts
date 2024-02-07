import { type Context, Response } from "../../src/plugins";

export default async function rewritePrefix(
  ctx: Context,
  next
): Promise<Response> {
  // TODO
  return await next();
}
