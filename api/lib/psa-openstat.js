const DEFAULT_BASE='https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2M/NFG';
const SOURCE='Philippine Statistics Authority (PSA) OpenSTAT';
const MONTHS={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
const CROPS={
  palay:{table:'01',commodities:['0','1']},mais:{table:'01',commodities:['2','3','4','5']},
  patatas:{table:'02',commodities:['13']},kamote:{table:'02',commodities:['10']},
  sibuyas:{table:'04',commodities:['5','6','7']},sili:{table:'04',commodities:['9','11']},
  kamatis:{table:'05',commodities:['13']},talong:{table:'05',commodities:['4','5']},
  pechay:{table:'06',commodities:['14','15']},repolyo:{table:'06',commodities:['4']},
  saging:{table:'07',commodities:['2','3','4','5','6','46']},mangga:{table:'07',commodities:['21','22','23','24']},
  pinya:{table:'07',commodities:['33','34','35']},papaya:{table:'07',commodities:['29','30','31','32']},
  niyog:{table:'08',commodities:['9','10']}
};
const cache=global.__agrikaizenPsaCache||(global.__agrikaizenPsaCache=new Map());
const normalize=value=>String(value||'').replace(/^\.+/,'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const tableUrl=table=>`${String(process.env.PSA_OPENSTAT_BASE_URL||DEFAULT_BASE).replace(/\/$/,'')}/0032M4AFN${table}.px`;
function variable(metadata,code){const found=metadata.variables?.find(item=>item.code===code);if(!found)throw new Error(`PSA metadata is missing ${code}.`);return found;}
function pairs(item){return item.values.map((value,index)=>({value:String(value),label:String(item.valueTexts[index]||value)}));}
function locationValues(metadata,location){
  const items=pairs(variable(metadata,'Geolocation')),national=items.find(item=>normalize(item.label)==='philippines')||items[0];
  const terms=String(location||'').split(',').map(normalize).filter(term=>term.length>2).reverse();
  const local=terms.map(term=>items.find(item=>{const label=normalize(item.label);return label===term||label.includes(term)})).find(Boolean);
  return {values:[...new Set([local?.value,national?.value].filter(Boolean))],labels:Object.fromEntries(items.map(item=>[item.value,item.label])),local:local?.value,national:national?.value};
}
function latestYears(metadata,now){
  const current=now.getUTCFullYear(),items=pairs(variable(metadata,'Year')).filter(item=>/^\d{4}$/.test(item.label)&&Number(item.label)<=current).sort((a,b)=>Number(b.label)-Number(a.label)).slice(0,2);
  if(!items.length)throw new Error('PSA has no published year for this table.');return items;
}
function periods(metadata){return pairs(variable(metadata,'Period')).filter(item=>MONTHS[normalize(item.label)]);}
async function json(url,options={}){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error(`PSA OpenSTAT returned ${response.status}.`);
  const text=await response.text();return JSON.parse(text.replace(/^\uFEFF/,''));
}
async function fetchPSAPrices(crop,location,{now=new Date(),force=false}={}){
  const mapping=CROPS[crop];if(!mapping)throw new Error('This crop is not mapped to PSA OpenSTAT.');
  const cacheKey=`${crop}|${normalize(location)}`,cached=cache.get(cacheKey);if(!force&&cached&&cached.expiresAt>Date.now())return cached.records;
  const url=tableUrl(mapping.table),metadata=await json(url),geo=locationValues(metadata,location),years=latestYears(metadata,now),monthItems=periods(metadata),commodityLabels=Object.fromEntries(pairs(variable(metadata,'Commodity')).map(item=>[item.value,item.label]));
  const query=[
    {code:'Geolocation',selection:{filter:'item',values:geo.values}},
    {code:'Commodity',selection:{filter:'item',values:mapping.commodities}},
    {code:'Year',selection:{filter:'item',values:years.map(item=>item.value)}},
    {code:'Period',selection:{filter:'item',values:monthItems.map(item=>item.value)}}
  ];
  const payload=await json(url,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query,response:{format:'json'}})}),yearLabels=Object.fromEntries(years.map(item=>[item.value,item.label])),monthNumbers=Object.fromEntries(monthItems.map(item=>[item.value,MONTHS[normalize(item.label)]]));
  const all=(payload.data||[]).map(row=>{const price=Number(row.values?.[0]),[geoCode,commodityCode,yearCode,periodCode]=row.key||[];if(!Number.isFinite(price)||price<=0||!yearLabels[yearCode]||!monthNumbers[periodCode])return null;return {crop,price,location:geo.labels[geoCode]||location||'PHILIPPINES',saleDate:`${yearLabels[yearCode]}-${String(monthNumbers[periodCode]).padStart(2,'0')}-01`,sourceName:SOURCE,sourceUrl:url,sourceKey:`psa:${mapping.table}:${geoCode}:${commodityCode}:${yearCode}:${periodCode}`,commodity:commodityLabels[commodityCode]||crop,status:'verified',marketType:'official-farmgate'};}).filter(Boolean);
  const local=geo.local?all.filter(item=>item.sourceKey.split(':')[2]===geo.local):[],records=(local.length?local:all.filter(item=>item.sourceKey.split(':')[2]===geo.national)).sort((a,b)=>b.saleDate.localeCompare(a.saleDate)).slice(0,100);
  cache.set(cacheKey,{records,expiresAt:Date.now()+6*60*60*1000});return records;
}

module.exports={CROPS,DEFAULT_BASE,SOURCE,fetchPSAPrices,locationValues,latestYears};
