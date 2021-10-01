class RateLimitError {
  public readonly rateLimitReset: string | undefined;

  constructor(rateLimitReset: string | undefined) {
    this.rateLimitReset = rateLimitReset;
  }
}

export default RateLimitError;
