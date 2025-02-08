// src/main/utils/config.js
class ConfigManager {
  constructor() {
    this.credentials = new Map();
  }

  setCredentials(service, credentials) {
    this.credentials.set(service, credentials);
  }

  hasCredentials(service) {
    return this.credentials.has(service);
  }

  getCredentials(service) {
    return this.credentials.get(service);
  }
}

const configManager = new ConfigManager();
export { configManager };
