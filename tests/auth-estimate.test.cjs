const test=require('node:test');
const assert=require('node:assert/strict');
const register=require('../api/auth/register');
const estimate=require('../api/estimate');

function callRegister(body){
  let status,data;
  return register({method:'POST',body},{status(value){status=value;return this},json(value){data=value}}).then(()=>({status,data}));
}

test('public registration rejects administrator role',async()=>{
  const response=await callRegister({name:'Test User',location:'Bulacan',email:'admin-request@example.com',password:'password123',role:'admin'});
  assert.equal(response.status,400);
  assert.equal(response.data.error,'Hindi wastong tungkulin.');
});

test('public registration accepts Calamba as a location',async()=>{
  const response=await callRegister({name:'Calamba Test User',location:'Calamba',email:'calamba-location@example.com',password:'password123',role:'farmer'});
  assert.equal(response.status,201);
  assert.equal(response.data.user.location,'Calamba');
  assert.equal(response.data.user.role,'farmer');
});

test('price estimate totals multiply both per-kilo bounds by quantity',()=>{
  assert.deepEqual(estimate.addTotals({minimum:25,maximum:28},500),{minimum:25,maximum:28,totalMinimum:12500,totalMaximum:14000});
  assert.deepEqual(estimate.addTotals({minimum:52.5,maximum:61.25},12.5),{minimum:52.5,maximum:61.25,totalMinimum:656.25,totalMaximum:765.63});
});
