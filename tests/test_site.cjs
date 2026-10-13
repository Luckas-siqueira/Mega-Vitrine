const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),catalog=JSON.parse(fs.readFileSync('produtos.json','utf8'));
function element(tag='div'){return {tag,children:[],value:'',dataset:{},style:{},listeners:{},classList:{toggle(){},remove(){}},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},removeAttribute(k){delete this[k]},addEventListener(k,f){this.listeners[k]=f},scrollIntoView(){},getBoundingClientRect(){return {width:100}},showModal(){this.open=true},close(){this.open=false},focus(){},querySelector(){return this.children[0]||null},scrollTo(){},matches(){return false},contains(){return false}}}
const els={},get=id=>els[id]||(els[id]=element());get('sort').value='featured';
const categories=[...html.matchAll(/data-category="([^"]+)"/g)].map(m=>{const e=element('a');e.dataset.category=m[1];return e});
const ctx={console,document:{getElementById:get,createElement:element,querySelectorAll:()=>categories,addEventListener(){},body:{style:{overflow:''}}},window:{addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:()=>({columnGap:'7px'})},setInterval:()=>1,clearInterval(){},fetch:async()=>({ok:true,json:async()=>catalog}),URL};
vm.createContext(ctx);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
(async()=>{
 await vm.runInContext('loadProducts()',ctx);
 assert.equal(get('productGrid').children.length,7);assert.equal(get('featuredTrack').children.length,5);
 vm.runInContext("category='Teclados e Mouses';render()",ctx);assert.match(get('productGrid').children[0].textContent,/Nenhum produto disponível/);
 vm.runInContext("category='Processadores';render()",ctx);assert.match(get('productGrid').children[0].textContent,/Nenhum produto disponível/);
 vm.runInContext("category='';input.value='Headset gamer';render()",ctx);assert.equal(get('productGrid').children.length,1);
 const card=get('productGrid').children[0];card.children[1].children[0].listeners.click();assert.equal(get('imageViewer').open,true);assert.equal(get('viewerTitle').textContent,'Headset gamer');assert.ok(get('viewerDescription').textContent.length>0);
 card.children[0].children[0].onerror();assert.equal(card.children[0].children[0].textContent,'Foto em breve');
 assert.equal(categories.length,15);assert.ok(catalog.every(p=>categories.some(c=>c.dataset.category===p.categoria)));
 console.log('Vitrine verificada: catálogo do nicho, destaques, filtros, categoria vazia, busca, detalhes e indicação de foto pendente.');
})().catch(e=>{console.error(e);process.exitCode=1});
