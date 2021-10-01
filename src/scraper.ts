import { Octokit } from '@octokit/core';

import {
  Organization,
  PublicUser,
  RepoWithEvents,
  ScrapingResult,
} from 'interfaces';

import { readJSONFile, saveJSONFile } from 'utils/json';
import requestWrapper from 'utils/requestWrapper';

const scraper = async (octokit: Octokit, resultLocation: string) => {
  let nextPageToScrape: number;
  let organizations: Organization[];

  try {
    const result = readJSONFile<ScrapingResult>(resultLocation);
    nextPageToScrape = result.nextPageToScrape;
    organizations = result.organizations;
  } catch {
    nextPageToScrape = 1;
    organizations = [];
  }

  while (true) {
    const orgs = await requestWrapper(() =>
      octokit.request('GET /search/users', {
        q: 'location:brazil type:org',
        page: nextPageToScrape,
        per_page: 100,
      })
    );

    for (const organization of orgs.items) {
      if (organizations.some((o) => o.login === organization.login)) continue;

      const data = await requestWrapper(() =>
        octokit.request('GET /users/{username}', {
          username: organization.login,
        })
      );

      const publicUser = data as PublicUser;

      const rawRepos = await requestWrapper(() =>
        octokit.request('GET /users/{username}/repos', {
          username: organization.login,
        })
      );

      const repos: RepoWithEvents[] = [];

      for (const repo of rawRepos) {
        const events = await requestWrapper(() =>
          octokit.request('GET /repos/{owner}/{repo}/events', {
            owner: organization.login,
            repo: repo.name,
          })
        );

        repos.push({ ...repo, last_90_days_events_count: events.length });
      }

      const totalRepoStars = repos.reduce(
        (acc, r) => acc + (r.stargazers_count ?? 0),
        0
      );

      const totalRepoLast90DaysEventsCount = repos.reduce(
        (acc, r) => acc + r.last_90_days_events_count,
        0
      );

      const org: Organization = {
        ...publicUser,
        repos,
        total_repo_stars: totalRepoStars,
        total_repo_last_90_days_events_count: totalRepoLast90DaysEventsCount,
      };

      organizations = [...organizations, org];

      const result = { nextPageToScrape, organizations };

      saveJSONFile<ScrapingResult>(resultLocation, result);

      console.log(
        `\n${org.name}:\n${totalRepoLast90DaysEventsCount} eventos recentes\t${totalRepoStars} estrelas em seus repositórios`
      );
    }

    nextPageToScrape++;
    const result = { nextPageToScrape, organizations };

    saveJSONFile<ScrapingResult>(resultLocation, result);
  }
};

export default scraper;
