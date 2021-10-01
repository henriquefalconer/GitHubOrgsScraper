import { Octokit } from '@octokit/core';
import dotenv from 'dotenv';

import scraper from 'scraper';

dotenv.config();

const octokit = new Octokit({ auth: process.env.PERSONAL_ACCESS_TOKEN });

const resultLocation = 'src/result.json';

scraper(octokit, resultLocation);
