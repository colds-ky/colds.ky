// @ts-check

import { BskyAgent } from '@atproto/api';
import { shortenDID } from '../api';
import { getKeyShortDID } from '../api/core';

export async function updateDIDs() {
  /** @type {import('../../dids/cursors.json')} */
  const startCursorsJSON = await fetch('./dids/cursors.json').then(r => r.json());

  const populatedDIDs = {
    /** @type {string[]} */
    shortDIDs: [],
    /** @type {{ [shortDID: string]: string[] }} */
    buckets: {},
    currentCursor: startCursorsJSON.listRepos.cursor,
    requestCount: 0,
    requestTime: 0,
    /** @type {Error | undefined} */
    currentError: undefined,
    currentErrorRetryTime: 0,
    reachedEnd: false
  };

  return {
    ...startCursorsJSON,
    beginFetchingDIDs,
    populatedDIDs,
    verifyGitHubAuth
  };

  async function beginFetchingDIDs() {
    const atClient = new BskyAgent({
      // service: 'https://bsky.social/xrpc'
      service: 'https://bsky.network/xrpc'
    });
    /** @type {*} */(atClient).baseClient.lex.assertValidXrpcOutput = function () { };

    let lastNormal = Date.now();
    while (true) {
      const startTime = Date.now();
      try {
        let received = await fetchMore();
        populatedDIDs.requestCount++;
        populatedDIDs.requestTime += Date.now() - startTime;
        if (received)
          lastNormal = Date.now();
      } catch (error) {
        populatedDIDs.currentError = error;
        populatedDIDs.currentErrorRetryTime = Date.now() - lastNormal;
      }

      const waitMore = Math.min(
        Date.now() - startTime + 300,
        1000 * 45
      ) * (0.5 + Math.random());
      await new Promise(resolve => setTimeout(resolve, waitMore));

      if (populatedDIDs.reachedEnd) break;
    }

    async function fetchMore() {
      const response = await atClient.com.atproto.sync.listRepos({
        cursor: populatedDIDs.currentCursor,
        limit: 995
      });
      if (!response.data) return;

      if (response.data.repos.length) {
        for (const repo of response.data.repos) {
          const shortDID = shortenDID(repo.did);
          populatedDIDs.shortDIDs.push(shortDID);
          const twoLetter = getKeyShortDID(shortDID);
          const bucket = populatedDIDs[twoLetter] || (
            populatedDIDs[twoLetter] = []
          );
          bucket.push(shortDID);
        }
      }

      if (!response.data.cursor) {
        populatedDIDs.reachedEnd = true;
      } else {
        populatedDIDs.currentCursor = response.data.cursor;
      }

      return response.data.repos.length;
    }
  }

  async function verifyGitHubAuth(username, password) {
    //
  }
}