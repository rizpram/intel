import test from 'node:test';
import assert from 'node:assert/strict';
import {AuthorizedRestConnector,validateRecord} from '../worker/connectors/authorized-rest';
const valid={externalId:'123',text:'Public source evidence',publishedAt:'2026-10-05T12:00:00Z',canonicalUrl:'https://example.com/post/123'};
test('invalid source records never reach persistence',()=>{
 for(const record of [{...valid,externalId:'undefined'},{...valid,publishedAt:'invalid'},{...valid,canonicalUrl:'javascript:alert(1)'},{...valid,engagement:-1},{...valid,text:''}])assert.throws(()=>validateRecord(record));
 assert.equal(validateRecord(valid).externalId,'123');
});
test('unauthorized connector destinations fail before a network request',async()=>{
 process.env.TEST_PROVIDER_URL='https://unapproved.example/api';process.env.CONNECTOR_ALLOWED_HOSTS='approved.example';
 const adapter=new AuthorizedRestConnector('test','TEST_PROVIDER_URL',x=>x);
 await assert.rejects(()=>adapter.fetchRecent({workspaceId:'workspace',topicId:'topic',connectorId:'connector',secret:'secret',query:{include:['brand']}}),/explicitly authorized/);
});
test('connector sends topic query, refuses redirects and validates provider records',async()=>{
 process.env.TEST_PROVIDER_URL='https://approved.example/api';process.env.CONNECTOR_ALLOWED_HOSTS='approved.example';
 const original=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{assert.equal(new URL(String(input)).searchParams.get('query'),'brand OR service');assert.equal(init?.redirect,'error');assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer secret');return new Response(JSON.stringify({data:[valid]}));};
 try{const adapter=new AuthorizedRestConnector('test','TEST_PROVIDER_URL',x=>x);const rows=await adapter.fetchRecent({workspaceId:'workspace',topicId:'topic',connectorId:'connector',secret:'secret',query:{include:['brand','service']}});assert.equal(rows.length,1);}finally{globalThis.fetch=original;}
});
