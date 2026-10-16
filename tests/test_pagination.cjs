const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),catalog=JSON.parse(fs.readFileSync('produtos.json','utf8'));
function element(tag='div'){return {tag,children:[],value:'',dataset:{},style:{},listeners:{},classList:{toggle(){},remove(){}},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},removeAttribute(k){delete this[k]},addEventListener(k,f){this.listeners[k]=f},scrollIntoView(){},getBoundingClientRect(){return {width:100}},showModal(){this.open=true},close(){this.open=false},focus(){},querySelector(){return this.children[0]||null},scrollTo(){},matches(){return false},contains(){return false}}}
const els={},get=id=>els[id]||(els[id]=element());get('sort').value='featured';
const categories=[...html.matchAll(/data-category="([^"]+)"/g)].map(m=>{const e=element('a');e.dataset.category=m[1];return e});
const events={},docEvents={},requests=[];let currentData=catalog,networkError=false;
const ctx={console:{...console,error(){}},document:{getElementById:get,createElement:element,querySelectorAll:()=>categories,visibilityState:'visible',addEventListener(k,f){docEvents[k]=f},body:{style:{overflow:''}}},window:{addEventListener(k,f){events[k]=f},matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:()=>({columnGap:'7px'})},setInterval:()=>1,clearInterval(){},fetch:async(url,options)=>{requests.push({url,options});if(networkError)throw Error('offline');return {ok:true,json:async()=>currentData}},URL};
vm.createContext(ctx);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],ctx);


(async()=>{
 currentData=Array.from({length:37},(_,i)=>({...catalog[0],id:'page-'+i,nome:'Item '+String(i).padStart(2,'0'),descricao:'Produto de teste '+i,categoria:i<20?'Fontes':'Memória RAM',preco:37-i,destaque:false}));
 await vm.runInContext('loadProducts()',ctx);
 const grid=get('productGrid'),more=get('showMoreProducts'),less=get('showLessProducts');
 assert.equal(grid.children.length,12);assert.equal(get('resultCount').textContent,'12 de 37 produto(s)');assert.equal(less.hidden,true);assert.equal(more.hidden,false);
 const first=grid.children[0];more.listeners.click();assert.equal(grid.children.length,24);assert.equal(grid.children[0],first,'Cartões já mostrados não devem ser recriados');assert.equal(less.hidden,false);
 more.listeners.click();assert.equal(grid.children.length,36);assert.match(more.textContent,/\+1/);
 more.listeners.click();assert.equal(grid.children.length,37);assert.equal(more.hidden,true);
 assert.equal(new Set(grid.children.map(c=>c.children[1].children[0].textContent)).size,37,'Não há produtos duplicados');
 less.listeners.click();assert.equal(grid.children.length,12);assert.equal(grid.children[0],first);assert.equal(less.hidden,true);assert.equal(more.hidden,false);
 more.listeners.click();get('categoryFilter').value='Fontes';get('categoryFilter').listeners.change();
 assert.equal(grid.children.length,12);assert.equal(get('resultCount').textContent,'12 de 20 produto(s)');more.listeners.click();assert.equal(grid.children.length,20);
 get('sort').value='low';get('sort').listeners.change();assert.equal(grid.children.length,12);assert.equal(grid.children[0].children[1].children[0].textContent,'Item 19','Ordenação usa o catálogo filtrado inteiro');
 vm.runInContext("category='';input.value='Item 36';render()",ctx);assert.equal(grid.children.length,1);assert.equal(grid.children[0].children[1].children[0].textContent,'Item 36','A busca acha produtos fora do primeiro bloco');assert.equal(get('catalogPagination').hidden,true);
 vm.runInContext("input.value='zzzinexistente';render()",ctx);assert.equal(get('resultCount').textContent,'0 de 0 produto(s)');assert.equal(get('catalogPagination').hidden,true);
 vm.runInContext('clearFilters()',ctx);assert.equal(grid.children.length,12);assert.equal(more.hidden,false);
 events.pagehide();assert.equal(get('catalogPagination').hidden,true);assert.equal(vm.runInContext('catalogResults.length',ctx),0);
 await vm.runInContext('loadProducts()',ctx);assert.equal(grid.children.length,12);
 console.log('Paginação verificada: 12 por vez, expansão sem recriar cartões, recolhimento, último bloco, filtros, ordenação, busca global e reabertura.');
})().catch(e=>{console.error(e);process.exitCode=1});
