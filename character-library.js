/* Scaffold for a reusable character library. The current editor still stores
   characters inside the quest; this repository is intentionally not connected yet. */
(function installCharacterLibrary(root){
  'use strict';
  const layers=typeof module!=='undefined'?require('./scene-layers.js'):root.QuestLayers;
  function validate(character){
    layers.validate({characters:[character],scenes:[]});
    return {id:character.id,name:character.name,image:character.image};
  }
  // Future IndexedDB/server adapters must keep this async contract and return
  // independent objects, so editing a scene never mutates the library implicitly.
  function createMemoryRepository(initial=[]){
    const records=new Map();
    for(const value of initial){const record=validate(value);if(records.has(record.id))throw Error('Повторяющийся идентификатор персонажа.');records.set(record.id,record);}
    return {
      async list(){return [...records.values()].map(record=>({...record}));},
      async get(id){const record=records.get(id);return record?{...record}:null;},
      async put(character){const record=validate(character);records.set(record.id,record);return {...record};},
      async remove(id){return records.delete(id);}
    };
  }
  const api={schemaVersion:1,validate,createMemoryRepository};
  if(typeof module!=='undefined')module.exports=api;else root.CharacterLibrary=api;
})(globalThis);
