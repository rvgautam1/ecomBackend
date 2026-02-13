export const setPublicCache = (res, seconds) => {
  res.set('Cache-Control', `public, max-age=${seconds}`);
};

export const setPrivateCache = (res, seconds) => {
  res.set('Cache-Control', `private, max-age=${seconds}`);
};

export const disableCache = (res) => {
  res.set('Cache-Control', 'no-store');
};
