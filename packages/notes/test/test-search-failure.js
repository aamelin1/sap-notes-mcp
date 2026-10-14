import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SapNotesApiClient } from '../dist/sap-notes-api.js';

const note = {
  id: '2744792', component: 'BC', title: 'Verified note title', summary: 'Verified summary',
  releaseDate: '2026-01-01', language: 'EN', url: 'https://me.sap.com/notes/2744792'
};

function failingClient() {
  const client = new SapNotesApiClient({});
  client.getCoveoToken = async () => { throw new Error('Coveo unavailable'); };
  client.internalRequests = 0;
  client.makeRequest = async () => {
    client.internalRequests++;
    return new Response('<html>Request 12345678, timestamp 20261014, error 654321</html>', {
      headers: { 'content-type': 'text/html' }
    });
  };
  return client;
}

test('Coveo token failure rejects keyword search without speculative requests', async () => {
  const client = failingClient();
  client.getNote = async () => { assert.fail('Keyword query must not fetch a note'); };
  await assert.rejects(client.searchNotes('OData error', 'test-cookie'), /Search temporarily unavailable/);
  assert.equal(client.internalRequests, 0);
});

test('HTML containing arbitrary numbers cannot become search results', async (t) => {
  const client = failingClient();
  client.getCoveoToken = async () => 'test-token';
  t.mock.method(globalThis, 'fetch', async () => new Response(
    '<html>Request 12345678, timestamp 20261014, error 654321</html>',
    { status: 503, headers: { 'content-type': 'text/html' } }
  ));
  await assert.rejects(client.searchNotes('OData error', 'test-cookie'), /Search temporarily unavailable/);
  assert.equal(client.internalRequests, 0);
});

test('explicit note ID still returns metadata from direct retrieval', async () => {
  const client = failingClient();
  client.getNote = async (id) => { assert.equal(id, note.id); return note; };
  const response = await client.searchNotes(note.id, 'test-cookie');
  assert.equal(response.totalResults, 1);
  assert.deepEqual(response.results, [note]);
});

test('failed direct retrieval reports unavailable search', async () => {
  const client = failingClient();
  client.getNote = async () => { throw new Error('Note unavailable'); };
  await assert.rejects(client.searchNotes(note.id, 'test-cookie'), /Search temporarily unavailable/);
  assert.equal(client.internalRequests, 0);
});

test('successful Coveo search with zero matches remains an empty result', async (t) => {
  const client = failingClient();
  client.getCoveoToken = async () => 'test-token';
  t.mock.method(globalThis, 'fetch', async () => Response.json({ results: [], totalCount: 0 }));
  assert.deepEqual(await client.searchNotes('OData error', 'test-cookie'), {
    results: [], totalResults: 0, query: 'OData error'
  });
});
