import type { RequestHandler } from 'express';

const handler: RequestHandler = async (req, res) => {
  const { default: app } = await import('../dist/server/index.js');
  return app(req, res);
};

export default handler;// force redeploy
