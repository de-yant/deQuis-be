import type { RequestHandler } from 'express';

const handler: RequestHandler = async (req, res) => {
  const { default: app } = await import('../server/index');
  return app(req, res);
};

export default handler;
