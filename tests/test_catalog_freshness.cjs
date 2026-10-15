const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),catalog=JSON.parse(fs.readFileSync('produtos.json','utf8'));
function element(tag='div'){return {tag,children:[],value:'',dataset:{},style:{},listeners:{},classList:{toggle(){},remove(){}},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},removeAttribute(k){delete this[k]},addEventListener(k,f){this.listeners[k]=f},scrollIntoView(){},getBoundingClientRect(){return {width:100}},showModal(){this.open=true},close(){this.open=false},focus(){},querySelector(){return this.children[0]||null},scrollTo(){},matches(){return false},contains(){return false}}}
const els={},get=id=>els[id]||(els[id]=element());get('sort').value='featured';
const categories=[...html.matchAll(/data-category="([^"]+)"/g)].map(m=>{const e=element('a');e.dataset.category=m[1];return e});
const events={},docEvents={},requests=[];let currentData=catalog,networkError=false;
const ctx={console:{...console,error(){}},document:{getElementById:get,createElement:element,querySelectorAll:()=>categories,visibilityState:'visible',addEventListener(k,f){docEvents[k]=f},body:{style:{overflow:''}}},window:{addEventListener(k,f){events[k]=f},matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:()=>({columnGap:'7px'})},setInterval:()=>1,clearInterval(){},fetch:async(url,options)=>{requests.push({url,options});if(networkError)throw Error('offline');return {ok:true,json:async()=>currentData}},URL};
vm.createContext(ctx);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],ctx);

const settle=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 await vm.runInContext('loadProducts()',ctx);
 assert.equal(get('productGrid').children.length,catalog.length);
 assert(requests.every(r=>r.options.cache==='no-store'&&r.url.includes('?atualizacao=')));
 const removed=catalog[0];currentData=catalog.slice(1);
 events.pagehide();assert.equal(vm.runInContext('products.length',ctx),0);assert.equal(get('featuredTrack').children.length,0);
 events.pageshow({persisted:true});await settle();
 assert.equal(vm.runInContext('products.length',ctx),currentData.length);
 assert.equal(vm.runInContext('products.some(p=>p.id==='+JSON.stringify(removed.id)+')',ctx),false);
 ctx.document.visibilityState='hidden';docEvents.visibilitychange();assert.equal(vm.runInContext('products.length',ctx),0);
 currentData=catalog.slice(2);ctx.document.visibilityState='visible';docEvents.visibilitychange();await settle();assert.equal(vm.runInContext('products.length',ctx),currentData.length);
 networkError=true;events.online();await settle();assert.equal(vm.runInContext('products.length',ctx),0);assert.equal(get('featuredTrack').children.length,0);assert.match(get('productGrid').children[0].textContent,/Não foi possível atualizar/);
 networkError=false;currentData=catalog;events.online();await settle();assert.equal(vm.runInContext('products.length',ctx),catalog.length);
 const pending=[];ctx.fetch=()=>new Promise(resolve=>pending.push(resolve));const old=vm.runInContext('loadProducts()',ctx);const fresh=vm.runInContext('loadProducts()',ctx);
 pending[1]({ok:true,json:async()=>catalog.slice(1)});await fresh;pending[0]({ok:true,json:async()=>catalog});await old;assert.equal(vm.runInContext('products.length',ctx),catalog.length-1);
 console.log('Cache tests passed: fresh requests, restored pages, foreground return, offline handling, reconnect and stale response ordering.');
})().catch(e=>{console.error(e);process.exitCode=1});
