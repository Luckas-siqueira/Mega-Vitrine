const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),catalog=JSON.parse(fs.readFileSync('produtos.json','utf8'));
function element(tag='div'){return {tag,children:[],value:'',dataset:{},style:{},listeners:{},classList:{toggle(){},remove(){}},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},removeAttribute(k){delete this[k]},addEventListener(k,f){this.listeners[k]=f},scrollIntoView(){},getBoundingClientRect(){return {width:100}},showModal(){this.open=true},close(){this.open=false},focus(){},querySelector(){return this.children[0]||null},scrollTo(){},matches(){return false},contains(){return false}}}
const els={},get=id=>els[id]||(els[id]=element());get('sort').value='featured';
const categories=[...html.matchAll(/data-category="([^"]+)"/g)].map(m=>{const e=element('a');e.dataset.category=m[1];return e});
const events={},docEvents={},requests=[];let currentData=catalog,networkError=false;
const ctx={console:{...console,error(){}},document:{getElementById:get,createElement:element,querySelectorAll:()=>categories,visibilityState:'visible',addEventListener(k,f){docEvents[k]=f},body:{style:{overflow:''}}},window:{addEventListener(k,f){events[k]=f},matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:()=>({columnGap:'7px'})},setInterval:()=>1,clearInterval(){},fetch:async(url,options)=>{requests.push({url,options});if(networkError)throw Error('offline');return {ok:true,json:async()=>currentData}},URL};
vm.createContext(ctx);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],ctx);


(async()=>{
 await vm.runInContext('loadProducts()',ctx);
 const search=(name,query)=>vm.runInContext(`productSearchScore(${JSON.stringify({nome:name,categoria:'',descricao:''})},${JSON.stringify(query)})`,ctx);
 for(const [name,query] of [['Memória RAM Kingston','Memoria ram'],['Memória RAM Kingston','memroia ram'],['Memória RAM Kingston','ram memoria'],['Mouse vertical','mause'],['Teclado RGB','tecldo'],['Monitor LED','monitr'],['Memória RAM Kingston','memoria para pc']]){
  if(query==='memoria para pc')assert.equal(search(name,query),0,'Todos os termos relevantes precisam existir');
  else assert.ok(search(name,query)>0,query);
 }
 assert.equal(search('Fonte ATX','abacaxi'),0);
 assert.equal(search('Memória RAM','ram inexistente'),0);
 assert.equal(search('Mouse','pc'),0,'Termos curtos não devem receber correções vagas');
 assert.ok(search('Mouse vertical','mouse')>search('Mause vertical','mouse'),'Correspondências exatas têm prioridade');
 get('searchInput').value='Memoria ram';get('searchInput').listeners.input();
 assert.ok(get('productGrid').children.some(c=>c.tag==='article'),'Pesquisa sem acento encontra produtos');
 get('searchInput').value='memroia ram';get('searchInput').listeners.input();
 assert.ok(get('productGrid').children.some(c=>c.tag==='article'),'Transposição encontra a RAM');
 assert.equal(get('searchSuggestions').hidden,false);
 const suggested=get('searchSuggestions').children.filter(e=>e.tag==='button');
 assert.ok(suggested.length>0&&suggested.length<=5);
 assert.ok(suggested.every(b=>catalog.some(p=>p.nome===b.children[0].textContent)),'Sugestões são produtos cadastrados');
 vm.runInContext("category='Fontes'",ctx);suggested[0].listeners.click();
 assert.equal(vm.runInContext('category',ctx),'');assert.equal(get('searchSuggestions').hidden,true);
 assert.ok(get('productGrid').children.some(c=>c.tag==='article'));
 get('searchInput').value='';get('searchInput').listeners.focus();
 const examples=get('searchSuggestions').children.filter(e=>e.tag==='button');assert.ok(examples.length>0&&examples.length<=5);
 let focused=false;examples[0].focus=()=>{focused=true};get('searchInput').listeners.keydown({key:'ArrowDown',preventDefault(){}});assert.equal(focused,true);
 get('searchInput').listeners.keydown({key:'Escape'});assert.equal(get('searchSuggestions').hidden,true);
 get('searchInput').value='<img src=x onerror=alert(1)>';get('searchInput').listeners.input();assert.equal(get('searchSuggestions').children.filter(e=>e.tag==='button').length,0);
 events.pagehide();assert.equal(get('searchSuggestions').hidden,true);assert.equal(get('searchSuggestions').children.length,0);
 console.log('Busca verificada: acentos, erros de digitação, ordem das palavras, relevância, sugestões reais, seleção, teclado e limpeza ao sair.');
})().catch(e=>{console.error(e);process.exitCode=1});
