import { OctokitResponse } from '@octokit/types';
import moment from 'moment';

import RateLimitError from 'errors/RateLimitError';

import { wait } from './time';

const requestWrapper = async <D>(
  request: () => Promise<OctokitResponse<D>>
): Promise<D> => {
  try {
    const { data, headers } = await request();

    if (headers['x-ratelimit-remaining'] === '0')
      throw new RateLimitError(headers['x-ratelimit-reset']);

    return data;
  } catch (err: any) {
    if (err.response.headers['x-ratelimit-remaining'] !== '0') throw err;

    const resetMoment = moment.unix(
      Number(err.response.headers['x-ratelimit-reset']) + 1
    );

    console.log(
      `\nChegou ao limite de requisições. Retomando operação às ${resetMoment.format(
        'HH:mm:ss'
      )}`
    );

    await wait(resetMoment.diff(moment()));

    return requestWrapper(request);
  }
};

export default requestWrapper;
