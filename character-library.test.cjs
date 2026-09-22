const assert=require('node:assert/strict');
const library=require('./character-library.js');
(async()=>{
  const character={id:'wanderer',name:'Странник',image:'data:image/png;base64,aGVsbG8='};
  const repository=library.createMemoryRepository([character]);
  character.name='Изменено снаружи';
  assert.equal((await repository.get('wanderer')).name,'Странник');
  const list=await repository.list();list[0].name='Изменена копия';
  assert.equal((await repository.get('wanderer')).name,'Странник');
  await repository.put({...character,name:'Новое имя'});
  assert.equal((await repository.list()).length,1);
  assert.equal((await repository.get('wanderer')).name,'Новое имя');
  await assert.rejects(repository.put({...character,image:'https://example.com/avatar.png'}));
  assert.equal(await repository.remove('wanderer'),true);
  assert.equal(await repository.get('wanderer'),null);
  assert.equal(await repository.remove('wanderer'),false);
  console.log('PASS: character library contract, isolated copies, upsert, validation, removal');
})().catch(error=>{console.error(error);process.exitCode=1;});
