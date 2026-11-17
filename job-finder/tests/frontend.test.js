import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function setup() {
  const dom = new JSDOM(html,{url:'https://www.pankhuriverma.com/job-finder/',runScripts:'outside-only'});
  dom.window.eval(dom.window.document.querySelector('script').textContent);
  return dom;
}
test('employer UI sends filters, paginates, saves source and disables radius', async () => {
  const dom = setup(),w=dom.window,d=w.document;const calls=[];
  try {
    w.fetch=async url=>{calls.push(new URL(url));return { ok:true,json:async()=>({provider:'Employer index',count:51,results:[{id:'a',title:'Head of Support',level:'Manager',industry:'Finance',company:{display_name:'Bank'},location:{display_name:'London'},redirect_url:'https://example.com/job'}]}) }};
    d.getElementById('provider').value='employers';d.getElementById('provider').dispatchEvent(new w.Event('change'));
    assert.equal(d.getElementById('distance').disabled,true);
    d.querySelector('#seniorityOptions input[value="Manager"]').checked=true;
    await w.runSearch();
    assert.equal(calls[0].pathname,'/api/index/jobs');assert.equal(calls[0].searchParams.get('levels'),'Manager');
    assert.match(d.getElementById('jobs').textContent,/Head of Support/);
    assert.equal(d.getElementById('pagination').classList.contains('hidden'),false);
    d.getElementById('nextPage').click();await tick();
    assert.equal(calls[1].searchParams.get('page'),'2');
    d.querySelector('#seniorityOptions input[value="Director"]').checked=true;
    d.querySelector('#seniorityOptions input[value="Director"]').dispatchEvent(new w.Event('change'));await tick();
    assert.equal(calls[2].searchParams.get('page'),'1');assert.equal(calls[2].searchParams.get('levels'),'Manager,Director');
    d.getElementById('saveBtn').click();assert.equal(JSON.parse(w.localStorage.getItem('uk-job-finder-search')).provider,'employers');
    d.getElementById('clearBtn').click();assert.equal(d.getElementById('senioritySelection').textContent,'Choose');
  } finally { dom.window.close(); }
});
test('clearing a search prevents an older response from repopulating results', async () => {
  const dom=setup(),w=dom.window,d=w.document;let resolve;
  try {
    w.fetch=()=>new Promise(r=>resolve=r);
    const pending=w.runSearch();d.getElementById('clearBtn').click();
    resolve({ok:true,json:async()=>({results:[{id:'late',title:'Late result'}],count:1})});await pending;
    assert.equal(d.getElementById('jobs').textContent,'');assert.equal(d.getElementById('searchButton').disabled,false);
  } finally { dom.window.close(); }
});
