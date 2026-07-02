'use strict';

module.exports = {

  async getPhotos({ homey, body }) {
    const { album, refreshMinutes } = body || {};
    return homey.app.getPhotos(album, refreshMinutes);
  },

  async getImage({ homey, body }) {
    const { url } = body || {};
    return homey.app.getImageDataUrl(url);
  },

};
