import { Octokit } from '@octokit/core';
import moment from 'moment';

import {
  Organization,
  PublicUser,
  RepoWithEvents,
  ScrapingResult,
} from 'interfaces';

import RepoBlocked from 'errors/RepoBlocked';

import { getFormattedTime, getPreviousWeek } from 'utils/time';
import { readJSONFile, saveJSONFile } from 'utils/json';
import requestWrapper from 'utils/requestWrapper';

const scraper = async (octokit: Octokit, resultLocation: string) => {
  let nextPageToScrape: number;
  let date: string;
  let organizations: Organization[];

  try {
    const result = readJSONFile<ScrapingResult>(resultLocation);
    nextPageToScrape = result.nextPageToScrape;
    date = result.searchingDate;
    organizations = result.organizations;
  } catch {
    nextPageToScrape = 1;
    date = moment().format('YYYY-MM-DD');
    organizations = [];
  }

  const baseQuery = `location:brazil type:org repos:>0`;

  const {
    items: [oldestOrg],
    total_count,
  } = await requestWrapper(() =>
    octokit.request('GET /search/users', {
      q: baseQuery,
      sort: 'joined',
      order: 'asc',
    })
  );

  const oldestData = await requestWrapper(() =>
    octokit.request('GET /users/{username}', {
      username: oldestOrg.login,
    })
  );

  const publicUser = oldestData as PublicUser;

  const oldestOrgDate = publicUser.created_at;

  while (moment(date, 'YYYY-MM-DD').isAfter(oldestOrgDate)) {
    const dateCreated = `created:${getPreviousWeek(date)}..${date}`;

    const orgs = await requestWrapper(() =>
      octokit.request('GET /search/users', {
        q: `${baseQuery} ${dateCreated}`,
        page: nextPageToScrape,
        per_page: 100,
      })
    );

    if (!orgs.items.length) {
      date = getPreviousWeek(date);
      nextPageToScrape = 1;

      const result = {
        nextPageToScrape,
        searchingDate: date,
        organizations,
      };

      saveJSONFile<ScrapingResult>(resultLocation, result);

      continue;
    }

    for (const organization of orgs.items) {
      if (organizations.some((o) => o.login === organization.login)) continue;

      const rawRepos = await requestWrapper(() =>
        octokit.request('GET /users/{username}/repos', {
          username: organization.login,
        })
      );

      if (!rawRepos.length) continue;

      const data = await requestWrapper(() =>
        octokit.request('GET /users/{username}', {
          username: organization.login,
        })
      );
      const publicUser = data as PublicUser;

      const repos: RepoWithEvents[] = [];

      for (const repo of rawRepos) {
        let last_90_days_events_count: number;

        try {
          const events = await requestWrapper(() =>
            octokit.request('GET /repos/{owner}/{repo}/events', {
              owner: organization.login,
              repo: repo.name,
            })
          );
          last_90_days_events_count = events.length;
        } catch (err) {
          if (!(err instanceof RepoBlocked)) throw err;
          last_90_days_events_count = 0;
        }

        repos.push({ ...repo, last_90_days_events_count });
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

      const result = {
        nextPageToScrape,
        searchingDate: date,
        organizations,
      };

      saveJSONFile<ScrapingResult>(resultLocation, result);

      const count = organizations.length;
      const stats = `[${count}/${total_count} - ${getFormattedTime()}]`;
      const info = `${org.name} (${org.login})`;
      const numbers = `${totalRepoLast90DaysEvents} eventos recentes\t${totalRepoStars} estrelas em seus repositórios`;

      console.log(`\n${stats} ${info}:\n${numbers}`);
    }

    nextPageToScrape++;
    const result = {
      nextPageToScrape,
      searchingDate: date,
      organizations,
    };

    saveJSONFile<ScrapingResult>(resultLocation, result);
  }

  console.log(`\n[${getFormattedTime()}] Processo finalizado.\n`);
};

export default scraper;
