export default class Logger {
  static log(message: string, metadata?: any) {
    console.log(this.formatMessage(message, metadata));
  }

  static error(message: string, metadata?: any) {
    console.error(this.formatMessage(message, metadata));
  }
  static warn(message: string, metadata?: any) {
    console.warn(this.formatMessage(message, metadata));
  }

  static formatMessage(message: string, metadata?: any) {
    return `[${new Date().toISOString()}] ${message} ${metadata ? JSON.stringify(metadata) : ''}`;
  }
}
