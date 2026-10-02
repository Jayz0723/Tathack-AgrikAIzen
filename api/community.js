const crypto = require('crypto');
const {command, getUser, verify, send, method} = require('./lib/store');

const KEY = 'agrikaizen:community:v1';
const REACTIONS = new Set(['helpful','heart','celebrate']);
const CATEGORIES = new Set(['general','question','tip','harvest','market']);
const fail = (message, status=400) => { throw Object.assign(new Error(message), {status}); };
const cleanText = (value, max) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null;
const seedPosts = () => ([
  {id:'welcome-harvest',authorId:null,author:'Ramon Dimaculangan',role:'farmer',location:'Batangas',text:'Salamat sa payo ng AgrikAIzen! Tumaas ang average yield ng aming RC 218 rice ng halos 18% kumpara noong nakaraang taon.',category:'harvest',createdAt:'2026-10-02T06:00:00.000Z',reactions:{helpful:[],heart:[],celebrate:[]},comments:[]},
  {id:'welcome-tip',authorId:null,author:'Maria Santos',role:'coop',location:'Benguet',text:'Mag-ingat sa peste ng Rice Black Bug ngayong papalapit ang kabilugan ng buwan. Panatilihin ang tamang antas ng tubig at obserbahan ang palayan.',category:'tip',createdAt:'2026-10-02T03:00:00.000Z',reactions:{helpful:[],heart:[],celebrate:[]},comments:[]}
]);
const blank = () => ({posts:seedPosts()});
function normalized(raw) {
  const db = raw ? JSON.parse(raw) : blank();
  if (!Array.isArray(db.posts)) db.posts=[];
  db.posts.forEach(post=>{
    post.reactions=post.reactions||{};
    for(const type of REACTIONS) if(!Array.isArray(post.reactions[type]))post.reactions[type]=[];
    if(!Array.isArray(post.comments))post.comments=[];
  });
  return db;
}
function publicPost(post,user) {
  return {
    id:post.id,author:post.author,role:post.role,location:post.location,text:post.text,category:post.category,createdAt:post.createdAt,
    reactions:Object.fromEntries([...REACTIONS].map(type=>[type,post.reactions[type].length])),
    viewerReactions:[...REACTIONS].filter(type=>post.reactions[type].includes(user.id)),
    comments:post.comments.map(c=>({id:c.id,author:c.author,role:c.role,text:c.text,createdAt:c.createdAt,isOwn:c.authorId===user.id})),
    canDelete:post.authorId===user.id||user.role==='admin'
  };
}
function publicPosts(db,user){return [...db.posts].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).map(p=>publicPost(p,user));}
function mutate(db,user,body) {
  const createdAt=new Date().toISOString();
  if(body.action==='createPost'){
    const text=cleanText(body.text,700);if(!text)fail('Write a post with 1 to 700 characters.');
    const category=CATEGORIES.has(body.category)?body.category:'general';
    const post={id:crypto.randomUUID(),authorId:user.id,author:user.name,role:user.role,location:user.location,text,category,createdAt,reactions:{helpful:[],heart:[],celebrate:[]},comments:[]};
    db.posts.push(post);return post;
  }
  const post=db.posts.find(p=>p.id===body.postId);if(!post)fail('Post not found.',404);
  if(body.action==='toggleReaction'){
    if(!REACTIONS.has(body.reaction))fail('Invalid reaction.');
    const users=post.reactions[body.reaction],index=users.indexOf(user.id);
    if(index>=0)users.splice(index,1);else users.push(user.id);
    return post;
  }
  if(body.action==='addComment'){
    const text=cleanText(body.text,300);if(!text)fail('Write a comment with 1 to 300 characters.');
    post.comments.push({id:crypto.randomUUID(),authorId:user.id,author:user.name,role:user.role,text,createdAt});return post;
  }
  if(body.action==='deletePost'){
    if(post.authorId!==user.id&&user.role!=='admin')fail('You can only delete your own posts.',403);
    db.posts.splice(db.posts.indexOf(post),1);return post;
  }
  fail('Unknown action.');
}

module.exports = async (req,res) => {
  if(!method(req,res))return;
  try{
    const session=verify((req.headers.authorization||'').replace(/^Bearer /,''));
    const user=session&&await getUser(session.email);
    if(!user||user.id!==session.sub)return send(res,401,{error:'Please sign in again.'});
    const body=req.body||{},raw=await command(['GET',KEY]),db=normalized(raw);
    if(body.action==='read')return send(res,200,{posts:publicPosts(db,user)});
    const result=mutate(db,user,body);
    const script="local old=redis.call('GET',KEYS[1]); if (old or '') ~= ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
    if(!await command(['EVAL',script,1,KEY,raw||'',JSON.stringify(db)]))return send(res,409,{error:'The community changed. Refresh and try again.'});
    return send(res,200,{result:body.action==='deletePost'?{id:result.id}:publicPost(result,user),posts:publicPosts(db,user)});
  }catch(error){if(!error.status||error.status>=500)console.error('community failed',error);return send(res,error.status||500,{error:error.message||'The community is temporarily unavailable.'});}
};

module.exports._test={blank,mutate,publicPosts};
