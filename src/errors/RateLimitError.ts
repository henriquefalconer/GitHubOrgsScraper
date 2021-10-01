class RateLimitError {
  public readonly response: {
    headers: {
      'x-ratelimit-remaining': string | undefined;
      'x-ratelimit-reset': string | undefined;
    };
  };

  constructor(rateLimitReset: string | undefined) {
    this.response = {
      headers: {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': rateLimitReset,
      },
    };
  }
}

export default RateLimitError;
