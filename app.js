'use strict';

const Homey = require('homey');
const { getAlbumPhotos } = require('./lib/googlePhotos');

module.exports = class GooglePhotosSlideshowApp extends Homey.App {

  async onInit() {
    // albumUrl -> { photos: [...], fetchedAt: <ms> }
    this._cache = new Map();
    this.log('Google Photos Slideshow app initialised');
  }

  /**
   * Return the list of photos for a shared album, cached in memory so the
   * dashboard can poll cheaply. On a fetch error we serve the last good
   * result (if any) rather than blanking the slideshow.
   *
   * @param {string} albumUrl
   * @param {number} [refreshMinutes=30]
   */
  async getPhotos(albumUrl, refreshMinutes = 30) {
    const url = typeof albumUrl === 'string' ? albumUrl.trim() : '';
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('No valid Google Photos album link is configured.');
    }

    const ttl = Math.max(1, Number(refreshMinutes) || 30) * 60 * 1000;
    const now = Date.now();
    const cached = this._cache.get(url);
    if (cached && now - cached.fetchedAt < ttl) {
      return cached.photos;
    }

    try {
      const photos = await getAlbumPhotos(url);
      this._cache.set(url, { photos, fetchedAt: now });
      this.log(`Fetched ${photos.length} photos for album`);
      return photos;
    } catch (err) {
      this.error('Failed to fetch album:', err.message);
      if (cached) return cached.photos; // serve stale data on failure
      throw err;
    }
  }

  /**
   * Optional fallback used by the widget only if a direct <img> load fails
   * (e.g. a webview Content-Security-Policy blocks the external host). Fetches
   * the image server-side and returns it as a data: URL. Restricted to the
   * Google Photos CDN so it can't be used as an open proxy.
   *
   * @param {string} imageUrl
   * @returns {Promise<string>} data URL
   */
  async getImageDataUrl(imageUrl) {
    if (!/^https:\/\/lh3\.googleusercontent\.com\//.test(String(imageUrl))) {
      throw new Error('Refusing to proxy a non-Google-Photos URL.');
    }
    const res = await fetch(imageUrl, { redirect: 'follow' });
    if (!res.ok) throw new Error(`Image download failed: HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  }

};
