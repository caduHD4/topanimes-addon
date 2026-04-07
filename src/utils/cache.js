class TTLCache {
  constructor() {
    this.map = new Map();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) {
      return null;
    }

    if (Date.now() > hit.expiresAt) {
      this.map.delete(key);
      return null;
    }

    return hit.value;
  }

  set(key, value, ttlMs) {
    this.map.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }
}

module.exports = {
  TTLCache
};