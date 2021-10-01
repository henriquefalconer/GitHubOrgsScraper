import { OctokitResponse } from '@octokit/types';
import moment from 'moment';

import RateLimitError from 'errors/RateLimitError';
import RepoBlocked from 'errors/RepoBlocked';

import { getFormattedTime, wait } from './time';

const requestWrapper = async <D>(
  request: () => Promise<OctokitResponse<D>>,
  retries = 1
): Promise<D> => {
  try {
    const { data, headers } = await request();

    if (headers['x-ratelimit-remaining'] === '0')
      throw new RateLimitError(headers['x-ratelimit-reset']);

    return data;
  } catch (err: any) {
    if (err.response?.data?.message === 'Repository access blocked')
      throw new RepoBlocked(err.response.data.block.reason);

    if (err.response?.headers['x-ratelimit-remaining'] !== '0') {
      console.log(err);
      if (retries) return requestWrapper(request, --retries);
      throw err;
    }

    const resetMoment = moment.unix(
      Number(err.response.headers['x-ratelimit-reset']) + 1
    );

    console.log(
      `\n[${getFormattedTime()}] Chegou ao limite de requisições. Retomando operação às ${resetMoment.format(
        'HH:mm:ss'
      )}`
    );

    await wait(resetMoment.diff(moment()));

    console.log(`\n[${getFormattedTime()}] Operação retomada.`);

    return requestWrapper(request, retries);
  }
};

export default requestWrapper;
