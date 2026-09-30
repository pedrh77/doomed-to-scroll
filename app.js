"use strict";

const $ = (id) => document.getElementById(id);
const SAVE_KEY = "doomed-to-scroll-v1";
const defaults = { coins: 0, discoveries: [], bestCombo: 0, runs: 0, ownedCosmetics:["original"], equippedCosmetic:"original", settings: { reducedMotion: false } };
let meta = loadSave();
let run = null;
let current = null;
let locked = false;
let touchStart = null;

const ITEMS = {
  egg: { name: "Ovo", sprite:"egg" }, dragon: { name: "Dragão", sprite:"dragon" }, key: { name: "Chave", sprite:"key" },
  candle: { name: "Vela", sprite:"candle" }, magnet: { name: "Ímã", sprite:"magnet" }, hourglass: { name: "Ampulheta", sprite:"hourglass" },
  suitcase: { name: "Maleta", sprite:"suitcase" }, ghost: { name: "Fantasma", sprite:"ghost" }
};

const BOSSES=[
  {id:"algorithm",name:"ALGORITMO",taunt:"Eu aprendi seu padrão. Mais uma oferta perfeita?",hot:"ABRIR RECOMPENSA PERFEITA",safe:"IGNORAR A ISCA",chance:.55,reward:25,damage:18},
  {id:"loop",name:"LOOP INFINITO",taunt:"Você já viu isto. Mesmo assim, quer ver de novo?",hot:"ENTRAR NO LOOP",safe:"QUEBRAR O CICLO",chance:.48,reward:32,damage:15},
  {id:"queen",name:"RAINHA DA NOTIFICAÇÃO",taunt:"Uma nova notificação espera. Talvez seja importante.",hot:"ABRIR AGORA",safe:"SILENCIAR",chance:.6,reward:22,damage:20},
  {id:"insomnia",name:"INSÔNIA",taunt:"Dormir pode esperar. A madrugada ainda tem segredos.",hot:"FICAR ACORDADO",safe:"FECHAR OS OLHOS",chance:.44,reward:38,damage:14}
];

const COSMETICS=[
  {id:"original",name:"Clássico",price:0,pos:"0 0"},{id:"violet",name:"Noite Violeta",price:80,pos:"33.333% 0"},
  {id:"coral",name:"Pôr do Sol",price:80,pos:"66.666% 0"},{id:"glitch",name:"Glitch Ciano",price:110,pos:"100% 0"},
  {id:"wizard",name:"Mago Estelar",price:140,pos:"0 100%"},{id:"pajamas",name:"Pijama Lunar",price:140,pos:"33.333% 100%"},
  {id:"crown",name:"Pequena Coroa",price:180,pos:"66.666% 100%"},{id:"glasses",name:"Óculos Estelares",price:160,pos:"100% 100%"}
];

const EVENTS = [
  {id:"chest",name:"Baú suspeito",category:"TESOURO",sprite:"chest",rarity:"COMUM",weight:12,risk:3,text:"Tem dentes demais para um baú normal.",effect:chest},
  {id:"egg",name:"Ovo de dragão",category:"CRIATURA",sprite:"egg",rarity:"INCOMUM",weight:7,text:"Está quente. Algo lá dentro acompanha seu ritmo.",requires:r=>!has("egg")&&!has("dragon"),effect:()=>addItem("egg")?say("OVO GUARDADO · Talvez precise de tempo.","good"):say("MOCHILA CHEIA · O ovo ficou para trás.")},
  {id:"cat",name:"Gatinho sonolento",category:"DESCANSO",sprite:"cat",rarity:"COMUM",weight:9,text:"Ele já encontrou o botão de parar. Você não.",effect:()=>{run.sleep=Math.min(100,run.sleep+22);run.combo=0;say("+22 SONO · COMBO QUEBRADO","good")}},
  {id:"key",name:"A chave sem porta",category:"ITEM",sprite:"key",rarity:"INCOMUM",weight:6,text:"Inútil agora. Irresistível guardar.",requires:r=>!has("key"),effect:()=>addItem("key")?say("CHAVE GUARDADA · Alguma fechadura lembra de você.","good"):say("MOCHILA CHEIA")},
  {id:"candle",name:"Uma vela acesa",category:"ITEM",sprite:"candle",rarity:"COMUM",weight:7,text:"Sua chama aponta para coisas que o feed esconde.",effect:()=>addItem("candle",5)?say("VELA · Revela perigos por 5 posts","good"):say("MOCHILA CHEIA")},
  {id:"magnet",name:"Ímã de recompensas",category:"ITEM",sprite:"magnet",rarity:"INCOMUM",weight:6,risk:2,text:"Puxa moedas. Puxa outras coisas também.",effect:()=>addItem("magnet",4)?say("ÍMÃ ATIVO · Sorte e perigo atraídos","good"):say("MOCHILA CHEIA")},
  {id:"hourglass",name:"Ampulheta invertida",category:"ITEM",sprite:"hourglass",rarity:"RARO",weight:4,text:"A areia sobe. O sono espera.",effect:()=>addItem("hourglass",4)?say("TEMPO CONGELADO · 4 posts","good"):say("MOCHILA CHEIA")},
  {id:"suitcase",name:"Maleta suspeita",category:"RISCO",sprite:"suitcase",rarity:"INCOMUM",weight:6,risk:5,text:"O valor aumenta enquanto você não abre.",effect:()=>{if(addItem("suitcase",0)){run.delayed.push({type:"suitcase",at:run.posts+5});say("MALETA GUARDADA · Aguente 5 posts","good")}else say("MOCHILA CHEIA")}},
  {id:"thief",name:"Ladrão de madrugada",category:"PERIGO",sprite:"thief",rarity:"INCOMUM",weight:5,risk:7,text:"Ele já escolheu um bolso. Você só não sabe qual.",effect:thief},
  {id:"ghost",name:"Fantasma seguidor",category:"CRIATURA",sprite:"ghost",rarity:"RARO",weight:4,text:"Ele curtiu você. Agora está seguindo.",requires:r=>!has("ghost"),effect:()=>addItem("ghost")?say("FANTASMA SEGUIRÁ A RUN · Algumas coisas vão mudar.","good"):say("MOCHILA CHEIA")},
  {id:"mirror",name:"Espelho da próxima coisa",category:"MISTÉRIO",sprite:"mirror",rarity:"RARO",weight:4,risk:4,text:"Seu reflexo mostra o próximo post duas vezes.",effect:()=>{run.mirror=true;say("PRÓXIMO EVENTO SERÁ DUPLICADO","good")}},
  {id:"door",name:"Porta onde não havia parede",category:"ENCONTRO",sprite:"door",rarity:"RARO",weight:4,risk:3,text:"A maçaneta gira antes do seu toque.",effect:door},
  {id:"shadow",name:"Post sem autor",category:"ANOMALIA",sprite:"door",rarity:"RARÍSSIMO",weight:1,risk:8,text:"A consequência desta publicação ainda não existe.",effect:()=>{run.delayed.push({type:"shadow",at:run.posts+3});say("ALGO RESPONDERÁ EM 3 POSTS")}},
  {id:"machine",name:"Máquina de madrugada",category:"ENCONTRO",sprite:"hourglass",rarity:"INCOMUM",weight:4,text:"Insira 8 moedas. Não aceita arrependimento.",requires:r=>r.coins>=8,effect:machine}
];

function loadSave(){try{const data={...defaults,...JSON.parse(localStorage.getItem(SAVE_KEY)||"{}")};data.ownedCosmetics=data.ownedCosmetics||["original"];return data}catch{return {...defaults}}}
function save(){localStorage.setItem(SAVE_KEY,JSON.stringify(meta))}
function has(id){return run.inventory.some(x=>x.id===id)}
function addItem(id,uses=null){if(run.inventory.length>=4)return false;run.inventory.push({id,uses});return true}
function removeItem(id){const i=run.inventory.findIndex(x=>x.id===id);if(i>=0)run.inventory.splice(i,1)}
function showScreen(id){document.querySelectorAll(".screen").forEach(x=>x.classList.toggle("active",x.id===id))}
function toast(message){$("toast").textContent=message;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),1600)}
function spawnFx(){
  const fx=$("fx");fx.innerHTML="";
  for(let i=0;i<14;i++){
    const spark=document.createElement("i");spark.className="spark";
    const angle=(Math.PI*2*i)/14;const distance=55+Math.random()*75;
    spark.style.setProperty("--x",`${Math.cos(angle)*distance}px`);
    spark.style.setProperty("--y",`${Math.sin(angle)*distance}px`);
    spark.style.animationDelay=`${Math.random()*.08}s`;fx.appendChild(spark);
  }
  setTimeout(()=>fx.innerHTML="",850);
}
function say(message,type=""){locked=true;$("outcome").textContent=message;$("outcome").className="outcome show "+type;setTimeout(()=>{locked=false;advance("up")},850)}
function discover(id){if(!meta.discoveries.includes(id)){meta.discoveries.push(id);run.newDiscoveries++;toast("NOVA DESCOBERTA")}}

function newRun(){
  run={sleep:100,temptation:1,coins:0,combo:0,maxCombo:0,posts:0,inventory:[],delayed:[],preferences:{},mirror:false,newDiscoveries:0,nextBoss:9+Math.floor(Math.random()*5),bossRound:0,protected:0};
  document.body.classList.remove("sleep-low");showScreen("game");nextEvent();render();
}

function weightedEvent(){
  let pool=EVENTS.filter(e=>!e.requires||e.requires(run));
  const total=pool.reduce((sum,e)=>sum+e.weight*(1+Math.min(.45,(run.preferences[e.category]||0)*.06)),0);
  let roll=Math.random()*total;
  return pool.find(e=>(roll-=e.weight*(1+Math.min(.45,(run.preferences[e.category]||0)*.06)))<=0)||pool[0];
}

function nextEvent(){
  if(run.posts>=run.nextBoss){startBoss();return}
  current=weightedEvent();run.posts++;discover(current.id);
  $("card").className="post-card"+(current.risk>=6?" danger":current.rarity.includes("RAR")?" rare":"");
  $("eventSprite").dataset.sprite=current.sprite;$("eventName").textContent=current.name;$("eventText").textContent=current.text;
  $("rarity").textContent=current.rarity;$("category").textContent=current.category;$("outcome").className="outcome";
  tickItems();resolveDelayed();render();
}

function interact(){
  if(locked)return;locked=true;run.preferences[current.category]=(run.preferences[current.category]||0)+1;run.combo++;run.maxCombo=Math.max(run.maxCombo,run.combo);
  $("card").classList.add("interacting");spawnFx();setTimeout(()=>$("card").classList.remove("interacting"),360);
  const duplicate=run.mirror&&current.id!=="mirror";const before={coins:run.coins,sleep:run.sleep,items:run.inventory.length};
  current.effect();
  if(duplicate){
    run.mirror=false;run.coins+=run.coins-before.coins;run.sleep=Math.max(0,Math.min(100,run.sleep+(run.sleep-before.sleep)));
    if(run.inventory.length>before.items&&run.inventory.length<4){const gained=run.inventory[run.inventory.length-1];run.inventory.push({...gained})}
    setTimeout(()=>toast("ESPELHO DUPLICOU O EFEITO"),180);
  }
}

function skip(){if(locked)return;run.combo=Math.max(0,run.combo-1);advance("left")}
function advance(direction="up"){
  if(!run||$("game").classList.contains("active")===false)return;
  locked=true;const frozen=has("hourglass");const cost=frozen?0:Math.max(3,5+Math.floor(run.temptation*.7));run.sleep=Math.max(0,run.sleep-cost);
  run.temptation=Math.min(3,1+run.posts*.075);const card=$("card");card.classList.add(direction==="left"?"swipe-left":"swipe-up");
  setTimeout(()=>{card.classList.remove("swipe-left","swipe-up");locked=false;if(run.sleep<=0)endRun(false);else nextEvent()},280);
}

function tickItems(){
  run.inventory.forEach(item=>{if(typeof item.uses==="number"&&item.uses>0)item.uses--});
  run.inventory.filter(x=>x.uses===0&&!["suitcase"].includes(x.id)).forEach(x=>{removeItem(x.id);toast(ITEMS[x.id].name+" acabou")});
  if(has("egg")){
    const age=run.posts-(run.eggAt||(run.eggAt=run.posts));
    if(age===3)toast("O OVO SE MEXEU");if(age===6)toast("PRIMEIRA RACHADURA");
    if(age>=9){removeItem("egg");addItem("dragon");discover("dragon");toast("O DRAGÃO NASCEU!");}
  }
}

function resolveDelayed(){
  run.delayed.filter(x=>x.at===run.posts).forEach(x=>{
    if(x.type==="suitcase"&&has("suitcase")){const gain=22+Math.floor(run.temptation*8);run.coins+=gain;removeItem("suitcase");toast(`MALETA ABRIU · +${gain} MOEDAS`)}
    if(x.type==="shadow"){const good=Math.random()>.48;if(good){run.coins+=20;toast("A SOMBRA DEVOLVEU +20 MOEDAS")}else{run.sleep=Math.max(1,run.sleep-16);toast("A SOMBRA ROUBOU 16 SONO")}}
  });
  run.delayed=run.delayed.filter(x=>x.at>run.posts);
}

function chest(){const trapped=Math.random()<.24+(run.temptation-1)*.08;if(trapped&&!has("candle")){run.sleep=Math.max(0,run.sleep-14);run.combo=0;say("MORDEU! · -14 SONO · COMBO QUEBRADO")}else{let gain=Math.floor((8+Math.random()*15)*run.temptation*(has("magnet")?1.45:1));run.coins+=gain;say(`+${gain} MOON COINS`,"good")}}
function thief(){if(has("dragon")){say("O DRAGÃO ESPANTOU O LADRÃO!","good");return}if(run.inventory.length){const stolen=run.inventory.splice(Math.floor(Math.random()*run.inventory.length),1)[0];say(`ROUBOU: ${ITEMS[stolen.id].name.toUpperCase()}`)}else{run.coins=Math.max(0,run.coins-7);say("ROUBOU 7 MOEDAS")}}
function door(){if(has("key")){removeItem("key");run.coins+=28;run.sleep=Math.min(100,run.sleep+10);say("A CHAVE SERVIU · +28 MOEDAS · +10 SONO","good")}else{run.sleep=Math.max(0,run.sleep-8);say("PORTA ERRADA · -8 SONO")}}
function machine(){run.coins-=8;if(Math.random()>.38){const gain=18+Math.floor(Math.random()*18);run.coins+=gain;say(`JACKPOT · +${gain} MOEDAS`,"good")}else{run.sleep=Math.max(0,run.sleep-9);say("A MÁQUINA RIU · -9 SONO")}}

function startBoss(){run.activeBoss=BOSSES[(meta.runs+Math.floor(Math.random()*BOSSES.length))%BOSSES.length];showScreen("boss");run.bossRound=0;$("bossTitle").textContent=run.activeBoss.name;$("bossSprite").dataset.boss=run.activeBoss.id;bossRound()}
function bossRound(){
  if(run.bossRound>=3){run.coins+=40;discover("boss-"+run.activeBoss.id);toast(run.activeBoss.name+" LIBEROU VOCÊ");setTimeout(()=>endRun(true),900);return}
  run.bossRound++;const favorites=Object.entries(run.preferences).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]).join(" E ")||"CURIOSIDADES";
  $("bossTaunt").textContent=run.activeBoss.taunt+` Preferência detectada: ${favorites}.`;
  $("bossChoices").innerHTML=`<button class="boss-choice hot" data-risk="1">${run.activeBoss.hot} <small>risco alto</small></button><button class="boss-choice" data-risk="0">${run.activeBoss.safe} <small>combo -1</small></button>`;
  document.querySelectorAll(".boss-choice").forEach(b=>b.onclick=()=>bossPick(b.dataset.risk==="1"));
}
function bossPick(risk){const b=run.activeBoss;if(risk){if(Math.random()<b.chance){const gain=Math.floor(b.reward*run.temptation);run.coins+=gain;toast(`RECOMPENSA · +${gain} MOEDAS`)}else{run.sleep=Math.max(1,run.sleep-b.damage);toast(`ARMADILHA · -${b.damage} SONO`)}}else run.combo=Math.max(0,run.combo-1);bossRound()}

function endRun(voluntary){
  if(!run)return;const kept=voluntary?run.coins:Math.ceil(run.coins*.68);meta.coins+=kept;meta.bestCombo=Math.max(meta.bestCombo,run.maxCombo);meta.runs++;save();
  $("resultTitle").textContent=voluntary?"VOCÊ CONSEGUIU PARAR":"VOCÊ APAGOU";$("resultSubtitle").textContent=voluntary?"O feed perdeu. Desta vez.":"Você segurou parte do loot enquanto dormia.";
  $("resultCoins").textContent=kept;$("resultPosts").textContent=run.posts;$("resultCombo").textContent=run.maxCombo;$("resultDiscoveries").textContent=run.newDiscoveries;
  $("resultMascot").dataset.sprite=voluntary?"happy":"sleepy";showScreen("result");updateMeta();
}

function render(){
  if(!run)return;$("sleepBar").style.width=run.sleep+"%";$("sleepText").textContent=run.sleep;$("temptBar").style.width=((run.temptation-1)/2*93+7)+"%";$("temptText").textContent=run.temptation.toFixed(1)+"×";
  $("runCoins").textContent=run.coins;$("combo").textContent=run.combo;$("post").textContent=run.posts;$("clock").textContent=`${String(2+Math.floor(run.posts/18)).padStart(2,"0")}:${String(17+run.posts*2).slice(-2)}`;
  $("mascot").dataset.sprite=run.sleep<28?"sleepy":run.temptation>2.1?"suspicious":run.combo>4?"happy":"neutral";document.body.classList.toggle("sleep-low",run.sleep<30);
  $("slots").innerHTML=Array.from({length:4},(_,i)=>{const x=run.inventory[i];return x?`<div class="slot">${spriteMarkup(ITEMS[x.id].sprite)}<small>${ITEMS[x.id].name}${x.uses>0?` · ${x.uses}`:""}</small></div>`:`<div class="slot empty"><small>VAZIO</small></div>`}).join("");
}

function spriteMarkup(sprite){return `<span class="mini-sprite" data-sprite="${sprite}"></span>`}
function updateMeta(){$("bankCoins").textContent=meta.coins;$("discoveryCount").textContent=meta.discoveries.length;document.body.dataset.cosmetic=meta.equippedCosmetic||"original"}
function renderCollection(){
  const all=[...EVENTS.map(e=>({id:e.id,name:e.name,sprite:e.sprite})),{id:"dragon",name:"Dragão bebê",sprite:"dragon"},...BOSSES.map(b=>({id:"boss-"+b.id,name:b.name,boss:b.id}))];
  $("collectionGrid").innerHTML=all.map(x=>{const found=meta.discoveries.includes(x.id);const art=x.boss?`<span class="boss-mini" data-boss="${x.boss}"></span>`:spriteMarkup(x.sprite);return `<div class="collection-item ${found?"":"locked"}">${found?art:"<span class=unknown>?</span>"}<small>${found?x.name.toUpperCase():"???"}</small></div>`}).join("");
}

function renderStore(){
  $("storeCoins").textContent=meta.coins;
  $("storeGrid").innerHTML=COSMETICS.map(c=>{const owned=meta.ownedCosmetics.includes(c.id),equipped=meta.equippedCosmetic===c.id;return `<article class="store-item"><span class="cosmetic-preview" style="background-position:${c.pos}"></span><h3>${c.name}</h3><button data-cosmetic="${c.id}" ${equipped?"disabled":""}>${equipped?"EQUIPADO":owned?"EQUIPAR":c.price+" MOON COINS"}</button></article>`}).join("");
  document.querySelectorAll("#storeGrid [data-cosmetic]").forEach(button=>button.onclick=()=>buyCosmetic(button.dataset.cosmetic));
}
function buyCosmetic(id){const cosmetic=COSMETICS.find(c=>c.id===id);if(!meta.ownedCosmetics.includes(id)){if(meta.coins<cosmetic.price){toast("MOON COINS INSUFICIENTES");return}meta.coins-=cosmetic.price;meta.ownedCosmetics.push(id)}meta.equippedCosmetic=id;save();updateMeta();renderStore();toast("COSMÉTICO EQUIPADO")}

$("startBtn").onclick=newRun;$("againBtn").onclick=newRun;$("stopBtn").onclick=()=>endRun(true);$("bossStop").onclick=()=>endRun(true);$("homeBtn").onclick=()=>showScreen("home");
$("interactBtn").onclick=interact;$("skipBtn").onclick=skip;$("nextBtn").onclick=()=>advance("up");
$("collectionBtn").onclick=()=>{renderCollection();showScreen("collection")};$("collectionBack").onclick=()=>showScreen("home");
$("storeBtn").onclick=()=>{renderStore();showScreen("store")};$("storeBack").onclick=()=>showScreen("home");
$("card").addEventListener("click",e=>{if(!e.target.closest("button"))interact()});
$("feed").addEventListener("touchstart",e=>touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY},{passive:true});
$("feed").addEventListener("touchend",e=>{if(!touchStart||locked)return;const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;if(dx<-55&&Math.abs(dx)>Math.abs(dy))skip();else if(dy<-55)advance("up");touchStart=null},{passive:true});
document.addEventListener("keydown",e=>{if(!$("game").classList.contains("active"))return;if(e.key==="ArrowUp")advance("up");if(e.key==="ArrowLeft")skip();if(e.key==="Enter"||e.key===" ")interact()});
updateMeta();
