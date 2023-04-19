export class DuneError extends Error {
  constructor(msg: string) {
    super(msg);
    Object.setPrototypeOf(this, DuneError.prototype);
  }
}
