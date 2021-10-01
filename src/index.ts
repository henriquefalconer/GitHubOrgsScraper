import { Octokit } from '@octokit/core';
import dotenv from 'dotenv';

import Scraper from 'Scraper';

dotenv.config();

const scraper = new Scraper();

scraper.setup({
  octokit: new Octokit({ auth: process.env.PERSONAL_ACCESS_TOKEN }),
  baseQuery: 'location:brazil type:org repos:>0',
  resultLocation: 'src/result.json',
});

scraper.run();
