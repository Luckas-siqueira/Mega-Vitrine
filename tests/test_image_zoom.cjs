const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),catalog=JSON.parse(fs.readFileSync('produtos.json','utf8'));
function element(tag='div'){return {tag,children:[],value:'',dataset:{},style:{},listeners:{},classList:{toggle(){},remove(){}},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},removeAttribute(k){delete this[k]},addEventListener(k,f){this.listeners[k]=f},scrollIntoView(){},getBoundingClientRect(){return {width:100}},showModal(){this.open=true},close(){this.open=false},focus(){},querySelector(){return this.children[0]||null},scrollTo(){},matches(){return false},contains(){return false}}}
const els={},get=id=>els[id]||(els[id]=element());get('sort').value='featured';
const categories=[...html.matchAll(/data-category="([^"]+)"/g)].map(m=>{const e=element('a');e.dataset.category=m[1];return e});
const events={},docEvents={},requests=[];let currentData=catalog,networkError=false;
const ctx={console:{...console,error(){}},document:{getElementById:get,createElement:element,querySelectorAll:()=>categories,visibilityState:'visible',addEventListener(k,f){docEvents[k]=f},body:{style:{overflow:''}}},window:{addEventListener(k,f){events[k]=f},matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:()=>({columnGap:'7px'})},setInterval:()=>1,clearInterval(){},fetch:async(url,options)=>{requests.push({url,options});if(networkError)throw Error('offline');return {ok:true,json:async()=>currentData}},URL};
vm.createContext(ctx);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],ctx);


const readState=()=>JSON.parse(vm.runInContext('JSON.stringify(viewerView)',ctx));
const emit=(type,props={})=>get('viewerViewport').listeners[type]({preventDefault(){this.prevented=true},clientX:170,clientY:140,button:0,pointerType:'touch',...props});
(async()=>{
 await vm.runInContext('loadProducts()',ctx);
 const bounds={width:400,height:300,imageWidth:400,imageHeight:300};
 ctx.zoomBounds=bounds;
 const anchored=JSON.parse(vm.runInContext('JSON.stringify(zoomImageView({scale:1,x:0,y:0},2,{x:50,y:30},{x:50,y:30},zoomBounds))',ctx));
 assert.deepEqual(anchored,{scale:2,x:-50,y:-30});assert.equal((50-anchored.x)/anchored.scale,50,'O ponto sob o cursor fica fixo');
 const bounded=JSON.parse(vm.runInContext('JSON.stringify(clampImageView({scale:99,x:9999,y:-9999},zoomBounds))',ctx));assert.deepEqual(bounded,{scale:6,x:1000,y:-750});
 const reset=JSON.parse(vm.runInContext('JSON.stringify(clampImageView({scale:.1,x:999,y:999},zoomBounds))',ctx));assert.deepEqual(reset,{scale:1,x:0,y:0});
 const viewport=get('viewerViewport');viewport.getBoundingClientRect=()=>({width:320,height:240,left:10,top:20});viewport.classList.add=()=>{};viewport.setPointerCapture=()=>{};
 get('viewerImage').naturalWidth=800;get('viewerImage').naturalHeight=600;
 vm.runInContext('openProductImage(products[0],null)',ctx);get('viewerImage').onload();
 assert.equal(get('viewerImage').style.width,'320px');assert.equal(get('viewerScale').textContent,'100%');assert.equal(get('viewerZoomOut').disabled,true);
 emit('wheel',{deltaY:-350,deltaMode:0});assert.ok(readState().scale>1);assert.ok(readState().scale<=6);
 emit('pointerdown',{pointerId:1,clientX:170});emit('pointermove',{pointerId:1,clientX:900});assert.ok(readState().x>0);assert.ok(readState().x<=(320*readState().scale-320)/2);
 emit('pointerup',{pointerId:1});assert.equal(vm.runInContext('viewerPointers.size',ctx),0);
 get('viewerReset').listeners.click();assert.deepEqual(readState(),{scale:1,x:0,y:0});
 emit('pointerdown',{pointerId:1,clientX:120});emit('pointerdown',{pointerId:2,clientX:220});emit('pointermove',{pointerId:2,clientX:320});assert.equal(readState().scale,2,'Separar dois dedos amplia proporcionalmente');
 emit('pointerup',{pointerId:1});const before=readState();emit('pointermove',{pointerId:2,clientX:310});assert.equal(readState().x,before.x-10,'É possível continuar movendo com um dedo após a pinça');
 emit('pointercancel',{pointerId:2});assert.equal(vm.runInContext('viewerPointers.size',ctx),0);
 emit('wheel',{deltaY:-999999,deltaMode:0});emit('wheel',{deltaY:-999999,deltaMode:0});assert.equal(readState().scale,6);
 for(let i=0;i<10;i++)emit('wheel',{deltaY:999999,deltaMode:0});assert.equal(readState().scale,1);assert.equal(get('viewerZoomOut').disabled,true);
 emit('keydown',{key:'+'});assert.equal(readState().scale,1.5);emit('keydown',{key:'0'});assert.equal(readState().scale,1);
 get('viewerZoom').listeners.click();assert.equal(readState().scale,1.5);get('viewerZoomOut').listeners.click();assert.equal(readState().scale,1);
 emit('wheel',{deltaY:-350,deltaMode:0});vm.runInContext('openProductImage(products[1],null)',ctx);get('viewerImage').onload();assert.deepEqual(readState(),{scale:1,x:0,y:0},'Uma nova foto abre sem o zoom anterior');
 get('imageViewer').listeners.close();assert.equal(vm.runInContext('viewerReady',ctx),false);assert.equal(vm.runInContext('viewerPointers.size',ctx),0);assert.deepEqual(readState(),{scale:1,x:0,y:0});
 console.log('Zoom verificado: ponto fixo, limites de 1–6x, roda, pinça, arraste, transição para um dedo, cancelamento, botões, teclado e reinício entre imagens.');
})().catch(e=>{console.error(e);process.exitCode=1});
