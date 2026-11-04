export const ITEMS={
 ironblade:{name:'Espada do Guardião',slot:'weapon',rarity:'common',w:1,h:3,attack:6,skin:'seraph',icon:'sword',value:12},
 dawnblade:{name:'Lâmina da Aurora',slot:'weapon',rarity:'rare',w:1,h:3,attack:16,icon:'sword',value:65,skin:'seraph'},
 voidstaff:{name:'Cetro do Eclipse',slot:'weapon',rarity:'epic',w:1,h:3,attack:21,icon:'staff',value:100,skin:'eclipse'},
 sunblade:{name:'Espada da Fênix',slot:'weapon',rarity:'legendary',w:1,h:3,attack:28,icon:'sword',value:180,skin:'phoenix'},
 guardarmor:{name:'Peitoral do Guardião',slot:'armor',rarity:'common',w:2,h:3,defense:3,icon:'armor',value:15},
 dragonarmor:{name:'Couraça do Dragão',slot:'armor',rarity:'epic',w:2,h:3,defense:9,icon:'armor',value:120},
 guardhelm:{name:'Elmo do Guardião',slot:'helm',rarity:'common',w:2,h:2,defense:2,icon:'helm',value:10},
 crown:{name:'Coroa dos Ascendidos',slot:'helm',rarity:'rare',w:2,h:2,defense:5,icon:'helm',value:65},
 boots:{name:'Grevas do Viajante',slot:'boots',rarity:'common',w:2,h:2,defense:1,speed:.5,icon:'boots',value:10},
 swiftboots:{name:'Grevas do Vendaval',slot:'boots',rarity:'rare',w:2,h:2,defense:3,speed:1.5,icon:'boots',value:70},
 wings:{name:'Asas Seráficas IV',slot:'wings',rarity:'legendary',w:3,h:2,attack:3,defense:2,icon:'wings',value:250},
 ring:{name:'Anel do Firmamento',slot:'ring',rarity:'rare',w:1,h:1,attack:4,defense:2,icon:'ring',value:60},
 health:{name:'Poção de Vida',kind:'consumable',rarity:'common',w:1,h:1,icon:'health',value:4,price:10,restore:45},
 mana:{name:'Poção de Mana',kind:'consumable',rarity:'common',w:1,h:1,icon:'mana',value:5,price:12,restore:40},
 jewel:{name:'Joia da Evolução',kind:'jewel',rarity:'epic',w:1,h:1,icon:'jewel',value:35}
};
export const SLOT_NAMES={weapon:'Arma',helm:'Elmo',armor:'Armadura',wings:'Asas',boots:'Botas',ring:'Anel'};
export function createInventory(snapshot){
 const width=8,height=6;let nextId=1,bag=[],equipment={};
 const valid=i=>i&&Object.hasOwn(ITEMS,i.type)&&typeof i.uid==='string'&&/^item-\d+$/.test(i.uid)&&Number.isInteger(i.level??0)&&(i.level??0)>=0&&(i.level??0)<=9;
 const make=(type,count=1)=>({uid:`item-${nextId++}`,type,count,level:0});
 function fits(item,x,y,ignore){const d=ITEMS[item.type];if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+d.w>width||y+d.h>height)return false;return !bag.some(b=>b.uid!==ignore&&x<b.x+ITEMS[b.type].w&&x+d.w>b.x&&y<b.y+ITEMS[b.type].h&&y+d.h>b.y);}
 function place(item){for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(fits(item,x,y)){item.x=x;item.y=y;bag.push(item);return true;}return false;}
 if(snapshot&&Array.isArray(snapshot.bag)&&snapshot.equipment){const seen=new Set();for(const [slot,i] of Object.entries(snapshot.equipment)){if(valid(i)&&ITEMS[i.type].slot===slot&&!seen.has(i.uid)){equipment[slot]={...i,count:1,level:i.level??0};seen.add(i.uid);}}for(const i of snapshot.bag){if(valid(i)&&!seen.has(i.uid)){const item={...i,level:i.level??0,count:Math.max(1,Math.min(99,Math.floor(i.count)||1))};if(fits(item,item.x,item.y)){bag.push(item);seen.add(i.uid);}}}nextId=Math.max(1,...[...bag,...Object.values(equipment)].map(i=>Number(i.uid.split('-')[1])+1||1));}
 else {for(const type of ['ironblade','guardarmor','guardhelm','boots','wings'])equipment[ITEMS[type].slot]=make(type);for(const [type,count] of [['dawnblade',1],['dragonarmor',1],['ring',1],['health',6],['mana',6],['jewel',2]])place(make(type,count));}
 const serial=()=>({bag:bag.map(i=>({...i})),equipment:Object.fromEntries(Object.entries(equipment).map(([k,i])=>[k,{...i}]))});
 const item=uid=>bag.find(i=>i.uid===uid)||Object.values(equipment).find(i=>i.uid===uid);
 function add(type,count=1){if(!Object.hasOwn(ITEMS,type)||!Number.isInteger(count)||count<1||count>99)return false;if(ITEMS[type].kind){const stack=bag.find(i=>i.type===type&&i.count+count<=99);if(stack){stack.count+=count;return stack;}}const i=make(type,count);return place(i)?i:false;}
 function equip(uid){const chosen=bag.find(i=>i.uid===uid),slot=chosen&&ITEMS[chosen.type].slot;if(!slot)return false;const old=equipment[slot],backup=bag.map(i=>({...i}));bag=bag.filter(i=>i!==chosen);if(old&&!place({...old})){bag=backup;return false;}equipment[slot]={...chosen,count:1};return true;}
 function unequip(slot){const current=equipment[slot];if(!current||!place({...current}))return false;delete equipment[slot];return true;}
 function consume(type){const i=bag.find(i=>i.type===type);if(!i)return false;if(--i.count<=0)bag=bag.filter(b=>b!==i);return true;}
 function sell(uid){const i=bag.find(i=>i.uid===uid);if(!i)return 0;const value=ITEMS[i.type].value;if(--i.count<=0)bag=bag.filter(b=>b!==i);return value;}
 function upgrade(uid,gold){const target=item(uid);if(!target||!ITEMS[target.type].slot||target.level>=9)return {ok:false,reason:'Selecione um equipamento com nível abaixo de +9.'};const cost=30*(target.level+1),jewel=bag.find(i=>i.type==='jewel');if(!jewel)return {ok:false,reason:'Você precisa de uma Joia da Evolução.'};if(gold<cost)return {ok:false,reason:`Precisa de ${cost} Zen.`};consume('jewel');target.level++;return {ok:true,cost};}
 function move(uid,x,y){const i=bag.find(i=>i.uid===uid);if(!i||!fits(i,x,y,uid))return false;i.x=x;i.y=y;return true;}
 function stats(){let attack=0,defense=0,speed=0;for(const i of Object.values(equipment)){const d=ITEMS[i.type];attack+=(d.attack||0)+(d.attack?i.level*2:0);defense+=(d.defense||0)+(d.defense?i.level:0);speed+=d.speed||0;}return {attack,defense,speed};}
 return {add,equip,unequip,consume,sell,upgrade,move,stats,serial,item,get bag(){return bag;},get equipment(){return equipment;},count:type=>bag.filter(i=>i.type===type).reduce((n,i)=>n+i.count,0)};
}
