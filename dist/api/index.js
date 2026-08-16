// api/index.ts
var handler = async (req, res) => {
  const { default: app } = await import("../dist/server/index.js");
  return app(req, res);
};
var index_default = handler;
export {
  index_default as default
};
