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

      const totalRepoWatchers = repos.reduce(
        (acc, r) => acc + (r.watchers_count ?? 0),
        0
      );

      const totalRepoForks = repos.reduce(
        (acc, r) => acc + (r.forks_count ?? 0),
        0
      );

      const totalRepoOpenIssues = repos.reduce(
        (acc, r) => acc + (r.open_issues_count ?? 0),
        0
      );

      const totalRepoLast90DaysEvents = repos.reduce(
        (acc, r) => acc + r.last_90_days_events_count,
        0
      );

      const {
        login,
        id,
        avatar_url,
        html_url,
        name,
        company,
        blog,
        location,
        email,
        hireable,
        bio,
        twitter_username,
        public_repos,
        followers,
        following,
        created_at,
        updated_at,
      } = publicUser;

      const org: Organization = {
        login,
        id,
        avatarUrl: avatar_url,
        htmlUrl: html_url,
        name,
        company,
        blog,
        location,
        email,
        hireable,
        bio,
        twitterUsername: twitter_username ?? null,
        publicRepos: public_repos,
        followers,
        following,
        createdAt: created_at,
        updatedAt: updated_at,
        totalRepoStars,
        totalRepoWatchers,
        totalRepoForks,
        totalRepoOpenIssues,
        totalRepoLast90DaysEvents,
      };

      organizations = [...organizations, org];

      const result = { nextPageToScrape, organizations };

      saveJSONFile<ScrapingResult>(resultLocation, result);

      console.log(
        `\n(${organizations.length}/${orgs.total_count}) ${org.name}:\n${totalRepoLast90DaysEvents} eventos recentes\t${totalRepoStars} estrelas em seus repositórios`
      );
    }

    nextPageToScrape++;
    const result = { nextPageToScrape, organizations };

    saveJSONFile<ScrapingResult>(resultLocation, result);
  }
};

export default scraper;
