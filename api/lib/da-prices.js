const INDEX_URL='https://www.da.gov.ph/price-monitoring/';
const SOURCE='Department of Agriculture (DA) Daily Price Index';
const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
const cache=global.__agrikaizenDaCache||(global.__agrikaizenDaCache={report:null,expiresAt:0,pending:null});

// Only the named DA NCR report format is accepted. Retail observations remain
// comparison data; they must never be averaged into a farmer's farmgate estimate.
const PRODUCTS=[
  {crop:'palay',pattern:/^(Glutinous Rice|Other Special Rice|Premium|Well Milled|Regular Milled)\b/i,section:'LOCAL COMMERCIAL RICE',form:'Milled rice, not unmilled palay'},
  {crop:'mais',pattern:/^Corn \((White|Yellow)\)/i,form:'Fresh corn cob, not dry grain'},
  {crop:'kamatis',pattern:/^Tomato\b/i},
  {crop:'talong',pattern:/^Eggplant\b/i},
  {crop:'pechay',pattern:/^Native Pechay\b/i},
  {crop:'repolyo',pattern:/^Cabbage \((Rare Ball|Scorpio|Wonder Ball)\)/i},
  {crop:'patatas',pattern:/^White Potato, Local\b/i},
  {crop:'sibuyas',pattern:/^(Red|White) Onion, Local\b/i},
  {crop:'sili',pattern:/^Chilli \((Green|Red)\), Local\b/i},
  {crop:'saging',pattern:/^Banana \((Lakatan|Latundan|Saba)\)/i},
  {crop:'mangga',pattern:/^Mango \(Carabao\)/i},
  {crop:'pinya',pattern:/^Pineapple\b/i},
  {crop:'papaya',pattern:/^Papaya\b/i},
  {crop:'kamote',pattern:/^Sweet Potato\b/i}
];

function reportDate(value){
  const match=String(value).match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)[\s-]+(\d{1,2})[\s,-]+(20\d{2})\b/i);
  if(!match)return null;
  const month=MONTHS.indexOf(match[1].toLowerCase())+1;
  const date=`${match[3]}-${String(month).padStart(2,'0')}-${match[2].padStart(2,'0')}`;
  const parsed=new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?date:null;
}
function latestReport(html,now=new Date()){
  const today=new Date(now.getTime()+8*60*60*1000).toISOString().slice(0,10);
  const candidates=[];
  for(const match of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    let url;try{url=new URL(match[1].replace(/&amp;/g,'&'),INDEX_URL)}catch{continue}
    if(url.protocol!=='https:'||url.hostname!=='www.da.gov.ph'||!/^\/wp-content\/uploads\//.test(url.pathname)||!/-DPI-AFC\.pdf$/i.test(url.pathname))continue;
    const date=reportDate(match[2].replace(/<[^>]*>/g,' '))||reportDate(url.pathname);
    if(date&&date<=today)candidates.push({url:url.href,date});
  }
  const report=candidates.sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(!report)throw new Error('DA has no supported published Daily Price Index report.');
  return report;
}
function parseReport(text,report){
  if(!/DAILY PRICE INDEX/i.test(text)||!/National Capital Region\s*\(NCR\)/i.test(text)||!/Prevailing Retail Price/i.test(text)||!/Agri-fishery commodities except egg:\s*Peso per Kilogram/i.test(text)||reportDate(text)!==report.date)throw new Error('DA report format, units, or date could not be verified.');
  let section='';const records=[];
  for(const raw of text.split(/\r?\n/)){
    const line=raw.replace(/\s+/g,' ').trim();
    if(/^[A-Z][A-Z &/-]{5,}$/.test(line)){section=line;continue}
    const product=PRODUCTS.find(p=>(!p.section||p.section===section)&&p.pattern.test(line));
    if(!product)continue;
    // A final decimal is the price column. Specifications such as "13-15 pcs/kg"
    // and missing prices (n/a) cannot accidentally become monetary observations.
    const value=line.match(/\s(\d{1,5}\.\d{2})$/);
    if(!value)continue;
    const price=Number(value[1]);if(!Number.isFinite(price)||price<=0)continue;
    const commodity=line.slice(0,value.index).trim();
    records.push({crop:product.crop,price,location:'National Capital Region (NCR), selected wet markets',saleDate:report.date,sourceName:SOURCE,sourceUrl:report.url,sourceKey:`da:ncr:retail:${report.date}:${commodity.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,commodity,productForm:product.form||'Fresh produce',unit:'PHP/kg',status:'verified',marketType:'official-retail',reportingPeriod:'daily',coverage:'NCR market reference; not a local farmgate quotation'});
  }
  if(records.length<3)throw new Error('DA report prices could not be parsed reliably.');
  return records;
}
async function response(url){
  const result=await fetch(url,{headers:{Accept:'application/pdf,text/html'},signal:AbortSignal.timeout(7000),redirect:'error'});
  if(!result.ok)throw new Error(`DA price source returned ${result.status}.`);
  const length=Number(result.headers.get('content-length')||0);if(length>4*1024*1024)throw new Error('DA report exceeded the size limit.');
  return result;
}
async function loadReport(now){
  const index=await response(INDEX_URL),html=await index.text();
  if(html.length>4*1024*1024)throw new Error('DA index exceeded the size limit.');
  const report=latestReport(html,now);
  if(cache.report?.url===report.url){cache.expiresAt=Date.now()+60*60*1000;return cache.report}
  const pdf=await response(report.url),data=new Uint8Array(await pdf.arrayBuffer());
  if(data.length>4*1024*1024||Buffer.from(data.slice(0,5)).toString()!=='%PDF-')throw new Error('DA source did not return a valid PDF.');
  const {PDFParse}=require('pdf-parse');const parser=new PDFParse({data});
  try{const result=await parser.getText();cache.report={...report,records:parseReport(result.text,report),retrievedAt:new Date().toISOString()};cache.expiresAt=Date.now()+60*60*1000;return cache.report}finally{await parser.destroy()}
}
async function fetchDAPrices(crop,_location,{now=new Date(),force=false}={}){
  if(!force&&cache.report&&cache.expiresAt>Date.now())return cache.report.records.filter(r=>r.crop===crop);
  if(!cache.pending)cache.pending=loadReport(now).finally(()=>{cache.pending=null});
  const report=await cache.pending;return report.records.filter(r=>r.crop===crop);
}
module.exports={INDEX_URL,SOURCE,latestReport,parseReport,reportDate,fetchDAPrices};
